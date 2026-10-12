//! Leptos frontend for the SSR benchmark (../SPEC.md). One crate, compiled twice by cargo-leptos: the Axum server
//! binary (`ssr`) and the WASM client bundle (`hydrate`) that hydrates the server-rendered HTML.

pub mod app;
pub mod date;

#[cfg(feature = "ssr")]
pub mod api;
#[cfg(feature = "ssr")]
pub mod session;

/// Env var, or the default when unset/empty.
#[cfg(feature = "ssr")]
pub fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_owned())
}

#[cfg(feature = "hydrate")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn hydrate() {
    console_error_panic_hook::set_once();
    leptos::mount::hydrate_body(app::App);
}
