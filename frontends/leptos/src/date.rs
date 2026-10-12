//! Date text identical to the JS variants'
//! `new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })` + " UTC",
//! e.g. `Dec 31, 2025, 11:59 PM UTC` and `Jan 5, 2025, 9:05 AM UTC`.

use std::fmt;

use time::format_description::well_known::Rfc3339;
use time::{OffsetDateTime, UtcOffset};

const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/// Formats a stored `created_at` (RFC 3339, e.g. `2025-12-31T23:59:19.409Z`) when written into a template.
pub struct Display<'a>(pub &'a str);

impl fmt::Display for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Ok(t) = OffsetDateTime::parse(self.0, &Rfc3339) else {
            // Never happens with the API's data; show the raw value rather than failing the page.
            return f.write_str(self.0);
        };
        let t = t.to_offset(UtcOffset::UTC);
        let month = MONTHS[u8::from(t.month()) as usize - 1];
        let (hour, ampm) = match t.hour() {
            0 => (12, "AM"),
            h @ 1..=11 => (h, "AM"),
            12 => (12, "PM"),
            h => (h - 12, "PM"),
        };
        write!(f, "{month} {}, {}, {hour}:{:02} {ampm} UTC", t.day(), t.year(), t.minute())
    }
}

#[cfg(test)]
mod tests {
    use super::Display;

    #[test]
    fn matches_intl() {
        let cases = [
            ("2025-12-31T23:59:19.409Z", "Dec 31, 2025, 11:59 PM UTC"),
            ("2025-01-05T09:05:00Z", "Jan 5, 2025, 9:05 AM UTC"),
            ("2025-03-01T00:00:00Z", "Mar 1, 2025, 12:00 AM UTC"),
            ("2025-03-01T12:30:00Z", "Mar 1, 2025, 12:30 PM UTC"),
        ];
        for (input, want) in cases {
            assert_eq!(Display(input).to_string(), want);
        }
    }
}
