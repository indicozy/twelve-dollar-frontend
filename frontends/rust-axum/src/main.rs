//! Rust / Axum + Askama frontend for the SSR benchmark (../SPEC.md). Every page is rendered on every request from a
//! fresh API call; nothing is cached. Pages ship zero JS: likes, posts and sign-in are plain HTML forms that post to
//! handlers here and get a 303 back (Post/Redirect/Get).

mod api;
mod date;
mod session;

use std::sync::Arc;

use askama::Template;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, HOST, LOCATION, ORIGIN, REFERER, SET_COOKIE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::serve::ListenerExt;
use axum::{Form, Router};
use serde::Deserialize;

use crate::api::{Api, Post};

struct AppState {
    api: Api,
    jwt_secret: Vec<u8>,
}

type AppStateRef = State<Arc<AppState>>;

// ---------------------------------------------------------------------------------------------------------------
// Templates (compiled into Rust code at build time by askama's derive; rendering writes into one String)

#[derive(Template)]
#[template(path = "index.html")]
struct FeedPage<'a> {
    username: Option<String>,
    error: Option<&'a str>,
    posts: &'a [Post],
}

#[derive(Template)]
#[template(path = "post.html")]
struct PostPage<'a> {
    username: Option<String>,
    post: &'a Post,
}

#[derive(Template)]
#[template(path = "login.html")]
struct LoginPage {
    username: Option<String>,
}

#[derive(Template)]
#[template(path = "not_found.html")]
struct NotFoundPage {
    username: Option<String>,
}

const STYLES: &str = include_str!("../static/styles.css");

// ---------------------------------------------------------------------------------------------------------------
// Errors: API unreachable / unexpected status / render failure -> 500 (logged)

struct AppError(String);

impl<E: std::fmt::Display> From<E> for AppError {
    fn from(e: E) -> Self {
        AppError(e.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        eprintln!("error: {}", self.0);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
    }
}

type PageResult = Result<Response, AppError>;

fn html(status: StatusCode, t: &impl Template) -> PageResult {
    Ok((status, Html(t.render()?)).into_response())
}

fn see_other(to: &str) -> Response {
    let location = HeaderValue::from_str(to).unwrap_or_else(|_| HeaderValue::from_static("/"));
    (StatusCode::SEE_OTHER, [(LOCATION, location)]).into_response()
}

fn json(status: u16, body: Bytes) -> Response {
    let status = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
    (status, [(CONTENT_TYPE, HeaderValue::from_static("application/json"))], body).into_response()
}

// ---------------------------------------------------------------------------------------------------------------
// Pages

#[derive(Deserialize)]
struct FeedQuery {
    error: Option<String>,
}

async fn feed_page(State(s): AppStateRef, headers: HeaderMap, Query(q): Query<FeedQuery>) -> PageResult {
    let posts = s.api.feed().await?;
    let page = FeedPage { username: session::current_username(&headers), error: q.error.as_deref(), posts: &posts };
    html(StatusCode::OK, &page)
}

async fn post_page(State(s): AppStateRef, headers: HeaderMap, Path(id): Path<String>) -> PageResult {
    let username = session::current_username(&headers);
    match s.api.post(&id).await? {
        Some(post) => html(StatusCode::OK, &PostPage { username, post: &post }),
        None => html(StatusCode::NOT_FOUND, &NotFoundPage { username }),
    }
}

async fn login_page(headers: HeaderMap) -> PageResult {
    html(StatusCode::OK, &LoginPage { username: session::current_username(&headers) })
}

async fn not_found(headers: HeaderMap) -> PageResult {
    html(StatusCode::NOT_FOUND, &NotFoundPage { username: session::current_username(&headers) })
}

async fn styles() -> impl IntoResponse {
    ([(CONTENT_TYPE, HeaderValue::from_static("text/css; charset=utf-8"))], STYLES)
}

// ---------------------------------------------------------------------------------------------------------------
// Form handlers (plain HTML form posts, 303 back)

/// Same rule as the Nuxt variant (and Next.js server actions): if an Origin header is present, its host must equal
/// the Host header, else 403. Requests without Origin (curl, old clients) pass. Not applied to the JSON /api routes.
fn cross_site(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(ORIGIN) else { return false };
    let origin_host = origin.to_str().ok().and_then(url_host);
    let host = headers.get(HOST).and_then(|h| h.to_str().ok());
    !matches!((origin_host, host), (Some(o), Some(h)) if o.eq_ignore_ascii_case(h))
}

fn forbidden() -> Response {
    (StatusCode::FORBIDDEN, "Cross-site form submission").into_response()
}

/// `host[:port]` of an absolute http(s) URL.
fn url_host(url: &str) -> Option<&str> {
    let rest = url.strip_prefix("http://").or_else(|| url.strip_prefix("https://"))?;
    let host = rest.split(['/', '?', '#']).next()?;
    (!host.is_empty()).then_some(host)
}

/// Path of the same-host page the form was posted from (Referer), else `/`.
fn back_to(headers: &HeaderMap) -> String {
    let referer = headers.get(REFERER).and_then(|v| v.to_str().ok());
    let host = headers.get(HOST).and_then(|h| h.to_str().ok());
    if let (Some(referer), Some(host)) = (referer, host) {
        if url_host(referer).is_some_and(|h| h.eq_ignore_ascii_case(host)) {
            let rest = &referer[referer.find("//").map_or(0, |i| i + 2)..];
            let path = rest.find('/').map_or("/", |i| &rest[i..]);
            let path = path.split(['?', '#']).next().unwrap_or("/");
            return if path.is_empty() { "/".to_owned() } else { path.to_owned() };
        }
    }
    "/".to_owned()
}

#[derive(Deserialize)]
struct LikeForm {
    id: Option<String>,
}

async fn like_action(State(s): AppStateRef, headers: HeaderMap, Form(form): Form<LikeForm>) -> PageResult {
    if cross_site(&headers) {
        return Ok(forbidden());
    }
    let Some(token) = session::current_token(&headers) else { return Ok(see_other("/login")) };
    // String(form.get("id")) in the JS variants: a missing id becomes "null", which the API rejects.
    let id = form.id.as_deref().unwrap_or("null");
    s.api.like_post(Some(&format!("Bearer {token}")), id).await?;
    Ok(see_other(&back_to(&headers)))
}

#[derive(Deserialize)]
struct CreateForm {
    body: Option<String>,
}

async fn create_action(State(s): AppStateRef, headers: HeaderMap, Form(form): Form<CreateForm>) -> PageResult {
    if cross_site(&headers) {
        return Ok(forbidden());
    }
    let Some(token) = session::current_token(&headers) else { return Ok(see_other("/login")) };
    let raw = s.api.create_post(Some(&format!("Bearer {token}")), form.body.as_deref().unwrap_or("")).await?;
    if raw.status != 201 {
        // Shown on the feed via ?error= (like the Nuxt and Angular variants).
        let msg = api::error_message(&raw);
        return Ok(see_other(&format!("/?error={}", api::encode_uri_component(&msg))));
    }
    Ok(see_other("/"))
}

#[derive(Deserialize)]
struct LoginForm {
    user_id: Option<String>,
    username: Option<String>,
}

async fn login_action(State(s): AppStateRef, headers: HeaderMap, Form(form): Form<LoginForm>) -> Response {
    if cross_site(&headers) {
        return forbidden();
    }
    // Number(form.get("user_id")) must be an integer >= 1, and the trimmed username non-empty.
    let id = form.user_id.as_deref().map(str::trim).and_then(|v| v.parse::<f64>().ok());
    let username = form.username.as_deref().unwrap_or("").trim();
    let Some(id) = id.filter(|n| n.fract() == 0.0 && *n >= 1.0 && *n <= 9_007_199_254_740_991.0) else {
        return see_other("/login?error=1");
    };
    if username.is_empty() {
        return see_other("/login?error=1");
    }
    let token = session::sign_token(&s.jwt_secret, id as i64, username);
    let cookie = format!("{}={token}; Path=/; HttpOnly; SameSite=Lax", session::TOKEN_COOKIE);
    let mut res = see_other("/");
    match HeaderValue::from_str(&cookie) {
        Ok(v) => {
            res.headers_mut().insert(SET_COOKIE, v);
            res
        }
        Err(_) => see_other("/login?error=1"),
    }
}

// ---------------------------------------------------------------------------------------------------------------
// JSON passthrough for the load test (Authorization forwarded as-is, API status + body returned unchanged)

fn authorization(headers: &HeaderMap) -> Option<&str> {
    headers.get(AUTHORIZATION).and_then(|v| v.to_str().ok())
}

/// JS `String(value ?? "")` for the `body` field.
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

async fn api_create(State(s): AppStateRef, headers: HeaderMap, body: Bytes) -> PageResult {
    // Parsed strictly from the raw bytes (Axum's Json extractor would answer with its own status and text).
    // `(await request.json()).body` in the JS variants: a JSON null root throws (400), other roots have no `body`.
    let text = match serde_json::from_slice::<serde_json::Value>(&body) {
        Ok(serde_json::Value::Null) | Err(_) => {
            return Ok(json(400, Bytes::from_static(br#"{"error":"malformed JSON body"}"#)));
        }
        Ok(v) => js_string(v.as_object().and_then(|o| o.get("body"))),
    };
    let raw = s.api.create_post(authorization(&headers), &text).await?;
    Ok(json(raw.status, raw.body))
}

async fn api_like(State(s): AppStateRef, headers: HeaderMap, Path(id): Path<String>) -> PageResult {
    let raw = s.api.like_post(authorization(&headers), &id).await?;
    Ok(json(raw.status, raw.body))
}

// ---------------------------------------------------------------------------------------------------------------

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_owned())
}

#[tokio::main]
async fn main() {
    let backend = env_or("BACKEND_URL", "http://127.0.0.1:4000");
    let state = Arc::new(AppState {
        api: Api::new(backend.clone()),
        jwt_secret: env_or("JWT_SECRET", "twelve-dollar-challenge").into_bytes(),
    });

    let app = Router::new()
        .route("/", get(feed_page))
        .route("/posts/{id}", get(post_page))
        .route("/login", get(login_page).post(login_action))
        .route("/actions/like", post(like_action))
        .route("/actions/create", post(create_action))
        .route("/api/posts", post(api_create))
        .route("/api/posts/{id}/like", post(api_like))
        .route("/styles.css", get(styles))
        .fallback(not_found)
        .with_state(state);

    let addr = format!("{}:{}", env_or("HOST", "127.0.0.1"), env_or("PORT", "3000"));
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|e| panic!("bind {addr}: {e}"));
    let listener = listener.tap_io(|tcp| {
        let _ = tcp.set_nodelay(true);
    });
    let workers = tokio::runtime::Handle::current().metrics().num_workers();
    println!("rust-axum frontend on http://{addr} (backend {backend}, tokio workers {workers})");
    axum::serve(listener, app).await.expect("server error");
}
