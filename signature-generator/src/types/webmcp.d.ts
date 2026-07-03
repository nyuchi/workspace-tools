/**
 * Ambient types for the WebMCP `document.modelContext` API — an emerging
 * browser proposal that lets a page register MCP-style tools an AI agent
 * driving the browser can call directly, instead of scraping the DOM.
 *
 * Not yet part of TS's DOM lib, and not implemented by any browser in this
 * repo's test/CI matrix — every call site feature-detects
 * `'modelContext' in document` before touching it, so `document.modelContext`
 * is typed optional and this file only exists to give those call sites real
 * types instead of scattering `@ts-expect-error` around the codebase.
 *
 * Shape follows the WebMCP proposal's `registerTool`: JSON-schema-ish
 * `inputSchema`, an `execute` callback returning a JSON-serializable result,
 * and an `AbortSignal` to unregister the tool (e.g. on component unmount).
 */

export {}

interface ModelContextToolAnnotations {
  /** True when the tool has no side effects (safe to call speculatively). */
  readOnlyHint?: boolean
  [key: string]: unknown
}

interface ModelContextToolDefinition {
  name: string
  description: string
  /** JSON Schema for the tool's input. `{}`-property tools take no input. */
  inputSchema: Record<string, unknown>
  execute: (input?: Record<string, unknown>) => Promise<unknown>
  annotations?: ModelContextToolAnnotations
}

interface ModelContextRegisterOptions {
  /** Aborting unregisters the tool — pair with a `useEffect` cleanup. */
  signal?: AbortSignal
}

interface ModelContext {
  registerTool: (tool: ModelContextToolDefinition, options?: ModelContextRegisterOptions) => void
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
}
