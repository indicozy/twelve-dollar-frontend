use std::convert::Infallible;
use std::net::SocketAddr;
use std::time::Duration;

use bytes::Bytes;
use http_body_util::{BodyExt, Full, Limited};
use hyper::body::Incoming;
use hyper::header::{HeaderValue, ACCESS_CONTROL_ALLOW_ORIGIN, AUTHORIZATION, CONTENT_TYPE};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use socket2::{Domain, Protocol, Socket, Type};

use crate::db::{self, Write};
use crate::jwt::{self, parse_positive_id};
use crate::{config, json};

type Resp = Response<Full<Bytes>>;

const MAX_BODY: usize = 64 * 1024;

pub fn run_worker(addr: SocketAddr) {
    let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("tokio runtime");
    rt.block_on(async move {
        let listener = tokio::net::TcpListener::from_std(bind(addr)).expect("listener");
        loop {
            let (stream, _) = match listener.accept().await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let _ = stream.set_nodelay(true);
            tokio::task::spawn(async move {
                let _ = http1::Builder::new()
                    .keep_alive(true)
                    .max_buf_size(MAX_BODY * 2)
                    .serve_connection(TokioIo::new(stream), service_fn(handle))
                    .await;
            });
        }
    });
}

/// One SO_REUSEPORT socket per worker: the kernel spreads connections across threads.
fn bind(addr: SocketAddr) -> std::net::TcpListener {
    let socket = Socket::new(Domain::for_address(addr), Type::STREAM, Some(Protocol::TCP)).expect("socket");
    socket.set_reuse_address(true).expect("SO_REUSEADDR");
    socket.set_reuse_port(true).expect("SO_REUSEPORT");
    socket.set_nonblocking(true).expect("nonblocking");
    socket.set_tcp_keepalive(&socket2::TcpKeepalive::new().with_time(Duration::from_secs(120))).ok();
    socket.bind(&addr.into()).expect("bind");
    socket.listen(4096).expect("listen");
    socket.into()
}

async fn handle(req: Request<Incoming>) -> Result<Resp, Infallible> {
    let path = req.uri().path();
    let resp = match (req.method(), path) {
        (&Method::GET, "/feed") => feed(),
        (&Method::GET, "/health") => health(),
        (&Method::POST, "/posts") => create_post(req).await,
        (m, p) => match p.strip_prefix("/posts/") {
            Some(rest) if m == Method::GET && !rest.contains('/') => get_post(rest),
            Some(rest) if m == Method::POST => match rest.strip_suffix("/like") {
                Some(id) if !id.contains('/') => {
                    let id = id.to_owned();
                    like(req, &id).await
                }
                _ => error(StatusCode::NOT_FOUND, "not found"),
            },
            _ => error(StatusCode::NOT_FOUND, "not found"),
        },
    };
    Ok(resp)
}

fn json_response(status: StatusCode, body: Vec<u8>) -> Resp {
    let mut r = Response::new(Full::new(Bytes::from(body)));
    *r.status_mut() = status;
    r.headers_mut().insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    // Lets browsers read public JSON (feed, posts) straight from the API, e.g. the nextjs-smart variant's live like
    // counts. Writes still need a Bearer token, which a cross-origin page never has.
    r.headers_mut().insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    r
}

fn error(status: StatusCode, message: &str) -> Resp {
    let mut out = Vec::with_capacity(32 + message.len());
    out.extend_from_slice(b"{\"error\":");
    json::string(&mut out, message);
    out.push(b'}');
    json_response(status, out)
}

fn internal() -> Resp {
    error(StatusCode::INTERNAL_SERVER_ERROR, "internal server error")
}

fn health() -> Resp {
    match db::health() {
        Ok(()) => {
            let mut out = Vec::with_capacity(64);
            out.extend_from_slice(b"{\"status\":\"ok\",\"db\":\"ok\",\"uptime_s\":");
            json::int(&mut out, config().started.elapsed().as_secs() as i64);
            out.push(b'}');
            json_response(StatusCode::OK, out)
        }
        Err(e) => {
            let mut out = Vec::with_capacity(128);
            out.extend_from_slice(b"{\"status\":\"degraded\",\"db\":\"unreachable\",\"error\":");
            json::string(&mut out, &e.to_string());
            out.push(b'}');
            json_response(StatusCode::SERVICE_UNAVAILABLE, out)
        }
    }
}

fn feed() -> Resp {
    let mut out = Vec::with_capacity(8 * 1024);
    match db::feed(&mut out) {
        Ok(()) => json_response(StatusCode::OK, out),
        Err(_) => internal(),
    }
}

fn get_post(raw_id: &str) -> Resp {
    let Some(id) = parse_positive_id(raw_id) else {
        return error(StatusCode::BAD_REQUEST, "invalid post id");
    };
    let mut out = Vec::with_capacity(512);
    match db::post(&mut out, id) {
        Ok(true) => json_response(StatusCode::OK, out),
        Ok(false) => error(StatusCode::NOT_FOUND, "post not found"),
        Err(_) => internal(),
    }
}

fn auth(req: &Request<Incoming>) -> Result<jwt::Claims, Resp> {
    let header = req.headers().get(AUTHORIZATION).map(|v| v.as_bytes());
    jwt::verify(header, &config().jwt_secret).map_err(|e| error(StatusCode::UNAUTHORIZED, e.message()))
}

async fn create_post(req: Request<Incoming>) -> Resp {
    let claims = match auth(&req) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let raw = match Limited::new(req.into_body(), MAX_BODY).collect().await {
        Ok(b) => b.to_bytes(),
        Err(_) => return error(StatusCode::BAD_REQUEST, "malformed JSON body"),
    };
    let parsed: serde_json::Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(_) => return error(StatusCode::BAD_REQUEST, "malformed JSON body"),
    };
    let body = match parsed.get("body").and_then(|b| b.as_str()).map(str::trim) {
        Some(b) if !b.is_empty() => b,
        _ => return error(StatusCode::BAD_REQUEST, "body is required"),
    };
    if body.chars().count() > 500 {
        return error(StatusCode::BAD_REQUEST, "body must be at most 500 characters");
    }
    let body = body.to_owned();

    let user_id = claims.user_id;
    let stored_body = body.clone();
    match db::submit(|reply| Write::CreatePost { user_id, body: stored_body, reply }).await {
        Ok((id, created_at)) => {
            let mut out = Vec::with_capacity(body.len() + 128);
            out.extend_from_slice(b"{\"post\":");
            json::post(&mut out, id, &body, &created_at, &claims.username, 0);
            out.push(b'}');
            json_response(StatusCode::CREATED, out)
        }
        Err(_) => internal(),
    }
}

async fn like(req: Request<Incoming>, raw_id: &str) -> Resp {
    let claims = match auth(&req) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let Some(post_id) = parse_positive_id(raw_id) else {
        return error(StatusCode::BAD_REQUEST, "invalid post id");
    };
    match db::post_exists(post_id) {
        Ok(true) => {}
        Ok(false) => return error(StatusCode::NOT_FOUND, "post not found"),
        Err(_) => return internal(),
    }
    let user_id = claims.user_id;
    match db::submit(|reply| Write::Like { user_id, post_id, reply }).await {
        Ok(inserted) => {
            let mut out = Vec::with_capacity(80);
            out.extend_from_slice(b"{\"liked\":true,\"already_liked\":");
            out.extend_from_slice(if inserted { b"false" } else { b"true" });
            out.extend_from_slice(b",\"post_id\":");
            json::int(&mut out, post_id);
            out.push(b'}');
            json_response(if inserted { StatusCode::CREATED } else { StatusCode::OK }, out)
        }
        Err(_) => internal(),
    }
}
