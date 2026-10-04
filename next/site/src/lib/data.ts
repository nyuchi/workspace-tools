/* Build-time views of the data the Rust crates embed — the same files, so
   the site and the API can never disagree about a preset or a brand. */
import { parse } from "smol-toml";
import presetsToml from "../../../crates/imaging/data/presets.toml?raw";
import themesToml from "../../../crates/imaging/data/themes.toml?raw";
import brandsToml from "../../../crates/brands/data/brands.toml?raw";

export interface Preset {
  id: string;
  name: string;
  platform: string;
  group: "social" | "web" | "store" | "email" | "icon";
  width: number;
  height: number;
  format: "png" | "jpeg";
  safe: [number, number, number, number];
  max_bytes: number;
  alpha: boolean;
  legacy?: string;
}

export interface Brand {
  key: string;
  kind: "foundation" | "pillar" | "division" | "initiative";
  parent?: string;
  name: string;
  tagline?: string;
  url: string;
  domains: string[];
  mineral: string;
}

export interface Theme {
  id: string;
  name: string;
}

export const presets = (parse(presetsToml) as unknown as { preset: Preset[] })
  .preset;
export const themes = (parse(themesToml) as unknown as { theme: Theme[] })
  .theme;
export const brands = (parse(brandsToml) as unknown as { brand: Brand[] })
  .brand;

export const GROUPS: { id: Preset["group"]; label: string }[] = [
  { id: "social", label: "Social" },
  { id: "web", label: "Web" },
  { id: "store", label: "Stores" },
  { id: "email", label: "Email" },
  { id: "icon", label: "Icons" },
];

export const fmtBytes = (n: number) =>
  n >= 1_000_000
    ? `${Math.round(n / 1_000_000)} MB`
    : `${Math.round(n / 1000)} KB`;
