use nyuchi_brands::{Kind, all, for_email, get};
use std::collections::HashSet;

/// Mzizi colour families a brand may take: the seven minerals and the
/// seven heritage colours (mzizi_get_tokens `minerals`, `heritage`).
const FAMILIES: [&str; 14] = [
    "cobalt",
    "tanzanite",
    "malachite",
    "gold",
    "terracotta",
    "sodalite",
    "copper",
    "indigo",
    "savanna",
    "baobab",
    "sunset",
    "river",
    "hematite",
    "kalahari",
];

#[test]
fn keys_aliases_and_domains_are_unique() {
    let mut keys = HashSet::new();
    let mut domains = HashSet::new();
    for b in all() {
        assert!(keys.insert(b.key.as_str()), "duplicate key {}", b.key);
        for a in &b.aliases {
            assert!(keys.insert(a.as_str()), "alias {a} clashes");
        }
        for d in &b.domains {
            assert!(domains.insert(d.as_str()), "domain {d} claimed twice");
        }
    }
}

#[test]
fn taxonomy_holds() {
    let bundu = get("bundu").unwrap();
    assert_eq!(bundu.kind, Kind::Foundation);
    assert!(bundu.parent.is_none());
    for b in all().iter().filter(|b| b.key != "bundu") {
        let parent = get(b.parent.as_deref().unwrap_or(""))
            .unwrap_or_else(|| panic!("{} has no parent", b.key));
        match b.kind {
            Kind::Pillar | Kind::Initiative => assert_eq!(parent.key, "bundu", "{}", b.key),
            Kind::Division => assert_eq!(parent.kind, Kind::Pillar, "{}", b.key),
            Kind::Foundation => panic!("only bundu is the foundation"),
        }
    }
}

#[test]
fn every_brand_has_a_mzizi_mineral_and_https_links() {
    for b in all() {
        assert!(
            FAMILIES.contains(&b.mineral.as_str()),
            "{}: {}",
            b.key,
            b.mineral
        );
        assert!(b.url.starts_with("https://"), "{}", b.key);
        for (net, url) in &b.socials {
            assert!(url.starts_with("https://"), "{} {net}", b.key);
        }
    }
}

#[test]
fn lookups() {
    assert_eq!(get("techLeaders").unwrap().key, "telia");
    assert_eq!(
        for_email("someone@learning.nyuchi.com").unwrap().key,
        "learning"
    );
    assert_eq!(
        for_email("Someone@HarareMetro.co.zw").unwrap().key,
        "mukokoNews"
    );
    assert_eq!(for_email("someone@nyuchi.com").unwrap().key, "nyuchi");
    assert!(for_email("someone@example.com").is_none());
    assert!(for_email("not-an-email").is_none());
    assert_eq!(get("nyuchi").unwrap().website(), "nyuchi.com");
}

/// The owner's colour rules (#70) on top of the Mzizi ecosystem canon.
#[test]
fn colour_rules() {
    let bundu = get("bundu").unwrap();
    assert!(
        ["copper", "terracotta"].contains(&bundu.mineral.as_str()),
        "the Foundation is copper or terracotta"
    );
    assert_eq!(
        get("mukoko").unwrap().mineral,
        "tanzanite",
        "Mukoko, the super app, is tanzanite"
    );
    assert_eq!(
        get("shamwari").unwrap().mineral,
        "sodalite",
        "Shamwari is sodalite (canon)"
    );
    // Lingo follows the canon (cobalt, a Mukoko mini-app there) while this
    // list still files it under Nyuchi — the one named exception.
    const CANON_EXCEPTIONS: [&str; 1] = ["lingo"];
    for b in all() {
        let nyuchi = b.key == "nyuchi" || b.parent.as_deref() == Some("nyuchi");
        if nyuchi && !CANON_EXCEPTIONS.contains(&b.key.as_str()) {
            assert_eq!(b.mineral, "gold", "{} is a Nyuchi brand, so gold", b.key);
        } else if !["bundu", "nyuchi", "mukoko"].contains(&b.key.as_str()) {
            assert!(
                b.mineral != "gold" && b.mineral != "tanzanite",
                "{} is a sub-app: gold is Nyuchi's and tanzanite is Mukoko's",
                b.key
            );
        }
    }
    // Sub-apps under Mukoko stay apart from the super app.
    for b in all()
        .iter()
        .filter(|b| b.parent.as_deref() == Some("mukoko"))
    {
        assert_ne!(b.mineral, "tanzanite", "{}", b.key);
    }
}
