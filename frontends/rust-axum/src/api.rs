//! API client: one shared reqwest client (connection pool + keep-alive) for the whole process.
//! No caching: every call hits the API.

use std::fmt;

use axum::body::Bytes;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Deserialize;

use crate::date;

#[derive(Deserialize)]
pub struct Post {
    pub id: i64,
    pub body: String,
    pub created_at: String,
    pub author: String,
    pub like_count: i64,
}

impl Post {
    /// `Dec 31, 2025, 11:59 PM UTC`, the same text as the JS variants' Intl.DateTimeFormat (written straight
    /// into the template's output buffer, no intermediate String).
    pub fn display_date(&self) -> date::Display<'_> {
        date::Display(&self.created_at)
    }
}

#[derive(Deserialize)]
struct FeedResponse {
    posts: Vec<Post>,
}

#[derive(Deserialize)]
struct PostResponse {
    post: Post,
}

#[derive(Debug)]
pub enum Error {
    Http(reqwest::Error),
    Json(serde_json::Error),
    Status(&'static str, u16),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Http(e) => write!(f, "backend request failed: {e}"),
            Error::Json(e) => write!(f, "backend returned invalid JSON: {e}"),
            Error::Status(what, s) => write!(f, "{what}: backend returned {s}"),
        }
    }
}

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        Error::Http(e)
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Json(e)
    }
}

/// A raw API answer: status + body bytes (passed through unchanged by the /api routes).
pub struct Raw {
    pub status: u16,
    pub body: Bytes,
}

#[derive(Clone)]
pub struct Api {
    client: reqwest::Client,
    base: String,
}

impl Api {
    pub fn new(base: String) -> Self {
        // reqwest keeps idle keep-alive connections per host in its pool (no limit, 90 s idle timeout).
        let client = reqwest::Client::builder().build().expect("reqwest client");
        Api { client, base: base.trim_end_matches('/').to_owned() }
    }

    pub async fn feed(&self) -> Result<Vec<Post>, Error> {
        let res = self.client.get(format!("{}/feed", self.base)).send().await?;
        let status = res.status().as_u16();
        let body = res.bytes().await?;
        if status != 200 {
            return Err(Error::Status("feed", status));
        }
        Ok(serde_json::from_slice::<FeedResponse>(&body)?.posts)
    }

    /// `None` when the API says 404 (missing) or 400 (invalid id).
    pub async fn post(&self, id: &str) -> Result<Option<Post>, Error> {
        let res = self.client.get(format!("{}/posts/{}", self.base, encode_uri_component(id))).send().await?;
        let status = res.status().as_u16();
        let body = res.bytes().await?;
        match status {
            200 => Ok(Some(serde_json::from_slice::<PostResponse>(&body)?.post)),
            404 | 400 => Ok(None),
            s => Err(Error::Status("post", s)),
        }
    }

    /// `authorization` is the full header value ("Bearer <jwt>"), or None to send none.
    pub async fn create_post(&self, authorization: Option<&str>, body: &str) -> Result<Raw, Error> {
        let payload = serde_json::to_vec(&serde_json::json!({ "body": body }))?;
        let mut req = self.client.post(format!("{}/posts", self.base)).header(CONTENT_TYPE, "application/json");
        if let Some(a) = authorization {
            req = req.header(AUTHORIZATION, a);
        }
        let res = req.body(payload).send().await?;
        Ok(Raw { status: res.status().as_u16(), body: res.bytes().await? })
    }

    pub async fn like_post(&self, authorization: Option<&str>, id: &str) -> Result<Raw, Error> {
        let mut req = self.client.post(format!("{}/posts/{}/like", self.base, encode_uri_component(id)));
        if let Some(a) = authorization {
            req = req.header(AUTHORIZATION, a);
        }
        let res = req.send().await?;
        Ok(Raw { status: res.status().as_u16(), body: res.bytes().await? })
    }
}

/// JS `encodeURIComponent`: keep A-Z a-z 0-9 - _ . ! ~ * ' ( ), percent-encode every other UTF-8 byte.
pub fn encode_uri_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push('%');
            out.push(char::from(b"0123456789ABCDEF"[(b >> 4) as usize]));
            out.push(char::from(b"0123456789ABCDEF"[(b & 15) as usize]));
        }
    }
    out
}

/// The `error` field of an API error body, or `error <status>`.
pub fn error_message(raw: &Raw) -> String {
    serde_json::from_slice::<serde_json::Value>(&raw.body)
        .ok()
        .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_owned))
        .unwrap_or_else(|| format!("error {}", raw.status))
}
