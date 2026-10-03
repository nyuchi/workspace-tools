use nyuchi_signature::{Error, MINERALS, Params, accent, build, contrast, https_url};

fn sample() -> Params {
    Params {
        brand: "learning".into(),
        name: "Sample Person".into(),
        email: "hello@learning.nyuchi.com".into(),
        title: "Programme Lead".into(),
        phone: "+263 77 000 0000".into(),
        ..Params::default()
    }
}

#[test]
fn renders_the_brand_and_contact_details() {
    let s = build(&sample()).unwrap();
    assert_eq!(s.brand.key, "learning");
    assert!(s.html.contains("Sample Person"));
    assert!(s.html.contains("Programme Lead · "));
    assert!(s.html.contains("Nyuchi Learning"));
    assert!(
        s.html
            .contains(r#"href="mailto:hello@learning.nyuchi.com""#)
    );
    assert!(s.html.contains(r#"href="tel:+263770000000""#));
    assert!(s.html.contains(r#"href="https://learning.nyuchi.com""#));
    assert!(s.html.contains("Education for All"));
    // The brand's own LinkedIn, as a text link.
    assert!(
        s.html
            .contains(r#"href="https://www.linkedin.com/company/nyuchi/""#)
    );
    assert!(s.text.starts_with(
        "Sample Person\nProgramme Lead · Nyuchi Learning\n\nhello@learning.nyuchi.com"
    ));
}

#[test]
fn is_email_safe() {
    let s = build(&Params {
        photo: "https://assets.example.test/p.jpg".into(),
        promo_image: "https://assets.example.test/b.jpg".into(),
        promo_link: "https://learning.nyuchi.com".into(),
        ..sample()
    })
    .unwrap();
    let html = s.html.to_lowercase();
    for banned in [
        "<style",
        "<script",
        "class=",
        "<link",
        "@import",
        "<div class",
        "position:",
        "display:flex",
        "display:grid",
    ] {
        assert!(!html.contains(banned), "found {banned}");
    }
    assert!(html.starts_with("<table"));
    assert!(html.contains("max-width:560px"));
    // The strip is seven cells with both bgcolor and background-color.
    for (_, _, vivid) in MINERALS {
        assert!(s.html.contains(&format!(r#"bgcolor="{vivid}""#)));
        assert!(s.html.contains(&format!("background-color:{vivid}")));
    }
    // Only the opt-in photo and banner are images.
    assert_eq!(html.matches("<img").count(), 2);
    // Every <img> has alt text and an explicit width.
    for img in html.split("<img").skip(1) {
        let tag = &img[..img.find('>').unwrap()];
        assert!(tag.contains("alt=\"") && tag.contains("width="), "{tag}");
    }
}

#[test]
fn no_images_by_default() {
    assert!(!build(&sample()).unwrap().html.contains("<img"));
}

#[test]
fn escapes_everything() {
    let s = build(&Params {
        name: r#"<script>alert("x")</script>"#.into(),
        title: "R&D <b>".into(),
        ..sample()
    })
    .unwrap();
    assert!(!s.html.contains("<script>"));
    assert!(
        s.html
            .contains("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;")
    );
    assert!(s.html.contains("R&amp;D &lt;b&gt;"));
}

#[test]
fn refuses_unsafe_urls() {
    for bad in [
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "http://example.test/a.png",
        "https://a b",
        "https://x\"onload=\"y",
        "",
    ] {
        assert!(https_url(bad).is_none(), "{bad}");
    }
    assert_eq!(
        https_url("example.test/a.png").as_deref(),
        Some("https://example.test/a.png")
    );
    let s = build(&Params {
        photo: "javascript:alert(1)".into(),
        linkedin: "javascript:alert(1)".into(),
        promo_image: "http://example.test/b.png".into(),
        ..sample()
    })
    .unwrap();
    assert!(!s.html.to_lowercase().contains("javascript:"));
    assert!(!s.html.contains("<img"));
}

#[test]
fn personal_socials_win_and_whatsapp_is_built_from_digits() {
    let s = build(&Params {
        linkedin: "https://www.linkedin.com/in/sample-person".into(),
        whatsapp: "+263 77 000 0000".into(),
        ..sample()
    })
    .unwrap();
    assert!(s.html.contains("https://www.linkedin.com/in/sample-person"));
    assert!(!s.html.contains("https://www.linkedin.com/company/nyuchi/"));
    assert!(s.html.contains("https://wa.me/263770000000"));
}

#[test]
fn brand_comes_from_the_email_domain_when_not_given() {
    let s = build(&Params {
        brand: String::new(),
        email: "hello@news.mukoko.com".into(),
        ..sample()
    })
    .unwrap();
    assert_eq!(s.brand.key, "mukokoNews");
    let err = build(&Params {
        brand: String::new(),
        email: "hello@example.test".into(),
        ..sample()
    });
    assert_eq!(err.err(), Some(Error::UnknownBrand));
    assert_eq!(
        build(&Params {
            name: " ".into(),
            ..sample()
        })
        .err(),
        Some(Error::MissingName)
    );
    assert_eq!(
        build(&Params {
            email: "nope".into(),
            ..sample()
        })
        .err(),
        Some(Error::BadEmail)
    );
}

#[test]
fn link_colours_meet_aa_on_white() {
    for (name, _, _) in MINERALS {
        assert!(contrast(accent(name), "#FFFFFF") >= 4.5, "{name}");
    }
    // Copper's on-light hex is just under AA, so it falls back to ink.
    assert_eq!(accent("copper"), "#141413");
    assert_eq!(accent("cobalt"), "#0047AB");
}

#[test]
fn every_brand_renders() {
    for b in nyuchi_brands::all() {
        let s = build(&Params {
            brand: b.key.clone(),
            ..sample()
        })
        .unwrap();
        assert!(
            s.html.contains(&nyuchi_signature::esc(&b.name)),
            "{}",
            b.key
        );
    }
}
