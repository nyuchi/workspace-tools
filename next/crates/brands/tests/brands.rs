use nyuchi_brands::{Kind, all, for_email, get};
use std::collections::HashSet;

const MINERALS: [&str; 7] = [
    "cobalt",
    "tanzanite",
    "malachite",
    "gold",
    "terracotta",
    "sodalite",
    "copper",
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
            MINERALS.contains(&b.mineral.as_str()),
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
