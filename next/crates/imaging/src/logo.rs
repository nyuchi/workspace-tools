//! Official brand logos, embedded as published.
//!
//! A logo is never redrawn: each entry is the brand's own file, copied
//! byte-for-byte from where the brand publishes it, and drawn as an image.
//! Adding a brand is a file in `next/assets/logos/` and a line here; the
//! provenance of every file is in `next/assets/logos/README.md`.

pub struct Logo {
    pub id: &'static str,
    pub mime: &'static str,
    pub bytes: &'static [u8],
}

const LOGOS: &[Logo] = &[Logo {
    id: "bundu",
    mime: "image/png",
    // www.bundu.org/logo.png (bundu-labs/marketing apps/bundu/public/logo.png)
    bytes: include_bytes!("../../../assets/logos/bundu.png"),
}];

pub fn all() -> &'static [Logo] {
    LOGOS
}

pub fn get(id: &str) -> Option<&'static Logo> {
    LOGOS.iter().find(|l| l.id == id)
}
