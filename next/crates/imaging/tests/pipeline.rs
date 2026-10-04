use nyuchi_imaging::layout::{self, Content, SourceImage};
use nyuchi_imaging::preset::{self, Format};
use nyuchi_imaging::privacy::{Privacy, PrivacyError};
use nyuchi_imaging::render::{self, RenderError, Request};
use nyuchi_imaging::theme::{self, Mode, STRIP_ORDER};
use nyuchi_imaging::{Rect, alt, campaign};
use std::collections::HashSet;

/// A synthetic screenshot: a solid colour, so a test can tell whether a
/// pixel came from the image or from something painted over it.
fn png(w: u32, h: u32, rgb: [u8; 3]) -> Vec<u8> {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, w, h);
        enc.set_color(png::ColorType::Rgb);
        enc.set_depth(png::BitDepth::Eight);
        let mut wr = enc.write_header().unwrap();
        let data: Vec<u8> = (0..w * h).flat_map(|_| rgb).collect();
        wr.write_image_data(&data).unwrap();
    }
    out
}

fn decode_png(bytes: &[u8]) -> (png::OutputInfo, Vec<u8>) {
    let mut reader = png::Decoder::new(std::io::Cursor::new(bytes))
        .read_info()
        .unwrap();
    let mut buf = vec![0; reader.output_buffer_size().unwrap()];
    let info = reader.next_frame(&mut buf).unwrap();
    buf.truncate(info.buffer_size());
    (info, buf)
}

fn screenshot(w: u32, h: u32) -> SourceImage {
    let mut img = SourceImage::from_bytes(png(w, h, [40, 90, 160])).unwrap();
    img.chrome = Some("example.test".into());
    img
}

fn full_content(image: Option<SourceImage>) -> Content {
    Content {
        headline: "Every criterion, in its own column.".into(),
        sub: Some("Every rubric criterion for every student, at once.".into()),
        points: vec![
            "Rubrics as columns".into(),
            "Flags hidden in one click".into(),
        ],
        cta: Some("learning.nyuchi.com".into()),
        image_alt: image
            .as_ref()
            .map(|_| "A gradebook with fake students".into()),
        image,
        ..Content::default()
    }
}

fn attested() -> Privacy {
    Privacy {
        fake_or_redacted: true,
        blocked_terms: vec![],
    }
}

// ── The catalogue ──────────────────────────────────────────────────────

#[test]
fn preset_ids_are_unique_and_sizes_sane() {
    let mut ids = HashSet::new();
    for p in preset::catalogue() {
        assert!(ids.insert(p.id.clone()), "duplicate preset id {}", p.id);
        assert!(p.width >= 16 && p.height >= 16, "{}", p.id);
        let safe = p.safe_rect();
        assert!(safe.w > 0.0 && safe.h > 0.0, "{} safe area is empty", p.id);
    }
}

#[test]
fn story_is_1080x1920_with_platform_safe_areas() {
    let story = preset::get("story").expect("story preset");
    assert_eq!((story.width, story.height), (1080, 1920));
    assert_eq!(story.safe, [250, 64, 340, 64]);
    assert_eq!(story.safe_rect(), Rect::new(64.0, 250.0, 952.0, 1330.0));
    let reel = preset::get("reel-cover").expect("reel-cover preset");
    assert_eq!((reel.width, reel.height), (1080, 1920));
    assert!(reel.has_safe_area());
}

#[test]
fn every_size_the_old_pipelines_rendered_is_carried_over() {
    // Toddle extension store renders, its 1200x630 social frames, the Shopify
    // images, and every Nyuchi Studio format.
    let wanted = [
        (1280, 800),
        (640, 400),
        (440, 280),
        (1400, 560),
        (1600, 1600),
        (1200, 630),
        (1080, 1080),
        (1080, 1920),
        (1600, 900),
        (1200, 627),
    ];
    for (w, h) in wanted {
        assert!(
            preset::catalogue()
                .iter()
                .any(|p| p.width == w && p.height == h),
            "no preset for {w}x{h}"
        );
    }
}

#[test]
fn chrome_web_store_presets_are_jpeg() {
    for p in preset::catalogue()
        .iter()
        .filter(|p| p.id.starts_with("cws-"))
    {
        assert_eq!(
            p.format,
            Format::Jpeg,
            "{} must be JPEG (the store rejects alpha)",
            p.id
        );
        assert!(!p.alpha);
    }
}

// ── Rendering ──────────────────────────────────────────────────────────

#[test]
fn every_preset_renders_at_its_exact_size_and_format() {
    let theme = theme::get(theme::DEFAULT_THEME).unwrap();
    let img = screenshot(1200, 640);
    for p in preset::catalogue() {
        let content = full_content(Some(img.clone()));
        let out = render::render(&Request {
            preset: p,
            theme,
            mode: Mode::Light,
            content: &content,
            privacy: &attested(),
            guides: false,
        })
        .unwrap_or_else(|e| panic!("{}: {e}", p.id));
        let size = imagesize::blob_size(&out.bytes).unwrap();
        assert_eq!(
            (size.width as u32, size.height as u32),
            (p.width, p.height),
            "{}",
            p.id
        );
        assert!(
            out.bytes.len() as u64 <= p.max_bytes,
            "{} over its byte limit",
            p.id
        );
        match p.format {
            Format::Jpeg => assert_eq!(&out.bytes[..2], &[0xFF, 0xD8], "{} is not JPEG", p.id),
            Format::Png => {
                let (info, _) = decode_png(&out.bytes);
                let has_alpha = matches!(
                    info.color_type,
                    png::ColorType::Rgba | png::ColorType::GrayscaleAlpha
                );
                assert_eq!(has_alpha, p.alpha, "{} alpha channel", p.id);
            }
        }
    }
}

#[test]
fn content_stays_inside_the_safe_area_and_does_not_overlap() {
    let shapes = [Some((1200, 640)), Some((380, 840)), Some((1600, 300)), None];
    for p in preset::catalogue() {
        let safe = p.safe_rect();
        for shape in shapes {
            let content = full_content(shape.map(|(w, h)| screenshot(w, h)));
            let l = layout::layout(p, &content, "Toddle Enhancement Extension");
            let boxes = l.content_boxes();
            for (name, b) in &boxes {
                assert!(
                    safe.contains(b),
                    "{} {shape:?}: {name} {b:?} leaves safe area {safe:?}",
                    p.id
                );
            }
            // Distinct blocks must not overlap (a point's dot and its text,
            // and the mark's own columns, are one block each).
            let solid: Vec<_> = boxes
                .iter()
                .filter(|(n, _)| !matches!(*n, "point-dot" | "cta-arrow"))
                .filter(|(_, b)| b.w > 0.0 && b.h > 0.0)
                .collect();
            for (i, (na, a)) in solid.iter().enumerate() {
                for (nb, b) in solid.iter().skip(i + 1) {
                    if na == nb && (*na == "mark" || *na == "point") {
                        continue;
                    }
                    let overlap = a.x < b.right() - 1.0
                        && b.x < a.right() - 1.0
                        && a.y < b.bottom() - 1.0
                        && b.y < a.bottom() - 1.0;
                    assert!(
                        !overlap,
                        "{} {shape:?}: {na} {a:?} overlaps {nb} {b:?}",
                        p.id
                    );
                }
            }
        }
    }
}

#[test]
fn story_text_keeps_clear_of_the_top_and_bottom_bands() {
    let story = preset::get("story").unwrap();
    let l = layout::layout(story, &full_content(Some(screenshot(1200, 640))), "x");
    for (name, b) in l.content_boxes() {
        assert!(b.y >= 250.0, "{name} starts in the top 250px");
        assert!(
            b.bottom() <= 1920.0 - 340.0,
            "{name} ends in the bottom 340px"
        );
    }
}

#[test]
fn guides_overlay_only_when_asked() {
    let story = preset::get("story").unwrap();
    let theme = theme::get(theme::DEFAULT_THEME).unwrap();
    let content = full_content(None);
    let svg = |guides| {
        render::build_svg(&Request {
            preset: story,
            theme,
            mode: Mode::Light,
            content: &content,
            privacy: &attested(),
            guides,
        })
        .unwrap()
        .1
    };
    assert!(svg(true).contains("PLATFORM UI · TOP 250px"));
    assert!(svg(true).contains("BOTTOM 340px"));
    assert!(!svg(false).contains("PLATFORM UI"));
}

// ── Themes ─────────────────────────────────────────────────────────────

#[test]
fn theme_colours_are_applied_per_mode() {
    let theme = theme::get(theme::DEFAULT_THEME).unwrap();
    let p = preset::get("og").unwrap();
    let content = full_content(None);
    let build = |mode| {
        render::build_svg(&Request {
            preset: p,
            theme,
            mode,
            content: &content,
            privacy: &attested(),
            guides: false,
        })
        .unwrap()
        .1
    };
    let light = build(Mode::Light);
    let dark = build(Mode::Dark);
    assert!(light.contains(&format!(r#"fill="{}""#, theme.light.bg)));
    assert!(dark.contains(&format!(r#"fill="{}""#, theme.dark.bg)));
    assert!(light.contains(&format!(r#"fill="{}""#, theme.light.fg)));
    assert!(dark.contains(&format!(r#"fill="{}""#, theme.dark.fg)));
    for name in STRIP_ORDER {
        assert!(light.contains(theme.vivid(name)), "strip lacks {name}");
    }
}

#[test]
fn default_theme_matches_mzizi_base_surfaces() {
    let t = theme::get(theme::DEFAULT_THEME).unwrap();
    assert_eq!(t.id, "toddle-launch");
    assert_eq!(t.light.bg, "#F3F3F1");
    assert_eq!(t.dark.bg, "#0E0D0C");
    assert_eq!(theme::mineral("gold").unwrap().dark, "#FFD740");
    assert_eq!(theme::mineral("cobalt").unwrap().dark, "#00B0FF");
}

// ── Privacy hooks ──────────────────────────────────────────────────────

fn request<'a>(p: &'a preset::Preset, content: &'a Content, privacy: &'a Privacy) -> Request<'a> {
    Request {
        preset: p,
        theme: theme::get(theme::DEFAULT_THEME).unwrap(),
        mode: Mode::Light,
        content,
        privacy,
        guides: false,
    }
}

#[test]
fn a_screenshot_without_attestation_is_refused() {
    let p = preset::get("story").unwrap();
    let content = full_content(Some(screenshot(400, 200)));
    let privacy = Privacy::default();
    match render::render(&request(p, &content, &privacy)) {
        Err(RenderError::Privacy(PrivacyError::NotAttested)) => {}
        Err(e) => panic!("wrong error: {e}"),
        Ok(_) => panic!("rendered an unattested screenshot"),
    }
    // Text-only renders need no attestation.
    assert!(render::render(&request(p, &full_content(None), &privacy)).is_ok());
}

#[test]
fn blocked_terms_are_refused_in_any_field_without_echoing_them() {
    let p = preset::get("og").unwrap();
    let privacy = Privacy {
        fake_or_redacted: true,
        blocked_terms: Privacy::terms_from_str("# school names\nExample Academy\n\n"),
    };
    let mut content = full_content(Some(screenshot(400, 200)));
    content.headline = "Now at EXAMPLE academy".into();
    let err = render::render(&request(p, &content, &privacy))
        .err()
        .expect("refused");
    assert!(matches!(
        err,
        RenderError::Privacy(PrivacyError::BlockedTerm { field: "headline" })
    ));
    assert!(!err.to_string().to_lowercase().contains("example academy"));

    let mut content = full_content(Some(screenshot(400, 200)));
    content.image.as_mut().unwrap().chrome = Some("example-academy.test/gradebook".into());
    content.image_alt = Some("Gradebook at Example Academy".into());
    assert!(render::render(&request(p, &content, &privacy)).is_err());
}

#[test]
fn redaction_boxes_cover_the_screenshot_in_the_output() {
    let p = preset::get("square").unwrap();
    let mut img = SourceImage::from_bytes(png(400, 200, [0, 0, 0])).unwrap();
    img.redact = vec![[0, 0, 400, 200]];
    let content = Content {
        headline: "Redacted".into(),
        image: Some(img),
        image_alt: Some("A fully redacted test image".into()),
        ..Content::default()
    };
    let privacy = attested();
    let out = render::render(&request(p, &content, &privacy)).unwrap();
    assert_eq!(out.svg.matches(r#"class="redact""#).count(), 1);

    // The pixel at the centre of the image box is the skeleton colour, not
    // the black underneath.
    let card = out.layout.card.as_ref().unwrap();
    let (cx, cy) = (
        (card.image.x + card.image.w / 2.0) as usize,
        (card.image.y + card.image.h / 2.0) as usize,
    );
    let (info, buf) = decode_png(&out.bytes);
    let i = (cy * info.width as usize + cx) * 3;
    let skeleton = &theme::get(theme::DEFAULT_THEME).unwrap().light.skeleton;
    let want = u32::from_str_radix(&skeleton[1..], 16).unwrap();
    let want = [(want >> 16) as u8, (want >> 8) as u8, want as u8];
    assert_eq!(
        &buf[i..i + 3],
        &want,
        "redaction bar not painted over the image"
    );
}

#[test]
fn user_text_is_escaped() {
    let p = preset::get("og").unwrap();
    let content = Content {
        headline: r#"<script>"&'"#.into(),
        ..Content::default()
    };
    let svg = render::build_svg(&request(p, &content, &attested()))
        .unwrap()
        .1;
    assert!(!svg.contains("<script>"));
    assert!(svg.contains("&lt;script&gt;"));
}

// ── Alt text and campaigns ─────────────────────────────────────────────

#[test]
fn alt_text_describes_the_screenshot_and_the_words() {
    let content = full_content(Some(screenshot(400, 200)));
    let a = alt::describe(&content, "Toddle Enhancement Extension");
    assert!(a.starts_with("Toddle Enhancement Extension: Every criterion, in its own column."));
    assert!(a.contains("A gradebook with fake students."));
    assert!(a.chars().count() <= alt::MAX_LEN);
    let long = Content {
        headline: "word ".repeat(200),
        ..Content::default()
    };
    assert!(alt::describe(&long, "x").chars().count() <= alt::MAX_LEN);
}

#[test]
fn the_sample_campaign_parses_and_names_real_presets() {
    let src = include_str!("../../../../samples/toddle-launch/campaign.toml");
    let c = campaign::parse(src).unwrap();
    assert!(c.privacy.fake_or_redacted);
    assert!(theme::get(&c.theme).is_some());
    for r in &c.renders {
        assert!(
            preset::get(&r.preset).is_some(),
            "unknown preset {}",
            r.preset
        );
    }
    assert!(c.renders.iter().any(|r| r.preset == "story"));
}

#[test]
fn a_campaign_renders_every_file_and_a_manifest() {
    let dir = std::env::temp_dir().join(format!("nyuchi-imaging-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("shot.png"), png(600, 300, [200, 200, 200])).unwrap();
    std::fs::write(
        dir.join("c.toml"),
        r#"
out = "out"
[privacy]
fake_or_redacted = true
[content]
headline = "Hello"
cta = "example.test"
[image]
src = "shot.png"
alt = "A grey test image"
[[render]]
preset = "story"
[[render]]
preset = "cws-screenshot"
show_cta = false
[[render]]
preset = "cws-promo-small"
image = false
"#,
    )
    .unwrap();
    let m = campaign::run(&dir.join("c.toml"), vec![]).unwrap();
    assert_eq!(m.len(), 3);
    for e in &m {
        assert!(dir.join("out").join(&e.file).exists());
        assert!(!e.alt.is_empty());
    }
    assert!(m[0].alt.contains("A grey test image"));
    assert!(
        !m[2].alt.contains("A grey test image"),
        "text-only render must not describe a screenshot"
    );
    assert!(dir.join("out/manifest.json").exists());
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn bundu_theme_signs_with_the_official_logo_not_a_drawn_mark() {
    use nyuchi_imaging::{layout::Content, logo, preset, privacy::Privacy, render};
    let theme = theme::get("bundu").expect("bundu theme");
    assert_eq!(theme.logo.as_deref(), Some("bundu"));
    let l = logo::get("bundu").expect("bundu logo");
    // The published file, byte for byte: a PNG, 512 square.
    assert_eq!(&l.bytes[..8], b"\x89PNG\r\n\x1a\n");
    for id in ["og", "square", "story"] {
        let content = Content {
            headline: "An open standard.".into(),
            ..Default::default()
        };
        let (_, svg) = render::build_svg(&render::Request {
            preset: preset::get(id).unwrap(),
            theme,
            mode: Mode::Light,
            content: &content,
            privacy: &Privacy::default(),
            guides: false,
        })
        .unwrap();
        assert!(svg.contains(r#"class="logo""#), "{id}: no logo");
        // Copper is the brand mineral: it is in the mesh.
        assert!(svg.contains(theme.vivid("copper")), "{id}: no copper");
    }
}
