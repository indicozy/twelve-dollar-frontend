//! Server binary (`ssr` feature): the start-axum template's main, plus the two JSON passthrough routes the load test
//! writes through, and HOST/PORT from the environment (../SPEC.md).

#[cfg(feature = "ssr")]
#[tokio::main]
async fn main() {
    use axum::body::Bytes;
    use axum::extract::Path;
    use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
    use axum::http::{HeaderMap, HeaderValue, StatusCode};
    use axum::response::{IntoResponse, Response};
    use axum::routing::post;
    use axum::serve::ListenerExt;
    use axum::Router;
    use feed_leptos::api::{self, API};
    use feed_leptos::app::{shell, App};
    use feed_leptos::env_or;
    use leptos::prelude::*;
    use leptos_axum::{generate_route_list, LeptosRoutes};
    use std::sync::LazyLock;

    fn json(status: u16, body: Bytes) -> Response {
        let status = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
        (status, [(CONTENT_TYPE, HeaderValue::from_static("application/json"))], body).into_response()
    }

    fn upstream_error(e: api::Error) -> Response {
        eprintln!("error: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
    }

    fn authorization(headers: &HeaderMap) -> Option<&str> {
        headers.get(AUTHORIZATION).and_then(|v| v.to_str().ok())
    }

    /// JS `String(value ?? "")` for the `body` field (same as ../rust-axum).
    fn js_string(v: Option<&serde_json::Value>) -> String {
        use serde_json::Value;
        match v {
            None | Some(Value::Null) => String::new(),
            Some(Value::String(s)) => s.clone(),
            Some(Value::Bool(b)) => b.to_string(),
            Some(Value::Number(n)) => n.to_string(),
            Some(Value::Array(a)) => a.iter().map(|x| js_string(Some(x))).collect::<Vec<_>>().join(","),
            Some(Value::Object(_)) => "[object Object]".to_owned(),
        }
    }

    async fn api_create(headers: HeaderMap, body: Bytes) -> Response {
        let text = match serde_json::from_slice::<serde_json::Value>(&body) {
            Ok(serde_json::Value::Null) | Err(_) => {
                return json(400, Bytes::from_static(br#"{"error":"malformed JSON body"}"#));
            }
            Ok(v) => js_string(v.as_object().and_then(|o| o.get("body"))),
        };
        match API.create_post(authorization(&headers), &text).await {
            Ok(raw) => json(raw.status, raw.body),
            Err(e) => upstream_error(e),
        }
    }

    async fn api_like(headers: HeaderMap, Path(id): Path<String>) -> Response {
        match API.like_post(authorization(&headers), &id).await {
            Ok(raw) => json(raw.status, raw.body),
            Err(e) => upstream_error(e),
        }
    }

    /// Leptos server functions have no CSRF/origin protection of their own, so the form posts (every server fn:
    /// login, like_post, create_post) get the same rule as ../rust-axum and ../express: if an Origin header is
    /// present, its host[:port] must equal the Host header, else 403. The /api/posts JSON passthroughs are not checked.
    async fn same_origin(req: axum::extract::Request, next: axum::middleware::Next) -> Response {
        use axum::http::header::{HOST, ORIGIN};
        use axum::http::Method;
        let path = req.uri().path();
        if req.method() == Method::POST && !(path == "/api/posts" || path.starts_with("/api/posts/")) {
            if let Some(origin) = req.headers().get(ORIGIN) {
                let host = req.headers().get(HOST).and_then(|h| h.to_str().ok()).unwrap_or("");
                let origin_host = origin
                    .to_str()
                    .ok()
                    .and_then(|o| o.strip_prefix("http://").or_else(|| o.strip_prefix("https://")))
                    .map(|o| o.split(['/', '?', '#']).next().unwrap_or(""));
                if !origin_host.is_some_and(|o| !o.is_empty() && o.eq_ignore_ascii_case(host)) {
                    return (StatusCode::FORBIDDEN, "Cross-site form submission").into_response();
                }
            }
        }
        next.run(req).await
    }

    // LEPTOS_* env vars (set by cargo-leptos at build time, overridable at runtime); HOST/PORT win for the address.
    let conf = get_configuration(None).unwrap();
    let mut leptos_options = conf.leptos_options;
    let addr = format!("{}:{}", env_or("HOST", "127.0.0.1"), env_or("PORT", "3000"));
    leptos_options.site_addr = addr.parse().unwrap_or_else(|e| panic!("bad HOST/PORT {addr}: {e}"));
    LazyLock::force(&API);

    // Page routes from the <Routes> tree (+ every #[server] function, registered by leptos_routes).
    let routes = generate_route_list(App);

    let app = Router::new()
        .route("/api/posts", post(api_create))
        .route("/api/posts/{id}/like", post(api_like))
        .leptos_routes(&leptos_options, routes, {
            let leptos_options = leptos_options.clone();
            move || shell(leptos_options.clone())
        })
        // Static files from site-root (/pkg/*.js|wasm, /styles.css), else the app's 404 page.
        .fallback(leptos_axum::file_and_error_handler(shell))
        .with_state(leptos_options)
        .layer(axum::middleware::from_fn(same_origin));

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|e| panic!("bind {addr}: {e}"));
    // TCP_NODELAY like ../rust-axum (and Node's default): streamed chunks aren't held back by Nagle.
    let listener = listener.tap_io(|tcp| {
        let _ = tcp.set_nodelay(true);
    });
    let workers = tokio::runtime::Handle::current().metrics().num_workers();
    println!("leptos frontend on http://{addr} (backend {}, tokio workers {workers})", env_or("BACKEND_URL", "http://127.0.0.1:4000"));
    axum::serve(listener, app.into_make_service()).await.expect("server error");
}

#[cfg(not(feature = "ssr"))]
pub fn main() {
    // no client-side main: the WASM entry point is `hydrate()` in lib.rs
}
