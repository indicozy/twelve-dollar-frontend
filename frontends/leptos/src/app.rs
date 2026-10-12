//! The app: shell, layout, pages, and the server functions they call. Shared by the server (SSR) and the WASM client
//! (hydration); `#[server]` bodies only exist in the server build, the client gets an HTTP stub for each.

use leptos::prelude::*;
use leptos_meta::{provide_meta_context, Meta, MetaTags, Stylesheet, Title};
use leptos_router::components::{Route, Router, Routes};
use leptos_router::hooks::use_params_map;
use leptos_router::{path, SsrMode};
use serde::{Deserialize, Serialize};

use crate::date;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Post {
    pub id: i64,
    pub body: String,
    pub created_at: String,
    pub author: String,
    pub like_count: i64,
}

// ---------------------------------------------------------------------------------------------------------------
// Server functions. During SSR a resource calls them in-process; from the browser they are POSTs to /api/<name><hash>.

#[cfg(feature = "ssr")]
fn backend_error(e: crate::api::Error) -> ServerFnError {
    leptos::logging::error!("error: {e}");
    ServerFnError::new(e.to_string())
}

/// The raw `token` cookie of the current request.
#[cfg(feature = "ssr")]
async fn current_token() -> Result<Option<String>, ServerFnError> {
    let headers: axum::http::HeaderMap = leptos_axum::extract().await?;
    Ok(crate::session::current_token(&headers).map(str::to_owned))
}

#[server]
pub async fn get_feed() -> Result<Vec<Post>, ServerFnError> {
    crate::api::API.feed().await.map_err(backend_error)
}

/// `None` when the API says 404/400 (missing or invalid id).
#[server]
pub async fn get_post(id: String) -> Result<Option<Post>, ServerFnError> {
    crate::api::API.post(&id).await.map_err(backend_error)
}

/// The `username` claim of the token cookie (decoded per request, not verified; the API verifies on writes).
#[server]
pub async fn get_username() -> Result<Option<String>, ServerFnError> {
    let headers: axum::http::HeaderMap = leptos_axum::extract().await?;
    Ok(crate::session::current_username(&headers))
}

#[server]
pub async fn like_post(id: String) -> Result<(), ServerFnError> {
    let Some(token) = current_token().await? else {
        leptos_axum::redirect("/login");
        return Ok(());
    };
    crate::api::API.like_post(Some(&format!("Bearer {token}")), &id).await.map_err(backend_error)?;
    Ok(())
}

#[server]
pub async fn create_post(body: String) -> Result<(), ServerFnError> {
    let Some(token) = current_token().await? else {
        leptos_axum::redirect("/login");
        return Ok(());
    };
    let raw = crate::api::API.create_post(Some(&format!("Bearer {token}")), &body).await.map_err(backend_error)?;
    if raw.status != 201 {
        // e.g. "body is required": shown under the compose box
        return Err(ServerFnError::ServerError(crate::api::error_message(&raw)));
    }
    Ok(())
}

/// Signs a demo HS256 token (the API has no login endpoint) into the `token` cookie, then goes to `/`.
#[server]
pub async fn login(user_id: String, username: String) -> Result<(), ServerFnError> {
    use axum::http::{header::SET_COOKIE, HeaderValue};

    // Number(user_id) must be an integer >= 1, and the trimmed username non-empty (same rule as the other variants).
    let id = user_id.trim().parse::<f64>().ok().filter(|n| n.fract() == 0.0 && *n >= 1.0 && *n <= 9_007_199_254_740_991.0);
    let username = username.trim();
    let (Some(id), false) = (id, username.is_empty()) else {
        leptos_axum::redirect("/login?error=1");
        return Ok(());
    };
    let secret = crate::env_or("JWT_SECRET", "twelve-dollar-challenge");
    let token = crate::session::sign_token(secret.as_bytes(), id as i64, username);
    let cookie = format!("{}={token}; Path=/; HttpOnly; SameSite=Lax", crate::session::TOKEN_COOKIE);
    let cookie = HeaderValue::from_str(&cookie).map_err(|e| ServerFnError::new(e.to_string()))?;
    expect_context::<leptos_axum::ResponseOptions>().insert_header(SET_COOKIE, cookie);
    leptos_axum::redirect("/");
    Ok(())
}

// ---------------------------------------------------------------------------------------------------------------
// Document + layout

pub fn shell(options: LeptosOptions) -> impl IntoView {
    view! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <HydrationScripts options/>
                <MetaTags/>
            </head>
            <body>
                <App/>
            </body>
        </html>
    }
}

#[component]
pub fn App() -> impl IntoView {
    provide_meta_context();
    // Shared mutations: pages refetch their data when one of these completes (version bump).
    provide_context(ServerAction::<LikePost>::new());
    provide_context(ServerAction::<Login>::new());

    view! {
        <Stylesheet href="/styles.css"/>
        <Title text="Feed · Leptos"/>
        <Meta name="description" content="SSR benchmark app: Leptos frontend over a Rust + SQLite feed API"/>
        <Router>
            <header class="top">
                <a href="/" class="brand">"feed"<span>"."</span></a>
                <span class="stack">"leptos"</span>
                <nav><Who/></nav>
            </header>
            <main>
                <Routes fallback=|| view! { <NotFound/> }>
                    // SsrMode::Async on every page: resolve all resources (feed/post + the header's username) and send
                    // the finished document in one piece, with the posts in place inside <section class="feed">
                    // (same markup as the other variants). Leptos' default out-of-order streaming would instead send
                    // the shell first and the posts later in <template> chunks after </html>, swapped in by inline JS.
                    // It also lets a missing post answer a real 404 and an API failure a 500.
                    <Route path=path!("") view=FeedPage ssr=SsrMode::Async/>
                    <Route path=path!("/posts/:id") view=PostPage ssr=SsrMode::Async/>
                    <Route path=path!("/login") view=LoginPage ssr=SsrMode::Async/>
                </Routes>
            </main>
        </Router>
    }
}

/// `@username` from the token cookie (read on the server for every request), or "Sign in".
#[component]
fn Who() -> impl IntoView {
    let login = expect_context::<ServerAction<Login>>();
    let name = Resource::new(move || login.version().get(), |_| get_username());
    view! {
        <Suspense>
            {move || Suspend::new(async move {
                match name.await {
                    Ok(Some(n)) => view! { <span class="who">"@"{n}</span> }.into_any(),
                    _ => view! { <a href="/login">"Sign in"</a> }.into_any(),
                }
            })}
        </Suspense>
    }
}

#[component]
fn NotFound() -> impl IntoView {
    #[cfg(feature = "ssr")]
    if let Some(res) = use_context::<leptos_axum::ResponseOptions>() {
        res.set_status(axum::http::StatusCode::NOT_FOUND);
    }
    view! {
        <div class="empty">
            <h1>"Not found"</h1>
            <a href="/">"← back to feed"</a>
        </div>
    }
}

/// API unreachable / unexpected status. 500 (every route is `SsrMode::Async`, so the status can still be set).
#[component]
fn LoadError(error: ServerFnError) -> impl IntoView {
    #[cfg(feature = "ssr")]
    if let Some(res) = use_context::<leptos_axum::ResponseOptions>() {
        res.set_status(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
    }
    let _ = error;
    view! { <p class="error">"Something went wrong."</p> }
}

// ---------------------------------------------------------------------------------------------------------------
// Pages

#[component]
fn PostCard(post: Post, link: bool) -> impl IntoView {
    let like = expect_context::<ServerAction<LikePost>>();
    let id = post.id;
    let when = date::Display(&post.created_at).to_string();
    view! {
        <article class="post" data-post-id=id>
            <header>
                <span class="author">"@"{post.author}</span>
                <time datetime=post.created_at>{when}</time>
            </header>
            <p>{post.body}</p>
            <footer>
                <ActionForm action=like>
                    <input type="hidden" name="id" value=id/>
                    <button type="submit" class="like">"♥ "<span>{post.like_count}</span></button>
                </ActionForm>
                {if link {
                    view! { <a href=format!("/posts/{id}")>"#"{id}</a> }.into_any()
                } else {
                    view! { <span class="muted">"#"{id}</span> }.into_any()
                }}
            </footer>
        </article>
    }
}

#[component]
fn Compose(action: ServerAction<CreatePost>) -> impl IntoView {
    let pending = action.pending();
    view! {
        <ActionForm action attr:class="compose">
            <textarea name="body" maxlength="500" placeholder="What's happening on the $12 server?" required rows="3"></textarea>
            <div>
                {move || match action.value().get() {
                    Some(Err(ServerFnError::ServerError(msg))) => view! { <span class="error">{msg}</span> }.into_any(),
                    Some(Err(e)) => view! { <span class="error">{e.to_string()}</span> }.into_any(),
                    _ => view! { <span class="muted">"max 500 chars"</span> }.into_any(),
                }}
                <button type="submit" disabled=move || pending.get()>
                    {move || if pending.get() { "Posting…" } else { "Post" }}
                </button>
            </div>
        </ActionForm>
    }
}

#[component]
fn FeedPage() -> impl IntoView {
    let like = expect_context::<ServerAction<LikePost>>();
    let create = ServerAction::<CreatePost>::new();
    let posts = Resource::new(move || (create.version().get(), like.version().get()), |_| get_feed());
    view! {
        <Compose action=create/>
        <h1>"Latest"</h1>
        <section class="feed">
            <Transition>
                {move || Suspend::new(async move {
                    match posts.await {
                        Ok(posts) => posts
                            .into_iter()
                            .map(|post| view! { <PostCard post link=true/> })
                            .collect_view()
                            .into_any(),
                        Err(error) => view! { <LoadError error/> }.into_any(),
                    }
                })}
            </Transition>
        </section>
    }
}

#[component]
fn PostPage() -> impl IntoView {
    let like = expect_context::<ServerAction<LikePost>>();
    let params = use_params_map();
    let post = Resource::new(
        move || (params.read().get("id").unwrap_or_default(), like.version().get()),
        |(id, _)| get_post(id),
    );
    view! {
        <Transition>
            {move || Suspend::new(async move {
                match post.await {
                    Ok(Some(post)) => view! {
                        <a href="/" class="back">"← back to feed"</a>
                        <PostCard post link=false/>
                    }
                    .into_any(),
                    Ok(None) => view! { <NotFound/> }.into_any(),
                    Err(error) => view! { <LoadError error/> }.into_any(),
                }
            })}
        </Transition>
    }
}

#[component]
fn LoginPage() -> impl IntoView {
    let login = expect_context::<ServerAction<Login>>();
    view! {
        <ActionForm action=login attr:class="login">
            <h1>"Sign in"</h1>
            <p class="muted">
                "The API has no login endpoint; this signs a demo HS256 token (like the challenge's seed tokens)."
            </p>
            <label>"User id "<input name="user_id" type="number" min="1" value="1" required/></label>
            <label>"Username "<input name="username" value="golden_ember_1" required/></label>
            <button type="submit">"Continue"</button>
        </ActionForm>
    }
}
