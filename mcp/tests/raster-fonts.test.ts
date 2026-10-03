// The server-side rasterizer's fonts are matched by the names *inside* the
// files, not by their file names — so a file whose name and contents
// disagree (as NotoSerif-Bold.ttf and NotoSerif-Italic.ttf once did: each
// held the other's face) works only while both are loaded, and breaks the
// moment someone copies one. These tests pin each file to the face its name
// promises, and check that a bold title really renders from the bold file.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const RASTER = resolve(
  __dirname,
  "../../signature-generator/public/fonts/raster",
);

interface Face {
  family: string;
  subfamily: string;
  postscript: string;
  weight: number;
  italic: boolean;
}

/** Read name IDs 1/2/6 (Windows, en-US) and OS/2 weight + italic bit. */
function face(file: string): Face {
  const d = readFileSync(resolve(RASTER, file));
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const tables = new Map<string, number>();
  for (let i = 0; i < view.getUint16(4); i++) {
    const at = 12 + 16 * i;
    tables.set(
      d.subarray(at, at + 4).toString("latin1"),
      view.getUint32(at + 8),
    );
  }
  const name = tables.get("name")!;
  const count = view.getUint16(name + 2);
  const strings = name + view.getUint16(name + 4);
  const names = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const r = name + 6 + 12 * i;
    if (view.getUint16(r) !== 3 || view.getUint16(r + 4) !== 0x409) continue;
    const len = view.getUint16(r + 8);
    const off = strings + view.getUint16(r + 10);
    // UTF-16BE: copy, then byte-swap the copy to read it as UTF-16LE.
    names.set(
      view.getUint16(r + 6),
      Buffer.from(d.subarray(off, off + len))
        .swap16()
        .toString("utf16le"),
    );
  }
  const os2 = tables.get("OS/2")!;
  return {
    family: names.get(1) ?? "",
    subfamily: names.get(2) ?? "",
    postscript: names.get(6) ?? "",
    weight: view.getUint16(os2 + 4),
    italic: (view.getUint16(os2 + 62) & 1) === 1,
  };
}

describe("raster fonts hold the face their file name says", () => {
  it.each([
    [
      "NotoSerif-Bold.ttf",
      { postscript: "NotoSerif-Bold", weight: 700, italic: false },
    ],
    [
      "NotoSerif-Italic.ttf",
      { postscript: "NotoSerif-Italic", weight: 400, italic: true },
    ],
    [
      "NotoSans-SemiBold.ttf",
      { postscript: "NotoSans-SemiBold", weight: 600, italic: false },
    ],
    [
      "JetBrainsMono-Regular.ttf",
      { postscript: "JetBrainsMono-Regular", weight: 400, italic: false },
    ],
    [
      "JetBrainsMono-SemiBold.ttf",
      { postscript: "JetBrainsMono-SemiBold", weight: 600, italic: false },
    ],
  ])("%s", (file, want) => {
    expect(face(file)).toMatchObject(want);
  });
});

/** An ASSETS stand-in serving the raster fonts from disk, optionally with
    one path answered by another file. */
function assets(swap: Record<string, string> = {}): Fetcher {
  return {
    fetch: async (req: Request | string) => {
      const path = new URL(typeof req === "string" ? req : req.url).pathname;
      const file = swap[path] ?? path.replace("/fonts/raster/", "");
      try {
        return new Response(readFileSync(resolve(RASTER, file)));
      } catch {
        return new Response("not found", { status: 404 });
      }
    },
  } as unknown as Fetcher;
}

const TITLE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120">' +
  '<rect width="420" height="120" fill="#ffffff"/>' +
  '<text x="16" y="84" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="64" fill="#000000">Harvest</text>' +
  "</svg>";

/** Rasterize with a fresh module, so the per-isolate font cache starts empty. */
async function render(fetcher: Fetcher): Promise<Uint8Array> {
  vi.resetModules();
  const { rasterizeSvg } = await import("../src/raster");
  return rasterizeSvg(TITLE, fetcher);
}

describe("server-rendered titles use Noto Serif Bold", () => {
  it("renders the bold title from NotoSerif-Bold.ttf", async () => {
    const full = await render(assets());
    // With the italic path answered by the bold file too, the only Noto
    // Serif face loaded is NotoSerif-Bold.ttf. Identical output proves the
    // full set's title came from that file.
    const boldOnly = await render(
      assets({ "/fonts/raster/NotoSerif-Italic.ttf": "NotoSerif-Bold.ttf" }),
    );
    expect(Buffer.from(full).equals(Buffer.from(boldOnly))).toBe(true);
    // And with only the italic face available the title renders differently,
    // so the comparison above is not vacuous.
    const italicOnly = await render(
      assets({ "/fonts/raster/NotoSerif-Bold.ttf": "NotoSerif-Italic.ttf" }),
    );
    expect(Buffer.from(full).equals(Buffer.from(italicOnly))).toBe(false);
  });
});
