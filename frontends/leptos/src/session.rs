//! Demo login token + cookie reading. Same HS256 header and payload JSON as
//! frontends/sveltekit/src/lib/server/session.ts (the API has no login endpoint).

use std::time::{SystemTime, UNIX_EPOCH};

use axum::http::{header::COOKIE, HeaderMap};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

pub const TOKEN_COOKIE: &str = "token";

#[derive(Serialize)]
struct Claims<'a> {
    sub: String,
    username: &'a str,
    iat: u64,
    exp: u64,
}

/// `{"alg":"HS256","typ":"JWT"}`.`{"sub":"<id>","username":"<name>","iat":..,"exp":..}`.sig, base64url, no padding.
pub fn sign_token(secret: &[u8], user_id: i64, username: &str) -> String {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
    let head = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let claims = Claims { sub: user_id.to_string(), username, iat: now, exp: now + 7 * 86400 };
    let body = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&claims).expect("claims serialize"));
    let signing_input = format!("{head}.{body}");
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(signing_input.as_bytes());
    let sig = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    format!("{signing_input}.{sig}")
}

/// The raw `token` cookie value, if any (first match across all Cookie headers).
pub fn current_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|pair| {
            let (name, value) = pair.trim().split_once('=')?;
            (name == TOKEN_COOKIE && !value.is_empty()).then_some(value)
        })
}

#[derive(Deserialize)]
struct Payload {
    username: Option<String>,
}

/// The `username` claim of the token cookie (decoded, not verified; the API verifies on writes), read per request.
pub fn current_username(headers: &HeaderMap) -> Option<String> {
    let payload = current_token(headers)?.split('.').nth(1)?;
    let json = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    serde_json::from_slice::<Payload>(&json).ok()?.username
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let t = sign_token(b"twelve-dollar-challenge", 21, "golden_ember_21");
        let mut h = HeaderMap::new();
        h.insert(COOKIE, format!("a=b; token={t}").parse().unwrap());
        assert_eq!(current_username(&h).as_deref(), Some("golden_ember_21"));
    }
}
