/**
 * MCP resources + prompts for the nyuchi-tools server.
 *
 * The tools generate things; these expose the canonical DATA the tools are
 * built on (brand registry, mineral palettes, studio format/layout reference)
 * as readable resources, plus guided prompts for the common workflows. All
 * content is derived from the same pure engine modules the tools import —
 * nothing here is a second copy of the data.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  DIVISIONS,
  getBrand,
  INITIATIVES,
  TOP_BRAND_KEYS,
  TOP_BRANDS,
} from "../../signature-generator/src/engines/brands";
import {
  CATEGORIES,
  FORMATS,
  SURFACE,
} from "../../signature-generator/src/engines/nyuchi";

const MINERAL_KEYS = Object.keys(CATEGORIES);

function jsonResource(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function userMessage(text: string) {
  return {
    messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
  };
}

export function registerCatalog(server: McpServer): void {
  // --- Resources -----------------------------------------------------------

  server.registerResource(
    "brand-registry",
    "nyuchi://brands",
    {
      title: "Bundu ecosystem brand registry",
      description:
        "The canonical Bundu-ecosystem taxonomy: the four top-level brands " +
        "(bundu foundation, nyuchi commercial, mukoko consumer, shamwari community AI), " +
        "their divisions, and the Bundu Foundation initiatives. Same data the " +
        "nyuchi_generate_email_signature and nyuchi_generate_studio_card tools use.",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonResource(uri.href, {
        brands: TOP_BRANDS,
        divisions: DIVISIONS,
        initiatives: INITIATIVES,
      }),
  );

  server.registerResource(
    "brand",
    new ResourceTemplate("nyuchi://brands/{key}", {
      list: undefined,
      complete: {
        key: (value) => TOP_BRAND_KEYS.filter((k) => k.startsWith(value)),
      },
    }),
    {
      title: "A single Bundu-ecosystem brand",
      description:
        "One top-level brand by slug (bundu | nyuchi | mukoko | shamwari), " +
        "including its divisions.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const key = String(variables.key);
      const brand = getBrand(key);
      if (!brand) {
        throw new Error(
          `Unknown brand '${key}'. Valid keys: ${TOP_BRAND_KEYS.join(", ")}.`,
        );
      }
      return jsonResource(uri.href, {
        ...brand,
        divisions: DIVISIONS[brand.key],
      });
    },
  );

  server.registerResource(
    "mineral-palettes",
    "nyuchi://minerals",
    {
      title: "Mzizi mineral palettes",
      description:
        "The seven Mzizi mineral palettes (name, semantic role, light/dark hex " +
        "pairs) plus the light/dark surface tokens — the palette system behind " +
        "nyuchi_generate_studio_card's `category` parameter. Pick the mineral whose " +
        "role matches the content: Cobalt=Knowledge, Sodalite=Intelligence, " +
        "Tanzanite=Identity, Malachite=Growth, Gold=Value, Copper=Stewardship, " +
        "Terracotta=Community.",
      mimeType: "application/json",
    },
    async (uri) => jsonResource(uri.href, { minerals: CATEGORIES, surfaces: SURFACE }),
  );

  server.registerResource(
    "studio-reference",
    "nyuchi://studio/reference",
    {
      title: "Studio card reference (formats, layouts, themes)",
      description:
        "Canvas formats (pixel sizes per platform), the five layout " +
        "compositions, and the three surface themes accepted by " +
        "nyuchi_generate_studio_card. Format and layout are independent axes.",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonResource(uri.href, {
        formats: FORMATS,
        layouts: {
          1: "type-forward — the headline dominates, node graph subtle in the background",
          2: "anchor — text in a left column, large node-graph mark on the right half",
          3: "split — solid mineral panel with the graph against the headline on a dark panel",
          4: "halo — everything centered, node graph arcing around the text",
          5: "mineral — diagonal light/dark swatch card about the mineral itself (default)",
        },
        themes: {
          light: "off-white surface, ink text",
          dark: "near-black surface with a mineral glow behind the graph (default)",
          accent: "full-bleed mineral background, ink text — the boldest option",
        },
      }),
  );

  // --- Prompts -------------------------------------------------------------

  server.registerPrompt(
    "create_social_card",
    {
      title: "Create an eye-catching social card",
      description:
        "Guided workflow for nyuchi_generate_studio_card: picks mineral by topic, " +
        "format by platform, and applies the hook-title/theme guidance.",
      argsSchema: {
        topic: z.string().describe("What the post is about (drives title, dek, and mineral choice)."),
        platform: z
          .string()
          .optional()
          .describe(
            "Target platform/slot: instagram, story, linkedin, og (link preview), or header.",
          ),
        brand: z
          .string()
          .optional()
          .describe("Lockup brand: bundu, nyuchi (default), mukoko, or shamwari."),
      },
    },
    ({ topic, platform, brand }) =>
      userMessage(
        `Create an eye-catching social card about: ${topic}\n\n` +
          `Use the nyuchi_generate_studio_card tool. Guidance:\n` +
          `- Read nyuchi://minerals and pick the mineral whose ROLE best matches the topic ` +
          `(e.g. growth news → malachite, community → terracotta).\n` +
          `- Format: ${platform ? `use the format matching '${platform}'` : "default 'ig' unless the destination implies otherwise"} ` +
          `(ig=square feed, story=vertical, li=LinkedIn, og=link preview, 16x9=header) — see nyuchi://studio/reference.\n` +
          `- Layout: 1–4 for a title-first card (5 is the mineral-education card, not for general posts).\n` +
          `- Write a short punchy title (a single line grows to poster size automatically) and a one-sentence dek.\n` +
          `- Theme 'dark' is the default; use 'accent' when the post should shout from the feed.\n` +
          `- Brand: ${brand ?? "nyuchi"}.\n` +
          `- If the card will be scheduled or posted (Buffer, Instagram, X), call the tool with upload: true ` +
          `to get a public image URL back.`,
      ),
  );

  server.registerPrompt(
    "create_email_signature",
    {
      title: "Create a branded email signature",
      description:
        "Guided workflow for nyuchi_generate_email_signature: collects the signer's " +
        "details and renders the byte-locked Nyuchi signature HTML.",
      argsSchema: {
        name: z.string().describe("Full name of the signer."),
        email: z.string().describe("Email address (its domain usually implies the brand)."),
        brand: z
          .string()
          .optional()
          .describe("Brand slug; if omitted, derive it from the email domain."),
      },
    },
    ({ name, email, brand }) =>
      userMessage(
        `Generate an email signature for ${name} <${email}>.\n\n` +
          `Use the nyuchi_generate_email_signature tool. Guidance:\n` +
          `- Brand: ${brand ?? "derive from the email domain via nyuchi://brands (e.g. @nyuchi.com → nyuchi, @bundu.org → bundu, @mukoko.com → mukoko, @shamwari.ai → shamwari)"}.\n` +
          `- Include title/phone/whatsapp/socials only if provided — never invent contact details.\n` +
          `- Return the emitted HTML verbatim; it is byte-locked to the historical design and must not be edited.`,
      ),
  );

  server.registerPrompt(
    "mineral_education_card",
    {
      title: "Create a 'meet this mineral' education card",
      description:
        "Guided workflow for a layout-5 mineral card with the DARK/LIGHT hex " +
        "spec labels shown — the card ABOUT a Mzizi mineral.",
      argsSchema: {
        mineral: z
          .string()
          .describe(`One of the seven Mzizi minerals: ${MINERAL_KEYS.join(", ")}.`),
      },
    },
    ({ mineral }) =>
      userMessage(
        `Create a mineral-education card introducing the Mzizi mineral '${mineral}'.\n\n` +
          `Use nyuchi_generate_studio_card with: category '${mineral}', layout 5, and the mineral's ` +
          `name as the title (hex spec labels then show automatically; pass showHexes: true to force them). ` +
          `Read nyuchi://minerals for its role and hex pair, and use the role as the card's dek or eyebrow.`,
      ),
  );
}
