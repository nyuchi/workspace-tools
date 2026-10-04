//! The nyuchi-tools Worker, on workers-rs.
//!
//! One Worker serves the Astro site (static assets) and the API under
//! `/api/`. The API is plain Rust in [`api`] — tested natively — and
//! `entry` is the wasm-only fetch handler around it. [`mcp`] serves the
//! same routes as MCP tools at `/mcp`.
//!
//! Not deployed yet: `next/wrangler.toml` gives it no route and no
//! `workers.dev` URL, because the API has no login yet (phase 3 adds the
//! WorkOS gate). It runs under `wrangler dev`.

pub mod api;
pub mod mcp;
pub mod zip;

#[cfg(target_arch = "wasm32")]
mod entry;
