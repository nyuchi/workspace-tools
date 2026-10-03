# Samples

Rendered output of `next/crates/imaging`, committed so the look can be
reviewed without building anything.

`toddle-launch/` is a whole launch set rendered from **one** screenshot by
`toddle-launch/campaign.toml`: stories (light, dark, and one with the
safe-area guides drawn), a reel cover, 4:5 and square feed posts, OG,
LinkedIn, X, a YouTube thumbnail, a three-slide LinkedIn carousel, the Chrome
Web Store screenshots and promo tiles, a Shopify product image, an email
header and icons. `manifest.json` lists each file with its size and alt text.

The source screenshot is the one already published on learning.nyuchi.com.
Every student name and email in it is fake, and the assessment titles are
covered again by the campaign's redaction bars. No real student, staff or
school data appears in any sample, and none may be added.

Regenerate:

```sh
cd next && cargo run --release -- campaign ../samples/toddle-launch/campaign.toml
```

`signatures/` holds the redesigned email signature for four brands (HTML,
plain text, and `preview.png` of `index.html`). The person in them is made
up; never commit a real staff member's details.
