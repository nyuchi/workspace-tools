/**
 * Server-side SVG → PNG rasterization for the Studio/upload tools, via
 * resvg compiled to WebAssembly.
 *
 * Workers have no canvas, and resvg loads no system fonts, so every family
 * the SVG engines reference must be provided as raw TTF bytes. The static
 * instances live in `signature-generator/public/fonts/raster/` (vendored
 * from Google Fonts) and are fetched through the same `ASSETS` binding that
 * serves the rest of the built site — see brand-icons.ts for the pattern.
 * fontdb matches by family + style + weight, so the five faces below cover
 * everything the engines emit: Noto Serif 700 (titles), Noto Serif Italic
 * 400 (deks), Noto Sans 600 (pills), JetBrains Mono 400/600 (lockups,
 * eyebrows, hex labels).
 *
 * Both the wasm module and the font bytes are cached per isolate.
 */

import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const FONT_PATHS = [
  "/fonts/raster/NotoSerif-Bold.ttf",
  "/fonts/raster/NotoSerif-Italic.ttf",
  "/fonts/raster/NotoSans-SemiBold.ttf",
  "/fonts/raster/JetBrainsMono-Regular.ttf",
  "/fonts/raster/JetBrainsMono-SemiBold.ttf",
];

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(wasmModule);
  }
  return wasmReady;
}

let fontsCache: Promise<Uint8Array[]> | null = null;
function loadFonts(assets: Fetcher): Promise<Uint8Array[]> {
  if (!fontsCache) {
    fontsCache = Promise.all(
      FONT_PATHS.map(async (path) => {
        const res = await assets.fetch(new Request(new URL(path, "https://assets.internal")));
        if (!res.ok) {
          throw new Error(`Rasterization font missing from site assets: ${path} (${res.status})`);
        }
        return new Uint8Array(await res.arrayBuffer());
      }),
    ).catch((err) => {
      // Don't cache a failure: a transient assets hiccup shouldn't poison
      // the isolate for its whole lifetime.
      fontsCache = null;
      throw err;
    });
  }
  return fontsCache;
}

/**
 * Render an SVG string to PNG bytes at its intrinsic width/height.
 * Throws with an actionable message when the ASSETS binding (and with it
 * the font set) is unavailable — callers surface that as a tool error.
 */
export async function rasterizeSvg(svg: string, assets: Fetcher | undefined): Promise<Uint8Array> {
  if (!assets) {
    throw new Error("PNG rasterization requires the site ASSETS binding (fonts are served from it).");
  }
  const [, fontBuffers] = await Promise.all([ensureWasm(), loadFonts(assets)]);
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: "Noto Serif",
    },
  });
  try {
    const rendered = resvg.render();
    try {
      return rendered.asPng();
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}
