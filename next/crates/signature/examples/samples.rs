//! Writes the signature samples in `samples/signatures/`:
//!
//!   cargo run -p nyuchi-signature --example samples
//!
//! Every person here is made up. Never put a real staff member's details in
//! a committed sample.

use nyuchi_signature::{Params, build};

fn main() {
    let out = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../samples/signatures");
    std::fs::create_dir_all(out).unwrap();
    let people = [
        (
            "nyuchi",
            "Sample Person",
            "Partnerships",
            "hello@nyuchi.com",
            "+263 77 000 0000",
            "",
        ),
        (
            "learning",
            "Sample Person",
            "Programme Lead",
            "hello@learning.nyuchi.com",
            "",
            "",
        ),
        (
            "mukoko",
            "Sample Person",
            "Community",
            "hello@mukoko.com",
            "",
            "+263 77 000 0000",
        ),
        (
            "shamwari",
            "Sample Person",
            "Research",
            "hello@shamwari.ai",
            "",
            "",
        ),
    ];
    let mut index = String::from(
        "<!doctype html><meta charset=\"utf-8\"><title>Signature samples</title>\
         <body style=\"margin:0;padding:32px;background:#ffffff;\">",
    );
    for (brand, name, title, email, phone, whatsapp) in people {
        let s = build(&Params {
            brand: brand.into(),
            name: name.into(),
            title: title.into(),
            email: email.into(),
            phone: phone.into(),
            whatsapp: whatsapp.into(),
            ..Params::default()
        })
        .unwrap();
        std::fs::write(format!("{out}/{brand}.html"), &s.html).unwrap();
        std::fs::write(format!("{out}/{brand}.txt"), &s.text).unwrap();
        index.push_str(&s.html);
        index.push_str("<div style=\"height:40px\"></div>");
    }
    index.push_str("</body>");
    std::fs::write(format!("{out}/index.html"), index).unwrap();
    println!("wrote {out}");
}
