//! The privacy gate every render passes through.
//!
//! The rule it enforces: student, staff and school data never appears in an
//! image these tools produce — captures use fake or redacted data, and the
//! school is never named. Three hooks, all run by [`crate::render::render`]
//! before anything is drawn:
//!
//! 1. **Attestation.** A render that includes a screenshot must say the
//!    screenshot holds only fake or already-redacted data. There is no
//!    default: forgetting is a refusal, not a pass.
//! 2. **Blocked terms.** Every piece of text (headline, eyebrow, CTA, alt
//!    text…) is checked, case-insensitively, against a list of terms that
//!    must never appear — school names, staff names. The list lives outside
//!    the repo (`NYUCHI_BLOCKED_TERMS_FILE` for the CLI) because writing a
//!    school's name into the repo to keep it out of images would defeat the
//!    point.
//! 3. **Redaction boxes.** `SourceImage::redact` rectangles are painted as
//!    skeleton bars over the screenshot before it is composed, so the
//!    rendered file never contains what is under them. This is a backstop:
//!    redacting in the page before capture remains the primary rule.

use crate::layout::Content;
use std::fmt;

#[derive(Clone, Debug, Default)]
pub struct Privacy {
    /// The source screenshot holds only fake or already-redacted data.
    pub fake_or_redacted: bool,
    /// Terms that must never appear in any text on the image.
    pub blocked_terms: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum PrivacyError {
    NotAttested,
    BlockedTerm { field: &'static str },
}

impl fmt::Display for PrivacyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PrivacyError::NotAttested => write!(
                f,
                "this render includes a screenshot, but it is not marked as fake or redacted \
                 data (privacy.fake_or_redacted / --fake-or-redacted). Redact names, IDs, \
                 emails, photos and the school name in the page before capturing."
            ),
            // The term itself is deliberately not echoed: it is the thing
            // being kept out of logs and images.
            PrivacyError::BlockedTerm { field } => write!(
                f,
                "the {field} contains a blocked term (from the blocked-terms list). \
                 Remove it — school, student and staff names never appear in an image."
            ),
        }
    }
}

impl std::error::Error for PrivacyError {}

impl Privacy {
    /// Parse a blocked-terms list: one term per line, `#` comments allowed.
    pub fn terms_from_str(list: &str) -> Vec<String> {
        list.lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .map(str::to_string)
            .collect()
    }

    /// Run hooks 1 and 2. Hook 3 is applied in the SVG by construction.
    pub fn check(&self, content: &Content) -> Result<(), PrivacyError> {
        if content.image.is_some() && !self.fake_or_redacted {
            return Err(PrivacyError::NotAttested);
        }
        for (field, text) in content.texts() {
            let lower = text.to_lowercase();
            if self
                .blocked_terms
                .iter()
                .any(|term| !term.is_empty() && lower.contains(&term.to_lowercase()))
            {
                return Err(PrivacyError::BlockedTerm { field });
            }
        }
        Ok(())
    }
}
