//! nyuchi-img — the local CLI for the nyuchi-tools image renderer.
//!
//!   nyuchi-img presets [--json]
//!   nyuchi-img campaign <campaign.toml>
//!   nyuchi-img render --preset <id> --headline <text> [--out <file>]
//!       [--eyebrow <text>] [--sub <text>] [--cta <text>] [--point <text>]...
//!       [--image <png|jpg> --alt <text> --fake-or-redacted
//!        [--crop x,y,w,h] [--redact x,y,w,h]... [--chrome <url>]]
//!       [--theme <id>] [--dark] [--guides] [--svg]
//!
//! Blocked terms (school, student and staff names that must never appear in
//! an image) are read from the file named by NYUCHI_BLOCKED_TERMS_FILE, one
//! per line. Keep that file outside the repo.

use nyuchi_imaging::layout::{Content, SourceImage};
use nyuchi_imaging::privacy::Privacy;
use nyuchi_imaging::render::{self, Request};
use nyuchi_imaging::theme::{self, Mode};
use nyuchi_imaging::{alt, campaign, preset};
use std::path::Path;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("presets") => presets(args.iter().any(|a| a == "--json")),
        Some("campaign") => match args.get(1) {
            Some(path) => run_campaign(Path::new(path)),
            None => Err("usage: nyuchi-img campaign <campaign.toml>".into()),
        },
        Some("render") => render_one(&args[1..]),
        _ => Err(include_str!("usage.txt").into()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}

fn blocked_terms() -> Result<Vec<String>, String> {
    match std::env::var_os("NYUCHI_BLOCKED_TERMS_FILE") {
        Some(path) => std::fs::read_to_string(&path)
            .map(|s| Privacy::terms_from_str(&s))
            .map_err(|e| format!("NYUCHI_BLOCKED_TERMS_FILE: {e}")),
        None => Ok(Vec::new()),
    }
}

fn presets(json: bool) -> Result<(), String> {
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(preset::catalogue()).map_err(|e| e.to_string())?
        );
        return Ok(());
    }
    for p in preset::catalogue() {
        let [t, r, b, l] = p.safe;
        let safe = if p.has_safe_area() {
            format!("safe {t}/{r}/{b}/{l}")
        } else {
            String::new()
        };
        println!(
            "{:<22} {:>4}x{:<4} {:<4} {:<7} {:<16} {}",
            p.id,
            p.width,
            p.height,
            p.format.extension(),
            format!("{:?}", p.group).to_lowercase(),
            safe,
            p.name
        );
    }
    Ok(())
}

fn run_campaign(path: &Path) -> Result<(), String> {
    let manifest = campaign::run(path, blocked_terms()?)?;
    for m in &manifest {
        println!(
            "ok  {:<34} {:>4}x{:<4} {:>8} bytes",
            m.file, m.width, m.height, m.bytes
        );
    }
    println!(
        "\n{} image(s). Look at every one at full size for anything a redaction missed before publishing.",
        manifest.len()
    );
    Ok(())
}

fn rect(s: &str) -> Result<[u32; 4], String> {
    let v: Vec<u32> = s
        .split(',')
        .map(|n| {
            n.trim()
                .parse()
                .map_err(|_| format!("bad rectangle {s:?}: want x,y,w,h"))
        })
        .collect::<Result<_, _>>()?;
    v.try_into()
        .map_err(|_| format!("bad rectangle {s:?}: want x,y,w,h"))
}

fn render_one(args: &[String]) -> Result<(), String> {
    let mut content = Content::default();
    let mut preset_id = None;
    let mut out = None;
    let mut theme_id = theme::DEFAULT_THEME.to_string();
    let mut mode = Mode::Light;
    let mut guides = false;
    let mut want_svg = false;
    let mut attested = false;
    let mut image: Option<SourceImage> = None;
    let mut crop = None;
    let mut redact = Vec::new();
    let mut chrome = None;

    let mut it = args.iter();
    while let Some(flag) = it.next() {
        let mut value = || {
            it.next()
                .cloned()
                .ok_or_else(|| format!("{flag} needs a value"))
        };
        match flag.as_str() {
            "--preset" => preset_id = Some(value()?),
            "--out" => out = Some(value()?),
            "--theme" => theme_id = value()?,
            "--headline" => content.headline = value()?,
            "--eyebrow" => content.eyebrow = Some(value()?),
            "--sub" => content.sub = Some(value()?),
            "--cta" => content.cta = Some(value()?),
            "--point" => content.points.push(value()?),
            "--alt" => content.image_alt = Some(value()?),
            "--image" => {
                let path = value()?;
                let data = std::fs::read(&path).map_err(|e| format!("{path}: {e}"))?;
                image = Some(SourceImage::from_bytes(data)?);
            }
            "--crop" => crop = Some(rect(&value()?)?),
            "--redact" => redact.push(rect(&value()?)?),
            "--chrome" => chrome = Some(value()?),
            "--fake-or-redacted" => attested = true,
            "--dark" => mode = Mode::Dark,
            "--guides" => guides = true,
            "--svg" => want_svg = true,
            other => return Err(format!("unknown option {other}")),
        }
    }
    if let Some(mut img) = image {
        if content.image_alt.is_none() {
            return Err("--image needs --alt: describe what the screenshot shows".into());
        }
        img.crop = crop;
        img.redact = redact;
        img.chrome = chrome;
        content.image = Some(img);
    }
    let preset_id = preset_id.ok_or("--preset is required (see `nyuchi-img presets`)")?;
    let preset = preset::get(&preset_id).ok_or_else(|| format!("unknown preset {preset_id:?}"))?;
    let theme = theme::get(&theme_id).ok_or_else(|| format!("unknown theme {theme_id:?}"))?;
    let privacy = Privacy {
        fake_or_redacted: attested,
        blocked_terms: blocked_terms()?,
    };
    let req = Request {
        preset,
        theme,
        mode,
        content: &content,
        privacy: &privacy,
        guides,
    };

    let out = out.unwrap_or_else(|| {
        format!(
            "{}.{}",
            preset.id,
            if want_svg {
                "svg"
            } else {
                preset.format.extension()
            }
        )
    });
    if want_svg {
        let (_, svg) = render::build_svg(&req).map_err(|e| e.to_string())?;
        std::fs::write(&out, svg).map_err(|e| e.to_string())?;
    } else {
        let r = render::render(&req).map_err(|e| e.to_string())?;
        std::fs::write(&out, &r.bytes).map_err(|e| e.to_string())?;
    }
    println!("{out}  {}x{}", preset.width, preset.height);
    println!("alt: {}", alt::describe(&content, &theme.eyebrow));
    Ok(())
}
