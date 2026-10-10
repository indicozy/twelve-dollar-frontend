//! Hand-written compact JSON output: the shapes are fixed, so skip serde on the hot path.

#[inline]
pub fn int(out: &mut Vec<u8>, v: i64) {
    out.extend_from_slice(itoa::Buffer::new().format(v).as_bytes());
}

/// Writes `s` as a JSON string literal. Only `"`, `\` and control characters need escaping;
/// everything else (including non-ASCII) goes out as raw UTF-8.
pub fn string(out: &mut Vec<u8>, s: &str) {
    out.push(b'"');
    let bytes = s.as_bytes();
    let mut start = 0;
    for (i, &b) in bytes.iter().enumerate() {
        let esc: &[u8] = match b {
            b'"' => b"\\\"",
            b'\\' => b"\\\\",
            b'\n' => b"\\n",
            b'\r' => b"\\r",
            b'\t' => b"\\t",
            0x08 => b"\\b",
            0x0c => b"\\f",
            0x00..=0x1f => {
                out.extend_from_slice(&bytes[start..i]);
                const HEX: &[u8; 16] = b"0123456789abcdef";
                out.extend_from_slice(&[b'\\', b'u', b'0', b'0', HEX[(b >> 4) as usize], HEX[(b & 0xf) as usize]]);
                start = i + 1;
                continue;
            }
            _ => continue,
        };
        out.extend_from_slice(&bytes[start..i]);
        out.extend_from_slice(esc);
        start = i + 1;
    }
    out.extend_from_slice(&bytes[start..]);
    out.push(b'"');
}

pub fn post(out: &mut Vec<u8>, id: i64, body: &str, created_at: &str, author: &str, like_count: i64) {
    out.extend_from_slice(b"{\"id\":");
    int(out, id);
    out.extend_from_slice(b",\"body\":");
    string(out, body);
    out.extend_from_slice(b",\"created_at\":");
    string(out, created_at);
    out.extend_from_slice(b",\"author\":");
    string(out, author);
    out.extend_from_slice(b",\"like_count\":");
    int(out, like_count);
    out.push(b'}');
}
