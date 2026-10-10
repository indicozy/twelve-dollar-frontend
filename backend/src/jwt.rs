//! Minimal HS256 JWT verification. Every request verifies the signature (no caching, per the rules).

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::Sha256;

pub struct Claims {
    pub user_id: i64,
    pub username: String,
}

pub enum AuthError {
    Missing,
    Invalid,
    Payload,
}

impl AuthError {
    pub fn message(&self) -> &'static str {
        match self {
            AuthError::Missing => "missing bearer token",
            AuthError::Invalid => "invalid or expired token",
            AuthError::Payload => "invalid token payload",
        }
    }
}

pub fn verify(header: Option<&[u8]>, secret: &[u8]) -> Result<Claims, AuthError> {
    let token = header.and_then(|h| h.strip_prefix(b"Bearer ")).ok_or(AuthError::Missing)?;
    let token = std::str::from_utf8(token).map_err(|_| AuthError::Invalid)?;

    let mut parts = token.split('.');
    let (h, p, s) = match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(h), Some(p), Some(s), None) => (h, p, s),
        _ => return Err(AuthError::Invalid),
    };

    let header = URL_SAFE_NO_PAD.decode(h).map_err(|_| AuthError::Invalid)?;
    let header: serde_json::Value = serde_json::from_slice(&header).map_err(|_| AuthError::Invalid)?;
    if header.get("alg").and_then(|a| a.as_str()) != Some("HS256") {
        return Err(AuthError::Invalid);
    }

    let sig = URL_SAFE_NO_PAD.decode(s).map_err(|_| AuthError::Invalid)?;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).map_err(|_| AuthError::Invalid)?;
    mac.update(&token.as_bytes()[..h.len() + 1 + p.len()]);
    mac.verify_slice(&sig).map_err(|_| AuthError::Invalid)?;

    let payload = URL_SAFE_NO_PAD.decode(p).map_err(|_| AuthError::Invalid)?;
    let payload: serde_json::Value = serde_json::from_slice(&payload).map_err(|_| AuthError::Invalid)?;
    let exp = payload.get("exp").and_then(|e| e.as_f64()).ok_or(AuthError::Invalid)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    if exp <= now {
        return Err(AuthError::Invalid);
    }

    let user_id = payload
        .get("sub")
        .and_then(|s| s.as_str())
        .and_then(parse_positive_id)
        .ok_or(AuthError::Payload)?;
    let username = payload.get("username").and_then(|u| u.as_str()).ok_or(AuthError::Payload)?;
    Ok(Claims { user_id, username: username.to_owned() })
}

/// A positive decimal integer with no sign, decimal point or other characters.
pub fn parse_positive_id(s: &str) -> Option<i64> {
    if s.is_empty() || s.len() > 18 || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let n: i64 = s.parse().ok()?;
    (n > 0).then_some(n)
}
