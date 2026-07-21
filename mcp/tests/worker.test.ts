/* HTTP-level tests for the nyuchi-tools Worker (mcp/src/index.ts).
 *
 * The Worker is a plain Hono app exported as `{ fetch }`, with no
 * cloudflare:-namespace imports, so it runs under node vitest by calling
 * `worker.fetch(new Request(...), env)` directly — the same entrypoint the
 * Workers runtime uses. Bindings (AUTHKIT_DOMAIN / MCP_RESOURCE) are passed
 * as the `env` argument.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'
import worker from '../src/index'
import {
  CALLBACK_PATH,
  decodeOauthCookie,
  encodeOauthCookie,
  mintSessionCookie,
  OAUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SITE_CLIENT_ID,
  verifySessionCookie,
} from '../src/site-auth'
import {
  decryptGoogleSession,
  encryptGoogleSession,
  GMAIL_SETTINGS_BASIC_SCOPE,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_NAME,
  refreshIfNeeded,
  type GoogleSession,
} from '../src/google-auth'
import { buildSignatureHtml } from '../../signature-generator/src/engines/signature'

const BASE = 'https://tools.nyuchi.com'

/** No auth configured: the MCP server runs open. */
const OPEN_ENV = {}

/** Auth configured: WorkOS AuthKit protects /mcp. */
const AUTH_ENV = { AUTHKIT_DOMAIN: 'x.authkit.app' }

/** Site-wide login gate configured with a known, throwaway test secret. */
const TEST_SESSION_SECRET = 'test-secret-do-not-use-in-prod'
const SITE_ENV = { SESSION_SECRET: TEST_SESSION_SECRET }

/** Stub ASSETS binding: the real one only exists in the real Workers
 * runtime, so tests that need a request to reach the post-auth catch-all
 * (`app.all("*", (c) => c.env.ASSETS.fetch(...))`) provide this instead. */
const ASSETS_STUB = { fetch: async () => new Response('stub-asset') }

/** Stub ASSETS binding that answers brand-icon `.b64.txt` requests with a
 * fixed fake payload, so tests can verify generate_studio_card actually
 * embeds a real per-brand icon (via mcp/src/brand-icons.ts) instead of
 * falling back to the engine's generic placeholder mark — the exact bug
 * this guards against regressing to. */
const FAKE_ICON_B64 = 'ZmFrZS1pY29uLWJ5dGVz'
const ICON_ASSETS_STUB = {
  fetch: async (req: Request) => {
    const url = new URL(req.url)
    if (url.pathname.endsWith('.b64.txt')) return new Response(FAKE_ICON_B64)
    return new Response('not found', { status: 404 })
  },
}

/** Like ICON_ASSETS_STUB, but additionally serves the vendored raster TTFs
 * straight from signature-generator/public — what the real ASSETS binding
 * does in production — so tests can exercise the actual resvg pipeline. */
const FONT_ASSETS_STUB = {
  fetch: async (req: Request) => {
    const url = new URL(req.url)
    if (url.pathname.endsWith('.b64.txt')) return new Response(FAKE_ICON_B64)
    if (url.pathname.startsWith('/fonts/raster/')) {
      const file = join(__dirname, '../../signature-generator/public', url.pathname)
      return new Response(new Uint8Array(readFileSync(file)))
    }
    return new Response('not found', { status: 404 })
  },
}

/** Env with Cloudflare Images + GitHub feedback configured (values fake;
 * the corresponding fetches are mocked per test). */
const UPLOAD_ENV = {
  ASSETS: FONT_ASSETS_STUB,
  CF_IMAGES_ACCOUNT_ID: 'acct123',
  CF_IMAGES_TOKEN: 'tok123',
  GITHUB_FEEDBACK_TOKEN: 'gh123',
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

type Env = Record<string, unknown>

function get(path: string, env: Env = OPEN_ENV, headers?: HeadersInit): Promise<Response> {
  return Promise.resolve(worker.fetch(new Request(`${BASE}${path}`, { headers }), env))
}

function post(path: string, body: unknown, env: Env = OPEN_ENV): Promise<Response> {
  return Promise.resolve(
    worker.fetch(
      new Request(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
      env,
    ),
  )
}

/** Pull a named cookie's raw value out of a Set-Cookie response header. */
function cookieValueFrom(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : null
}

interface JsonRpcResponse {
  jsonrpc: string
  id: number | string | null
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

function rpc(method: string, params: Record<string, unknown> = {}, id: number = 1) {
  return { jsonrpc: '2.0', id, method, params }
}

describe('GET /mcp — discovery', () => {
  it('returns the server identity JSON advertising the latest SDK protocol version', async () => {
    const { LATEST_PROTOCOL_VERSION } = await import('@modelcontextprotocol/sdk/types.js')
    const res = await get('/mcp')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      name: 'nyuchi-tools',
      version: '0.1.0',
      protocol: `mcp/${LATEST_PROTOCOL_VERSION}`,
      endpoint: '/mcp',
    })
  })
})

describe('POST /mcp — JSON-RPC', () => {
  it('answers initialize with server info and the protocol version', async () => {
    const res = await post(
      '/mcp',
      rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '0.0.0' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.jsonrpc).toBe('2.0')
    expect(body.id).toBe(1)
    expect(body.error).toBeUndefined()
    const result = body.result as {
      protocolVersion: string
      serverInfo: { name: string; version: string }
    }
    expect(result.serverInfo.name).toBe('nyuchi-tools')
    expect(result.serverInfo.version).toBe('0.1.0')
    expect(result.protocolVersion).toBe('2024-11-05')
  })

  it('tools/list exposes exactly the four tools (the banner tool is gone)', async () => {
    const res = await post('/mcp', rpc('tools/list', {}, 2))
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    const tools = (body.result as { tools: { name: string }[] }).tools
    expect(tools.map((t) => t.name).sort()).toEqual([
      'generate_email_signature',
      'generate_studio_card',
      'report_issue',
      'upload_asset',
    ])
  })

  it('calling the removed generate_article_banner tool errors cleanly', async () => {
    const res = await post(
      '/mcp',
      rpc('tools/call', { name: 'generate_article_banner', arguments: { title: 'X', category: 'gold' } }, 3),
    )
    const body = (await res.json()) as JsonRpcResponse
    // Unknown tool is a protocol-level error (or an isError result depending
    // on SDK version) — either way, never a successful render.
    const result = body.result as { isError?: boolean } | undefined
    expect(Boolean(body.error) || Boolean(result?.isError)).toBe(true)
  })

  it('tools carry behavior annotations and (where stable) output schemas', async () => {
    const res = await post('/mcp', rpc('tools/list', {}, 2))
    const body = (await res.json()) as JsonRpcResponse
    const tools = (
      body.result as {
        tools: {
          name: string
          annotations?: Record<string, boolean>
          outputSchema?: { properties?: Record<string, unknown> }
        }[]
      }
    ).tools
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
    // Pure generators are read-only and closed-world.
    expect(byName['generate_email_signature'].annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false })
    // Anything that can publish externally is open-world, non-destructive.
    for (const name of ['generate_studio_card', 'upload_asset', 'report_issue']) {
      expect(byName[name].annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, openWorldHint: true })
    }
    expect(Object.keys(byName['upload_asset'].outputSchema?.properties ?? {}).sort()).toEqual(['contentType', 'id', 'url'])
    expect(Object.keys(byName['report_issue'].outputSchema?.properties ?? {}).sort()).toEqual(['number', 'repo', 'url'])
  })


  it('tools/call generate_email_signature returns HTML with escaped fields', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_email_signature',
          arguments: {
            brand: 'nyuchi',
            name: 'Eve <script>alert(1)</script> & Co',
            email: 'eve@nyuchi.com',
            title: 'QA "Lead"',
          },
        },
        3,
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const content = (body.result as { content: { type: string; text: string }[] }).content
    expect(content[0].type).toBe('text')
    const html = content[0].text
    expect(html.startsWith('<table')).toBe(true)
    expect(html).toContain('Eve &lt;script&gt;alert(1)&lt;/script&gt; &amp; Co')
    expect(html).not.toContain('<script>')
    expect(html).toContain('QA &quot;Lead&quot;')
    expect(html).toContain('href="mailto:eve%40nyuchi.com"')
    expect(html).toContain('color: #5D4037;">Nyuchi Africa</span>')
  })

  it('tools/call generate_email_signature accepts the new bundu brand', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_email_signature',
          arguments: { brand: 'bundu', name: 'Tariro Chikafu', email: 'tariro@bundu.org' },
        },
        30,
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const html = (body.result as { content: { text: string }[] }).content[0].text
    expect(html).toContain('color: #BF5A36;">Bundu Foundation</span>')
    expect(html).toContain('"The wilderness holds the hive"')
    expect(html).toContain('>bundu.org</a>')
  })

  it('tools/call generate_email_signature accepts the new shamwari brand', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_email_signature',
          arguments: { brand: 'shamwari', name: 'Farai Gumbo', email: 'farai@shamwari.ai' },
        },
        31,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const html = (body.result as { content: { text: string }[] }).content[0].text
    expect(html).toContain('color: #283593;">Shamwari AI</span>')
    expect(html).toContain('>shamwari.ai</a>')
  })

  it('tools/call with an unknown brand surfaces a tool error', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        { name: 'generate_email_signature', arguments: { brand: 'acme', name: 'X', email: 'x@x.com' } },
        4,
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    // The MCP SDK reports zod input-validation failures as a tool-level
    // error result (isError: true, -32602 in the text), not a protocol error.
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(body.error).toBeUndefined()
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('-32602')
    expect(result.content[0].text).toContain('"path"')
    expect(result.content[0].text).toContain('brand')
  })

  it('tools/call generate_studio_card returns a real Studio SVG plus JSON metadata', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: {
            title: 'Seven minerals, one ecosystem',
            dek: 'How the bundu palette carries meaning across every brand we build.',
            category: 'gold',
            format: 'og',
          },
        },
        10,
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const content = (body.result as { content: { type: string; text: string }[] }).content
    expect(content).toHaveLength(2)

    const svg = content[0].text
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    // og format → 1200 × 630
    expect(svg).toContain('viewBox="0 0 1200 630"')
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('height="630"')
    // Real generative output: lattice + graph geometry, not a placeholder rect.
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(5)
    expect((svg.match(/<line /g) ?? []).length).toBeGreaterThan(3)
    expect(svg.length).toBeGreaterThan(5000)
    expect(svg).not.toContain('placeholder')
    expect(svg).toContain('Seven minerals, one ecosystem')

    const meta = JSON.parse(content[1].text) as { format: { w: number; h: number }; seed: number }
    expect(meta.format).toEqual({ w: 1200, h: 630 })
    expect(typeof meta.seed).toBe('number')
  })

  it('generate_studio_card keeps markup in the title escaped', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: {
            title: 'Attack <script>alert(1)</script> & Co',
            category: 'cobalt',
            format: 'ig',
            layout: 1,
          },
        },
        11,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const svg = (body.result as { content: { text: string }[] }).content[0].text
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('generate_studio_card is deterministic for identical arguments', async () => {
    const args = { title: 'Determinism', category: 'malachite', format: '16x9', layout: 3 }
    const first = (await (
      await post('/mcp', rpc('tools/call', { name: 'generate_studio_card', arguments: args }, 12))
    ).json()) as JsonRpcResponse
    const second = (await (
      await post('/mcp', rpc('tools/call', { name: 'generate_studio_card', arguments: args }, 13))
    ).json()) as JsonRpcResponse
    const a = (first.result as { content: { text: string }[] }).content
    const b = (second.result as { content: { text: string }[] }).content
    expect(b[0].text).toBe(a[0].text)
    expect(b[1].text).toBe(a[1].text)
  })

  it('generate_studio_card renders a bundu-branded card (lockup wordmark)', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'The wilderness holds the hive', category: 'copper', brand: 'bundu' },
        },
        32,
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const svg = (body.result as { content: { text: string }[] }).content[0].text
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('>bundu.org</text>')
    expect(svg).not.toContain('>nyuchi.com</text>')
  })

  it('generate_studio_card rejects an unknown brand', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        { name: 'generate_studio_card', arguments: { title: 'X', category: 'gold', brand: 'acme' } },
        33,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(body.error).toBeUndefined()
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('-32602')
  })

  it('generate_studio_card rejects an unknown format', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        { name: 'generate_studio_card', arguments: { title: 'X', category: 'gold', format: 'a4' } },
        14,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('-32602')
  })







  // These two run last in the describe block: loading brand icons populates
  // a module-level cache shared by every call in this test file (mirroring
  // one Worker isolate's lifetime), so once these run, every studio
  // test after them would also see real icons instead of the wordmark-only
  // fallback the tests above assert around.
  it('generate_studio_card embeds the real brand icon when ASSETS is available', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'What is nhimbe?', category: 'malachite', brand: 'mukoko' },
        },
        18,
      ),
      { ...OPEN_ENV, ASSETS: ICON_ASSETS_STUB },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const svg = (body.result as { content: { text: string }[] }).content[0].text
    expect(svg).toContain(`<image href="data:image/png;base64,${FAKE_ICON_B64}"`)
    expect(svg).toContain('>mukoko.com</text>')
  })


  it('malformed JSON gets a -32700 parse error with HTTP 400', async () => {
    const res = await post('/mcp', '{not json')
    expect(res.status).toBe(400)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error?.code).toBe(-32700)
    expect(body.id).toBeNull()
  })

  it('a non-object payload gets a -32600 invalid request with HTTP 400', async () => {
    const res = await post('/mcp', '42')
    expect(res.status).toBe(400)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error?.code).toBe(-32600)
  })

  it('notifications (no id) get an empty 202', async () => {
    const res = await post('/mcp', {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
  })

  it('other paths under /mcp/* return a JSON 404 hint', async () => {
    const res = await get('/mcp/anything')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { hint: string }
    expect(body.hint).toContain('POST /mcp')
  })
})

/* These run after the icon tests above on purpose: they pass an ASSETS
 * binding, which (like one real isolate) populates the module-level
 * brand-icon cache for every later call in this file. */
describe('generate_studio_card — returnFormat / upload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts dekFontSize/dekColor overrides in svg mode', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: {
            title: 'Nhimbe',
            dek: 'Gathering, discovered.',
            category: 'malachite',
            layout: 1,
            dekFontSize: 44,
            dekColor: '#FFD740',
          },
        },
        40,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const svg = (body.result as { content: { text: string }[] }).content[0].text
    expect(svg).toContain('font-size="44" fill="#FFD740"')
  })

  it("theme 'accent' renders the full-bleed mineral surface with ink text", async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'Nhimbe', category: 'malachite', layout: 1, theme: 'accent' },
        },
        45,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const svg = (body.result as { content: { text: string }[] }).content[0].text
    expect(svg).toContain('<rect width="1080" height="1080" fill="#64FFDA"/>')
    expect(svg).toContain('fill="#0F0E0C">Nhimbe</text>')
  })

  it('rejects a non-hex dekColor at the schema layer', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'X', category: 'gold', dekColor: 'red"onload="x' },
        },
        41,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('-32602')
  })

  it("returnFormat 'png' rasterizes server-side and returns a real PNG image", async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: {
            title: 'Seven minerals',
            dek: 'One ecosystem.',
            category: 'gold',
            layout: 1,
            returnFormat: 'png',
          },
        },
        42,
      ),
      { ...OPEN_ENV, ASSETS: FONT_ASSETS_STUB },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const content = (body.result as { content: { type: string; data?: string; mimeType?: string; text?: string }[] })
      .content
    expect(content[0].type).toBe('image')
    expect(content[0].mimeType).toBe('image/png')
    const bytes = Buffer.from(content[0].data!, 'base64')
    expect([...bytes.subarray(0, 8)]).toEqual(PNG_MAGIC)
    // A real 1080×1080 render with text + graph is far bigger than a stub.
    expect(bytes.length).toBeGreaterThan(10000)
    const meta = JSON.parse(content[1].text!) as { format: { w: number; h: number } }
    expect(meta.format).toEqual({ w: 1080, h: 1080 })
  })

  it("upload:true + returnFormat 'png' uploads AND returns the pixels, with the url in metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { id: 'both-1', variants: ['https://imagedelivery.net/h/both-1/public'] },
        }),
        { status: 200 },
      ),
    )
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'Both', category: 'gold', layout: 1, upload: true, returnFormat: 'png' },
        },
        46,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const content = (body.result as { content: { type: string; mimeType?: string; text?: string }[] }).content
    expect(content[0].type).toBe('image')
    const meta = JSON.parse(content[1].text!) as { url?: string; id?: string }
    expect(meta.url).toBe('https://imagedelivery.net/h/both-1/public')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("upload:true + returnFormat 'svg' is rejected — nothing would be uploaded", async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'X', category: 'gold', upload: true, returnFormat: 'svg' },
        },
        47,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("cannot be combined")
  })

  it("returnFormat 'url' fails closed with a clear message when Images is unconfigured", async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: { title: 'X', category: 'gold', upload: true },
        },
        43,
      ),
      { ...OPEN_ENV, ASSETS: FONT_ASSETS_STUB },
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('CF_IMAGES_ACCOUNT_ID')
  })

  it('upload=true rasterizes, uploads to Cloudflare Images, and returns only the URL + metadata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            id: 'nhimbe/2026-07/harvest.png',
            variants: ['https://imagedelivery.net/acct-hash/nhimbe/2026-07/harvest.png/public'],
          },
        }),
        { status: 200 },
      ),
    )
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_studio_card',
          arguments: {
            title: 'Nhimbe harvest',
            dek: "Africa's gathering, discovered.",
            category: 'malachite',
            layout: 1,
            upload: true,
            uploadKey: '/nhimbe/2026-07/harvest.png',
          },
        },
        44,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const content = (body.result as { content: { type: string; text: string }[] }).content
    expect(content).toHaveLength(1)
    const payload = JSON.parse(content[0].text) as {
      url: string
      id: string
      width: number
      height: number
    }
    expect(payload.url).toBe('https://imagedelivery.net/acct-hash/nhimbe/2026-07/harvest.png/public')
    expect(payload.width).toBe(1080)
    expect(payload.height).toBe(1080)
    // No SVG body anywhere in the response — that's the whole point.
    expect(content[0].text).not.toContain('<svg')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct123/images/v1')
    const form = init.body as FormData
    // Leading slash stripped by key sanitization.
    expect(form.get('id')).toBe('nhimbe/2026-07/harvest.png')
    const file = form.get('file') as Blob
    expect(file.type).toBe('image/png')
    expect([...new Uint8Array((await file.arrayBuffer()).slice(0, 8))]).toEqual(PNG_MAGIC)
  })
})

describe('upload_asset', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const TINY_PNG_B64 = Buffer.from([...PNG_MAGIC, 1, 2, 3, 4]).toString('base64')

  it('uploads pre-rasterized PNG bytes and returns the public URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { id: 'gen-id-1', variants: ['https://imagedelivery.net/h/gen-id-1/public'] },
        }),
        { status: 200 },
      ),
    )
    const res = await post(
      '/mcp',
      rpc('tools/call', { name: 'upload_asset', arguments: { pngBase64: TINY_PNG_B64 } }, 50),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const result = body.result as { content: { text: string }[]; structuredContent?: Record<string, unknown> }
    const payload = JSON.parse(result.content[0].text) as { url: string; contentType: string }
    expect(payload.url).toBe('https://imagedelivery.net/h/gen-id-1/public')
    expect(payload.contentType).toBe('image/png')
    // Structured output mirrors the text payload (validated by outputSchema).
    expect(result.structuredContent).toEqual({
      url: 'https://imagedelivery.net/h/gen-id-1/public',
      id: 'gen-id-1',
      contentType: 'image/png',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('rasterizes SVG input to PNG before uploading', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { id: 'gen-id-2', variants: ['https://imagedelivery.net/h/gen-id-2/public'] },
        }),
        { status: 200 },
      ),
    )
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#FFD740"/></svg>'
    const res = await post(
      '/mcp',
      rpc('tools/call', { name: 'upload_asset', arguments: { svg } }, 51),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const file = (init.body as FormData).get('file') as Blob
    expect(file.type).toBe('image/png')
    expect([...new Uint8Array((await file.arrayBuffer()).slice(0, 8))]).toEqual(PNG_MAGIC)
  })

  it('an empty-string pngBase64 alongside svg dispatches to the svg path (not a decode error)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { id: 'empty-png-1', variants: ['https://imagedelivery.net/h/empty-png-1/public'] },
        }),
        { status: 200 },
      ),
    )
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#64FFDA"/></svg>'
    const res = await post(
      '/mcp',
      rpc('tools/call', { name: 'upload_asset', arguments: { svg, pngBase64: '' } }, 55),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const result = body.result as { isError?: boolean; content: { text: string }[] }
    expect(result.isError).toBeFalsy()
    const file = (fetchSpy.mock.calls[0][1] as RequestInit).body as FormData
    expect((file.get('file') as Blob).type).toBe('image/png')
  })

  it('rejects a payload with both svg and pngBase64', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        { name: 'upload_asset', arguments: { svg: '<svg/>', pngBase64: TINY_PNG_B64 } },
        52,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('exactly one')
  })

  it('rejects base64 that is not a PNG', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        { name: 'upload_asset', arguments: { pngBase64: Buffer.from('not a png').toString('base64') } },
        53,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('bad signature')
  })

  it('fails closed with a clear message when Images is unconfigured', async () => {
    const res = await post(
      '/mcp',
      rpc('tools/call', { name: 'upload_asset', arguments: { pngBase64: TINY_PNG_B64 } }, 54),
      { ...OPEN_ENV, ASSETS: FONT_ASSETS_STUB },
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not configured')
  })
})

describe('report_issue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('files a GitHub issue on the configured repo and returns its URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: 'https://github.com/nyuchi/workspace-tools/issues/99', number: 99 }),
        { status: 201 },
      ),
    )
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'report_issue',
          arguments: {
            title: 'Dek renders too small',
            description: 'Called generate_studio_card with layout 1; the dek was unreadable at feed size.',
            tool_name: 'generate_studio_card',
            severity: 'high',
            category: 'bug',
          },
        },
        60,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const result = body.result as { content: { text: string }[]; structuredContent?: Record<string, unknown> }
    const payload = JSON.parse(result.content[0].text) as { url: string; number: number; repo: string }
    expect(payload).toEqual({
      url: 'https://github.com/nyuchi/workspace-tools/issues/99',
      number: 99,
      repo: 'nyuchi/workspace-tools',
    })
    expect(result.structuredContent).toEqual(payload)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/nyuchi/workspace-tools/issues')
    const sent = JSON.parse(init.body as string) as { title: string; body: string; labels: string[] }
    expect(sent.title).toBe('[generate_studio_card] Dek renders too small')
    expect(sent.body).toContain('**Severity:** high')
    expect(sent.labels).toEqual(['mcp-feedback', 'bug', 'severity:high'])
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gh123')
  })

  it('fails closed with a clear message when no feedback token is configured', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'report_issue',
          arguments: {
            title: 'Some problem',
            description: 'Long enough description of the problem.',
            tool_name: 'upload_asset',
            category: 'bug',
          },
        },
        61,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not configured')
  })

  it('surfaces the GitHub error message on a failed create', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }),
    )
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'report_issue',
          arguments: {
            title: 'Some problem',
            description: 'Long enough description of the problem.',
            tool_name: 'upload_asset',
            category: 'documentation',
          },
        },
        62,
      ),
      UPLOAD_ENV,
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Bad credentials')
  })
})

describe('OAuth discovery — auth OFF (no AUTHKIT_DOMAIN)', () => {
  it('protected-resource metadata is a JSON 404 (open server)', async () => {
    const res = await get('/.well-known/oauth-protected-resource')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('no_protected_resource_metadata')
  })

  it('/mcp requires no token', async () => {
    const res = await get('/mcp')
    expect(res.status).toBe(200)
  })
})

describe('OAuth discovery — auth ON (AUTHKIT_DOMAIN set)', () => {
  it('protected-resource metadata advertises the WorkOS authorization server', async () => {
    const res = await get('/.well-known/oauth-protected-resource', AUTH_ENV)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      resource: 'https://tools.nyuchi.dev/mcp',
      authorization_servers: ['https://x.authkit.app'],
      bearer_methods_supported: ['header'],
      scopes_supported: [],
    })
  })

  it('the nested metadata path works too', async () => {
    const res = await get('/.well-known/oauth-protected-resource/mcp', AUTH_ENV)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { authorization_servers: string[] }
    expect(body.authorization_servers).toEqual(['https://x.authkit.app'])
  })

  it('/mcp without a token is 401 with a WWW-Authenticate challenge', async () => {
    const res = await get('/mcp', AUTH_ENV)
    expect(res.status).toBe(401)
    const challenge = res.headers.get('WWW-Authenticate')
    expect(challenge).toContain('Bearer error="unauthorized"')
    expect(challenge).toContain(
      'resource_metadata="https://tools.nyuchi.dev/.well-known/oauth-protected-resource"',
    )
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('unauthorized')
  })

  it('/mcp with a structurally invalid bearer token is also 401', async () => {
    const res = await Promise.resolve(
      worker.fetch(
        new Request(`${BASE}/mcp`, { headers: { Authorization: 'Bearer not-a-jwt' } }),
        AUTH_ENV,
      ),
    )
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toContain('resource_metadata=')
  })

  it('MCP_RESOURCE overrides the advertised resource', async () => {
    const res = await get('/.well-known/oauth-protected-resource', {
      ...AUTH_ENV,
      MCP_RESOURCE: 'https://staging.example.com',
    })
    const body = (await res.json()) as { resource: string }
    expect(body.resource).toBe('https://staging.example.com')
  })
})

describe('GET /.well-known/mcp/server-card.json', () => {
  it('returns the MCP server card', async () => {
    const res = await get('/.well-known/mcp/server-card.json')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({
      serverInfo: { name: 'nyuchi-tools', version: '0.1.0' },
      name: 'nyuchi-tools',
      description:
        'MCP server for Nyuchi Africa tools: email signatures, Nyuchi Studio social cards ' +
        '(SVG, PNG, or hosted Cloudflare Images URL), asset uploads, and issue reporting.',
      websiteUrl: 'https://tools.nyuchi.com',
      remotes: [{ transportType: 'streamable-http', url: 'https://tools.nyuchi.dev/mcp' }],
      capabilities: { tools: { listChanged: true } },
    })
  })

  it('is served the same way regardless of auth mode', async () => {
    const res = await get('/.well-known/mcp/server-card.json', AUTH_ENV)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { name: string }
    expect(body.name).toBe('nyuchi-tools')
  })
})

describe('GET /auth.md', () => {
  it('serves markdown with an H1 that names auth.md', async () => {
    const res = await get('/auth.md')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    const body = await res.text()
    expect(body).toMatch(/^# .*auth\.md/m)
  })

  it('describes the real architecture without fabricating an agent_auth block', async () => {
    const res = await get('/auth.md')
    const body = await res.text()
    expect(body).toContain('https://identity.nyuchi.com')
    expect(body).toContain('/.well-known/oauth-protected-resource')
    expect(body).toContain('tools.nyuchi.dev is a resource server')
    expect(body).not.toContain('agent_auth')
  })

  it('is reachable the same way in auth-on mode too', async () => {
    const res = await get('/auth.md', AUTH_ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
  })
})

describe('Authorization server metadata mirror', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('auth OFF: oauth-authorization-server keeps the existing JSON 404 (nothing to mirror)', async () => {
    const res = await get('/.well-known/oauth-authorization-server')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('no_authorization_server')
  })

  it('auth OFF: openid-configuration also keeps the existing JSON 404', async () => {
    const res = await get('/.well-known/openid-configuration')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('no_authorization_server')
  })

  it('auth ON: oauth-authorization-server proxies the real upstream document', async () => {
    const upstreamBody = {
      issuer: 'https://mirror1.authkit.app',
      authorization_endpoint: 'https://mirror1.authkit.app/oauth2/authorize',
      registration_endpoint: 'https://mirror1.authkit.app/oauth2/register',
    }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(upstreamBody), { status: 200 }))

    const res = await get('/.well-known/oauth-authorization-server', { AUTHKIT_DOMAIN: 'mirror1.authkit.app' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(upstreamBody)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://mirror1.authkit.app/.well-known/oauth-authorization-server',
      expect.objectContaining({ signal: expect.anything() }),
    )
  })

  it('auth ON: openid-configuration proxies the real upstream document', async () => {
    const upstreamBody = { issuer: 'https://mirror2.authkit.app', userinfo_endpoint: 'https://mirror2.authkit.app/oauth2/userinfo' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(upstreamBody), { status: 200 }))

    const res = await get('/.well-known/openid-configuration', { AUTHKIT_DOMAIN: 'mirror2.authkit.app' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(upstreamBody)
  })

  it('auth ON: the nested oauth-authorization-server path mirrors too', async () => {
    const upstreamBody = { issuer: 'https://mirror3.authkit.app' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(upstreamBody), { status: 200 }))

    const res = await get('/.well-known/oauth-authorization-server/extra', { AUTHKIT_DOMAIN: 'mirror3.authkit.app' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(upstreamBody)
  })

  it('auth ON: an upstream network failure becomes a 502, never fabricated metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const res = await get('/.well-known/oauth-authorization-server', { AUTHKIT_DOMAIN: 'mirror4.authkit.app' })
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('upstream_fetch_failed')
  })

  it('auth ON: an upstream non-200 (e.g. AS has no openid-configuration) becomes a 502', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }))

    const res = await get('/.well-known/openid-configuration', { AUTHKIT_DOMAIN: 'mirror5.authkit.app' })
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('upstream_fetch_failed')
  })
})

describe('Site-wide login gate — exempt paths still work with zero cookies', () => {
  it('/mcp (GET discovery) needs no session cookie', async () => {
    const res = await get('/mcp', SITE_ENV)
    expect(res.status).toBe(200)
  })

  it('/mcp (POST JSON-RPC) needs no session cookie', async () => {
    const res = await post('/mcp', rpc('tools/list', {}, 1), SITE_ENV)
    expect(res.status).toBe(200)
  })

  it('/.well-known/oauth-protected-resource needs no session cookie', async () => {
    const res = await get('/.well-known/oauth-protected-resource', SITE_ENV)
    expect(res.status).toBe(404) // auth not configured for /mcp in this env — still reachable, not redirected
  })

  it('/.well-known/mcp/server-card.json needs no session cookie', async () => {
    const res = await get('/.well-known/mcp/server-card.json', SITE_ENV)
    expect(res.status).toBe(200)
  })

  it('/auth.md needs no session cookie', async () => {
    const res = await get('/auth.md', SITE_ENV)
    expect(res.status).toBe(200)
  })

  it('/register needs no session cookie', async () => {
    const res = await get('/register', SITE_ENV)
    expect(res.status).toBe(404) // registration_not_supported stub — reachable, not redirected
  })
})

describe('Site-wide login gate — protected paths', () => {
  it('redirects an unauthenticated request for "/" to /login with return_to set', async () => {
    const res = await get('/', SITE_ENV)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe(`/login?return_to=${encodeURIComponent('/')}`)
  })

  it('redirects an unauthenticated request for a deep path, preserving path + query in return_to', async () => {
    const res = await get('/studio?category=gold', SITE_ENV)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe(`/login?return_to=${encodeURIComponent('/studio?category=gold')}`)
  })

  it('denies access (redirects, never passes through) when SESSION_SECRET is unset entirely', async () => {
    // Fail CLOSED: no SESSION_SECRET at all must behave exactly like "no
    // valid session", never like "auth is off".
    const res = await get('/', OPEN_ENV)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/login?return_to=')
  })

  it('lets a request with a valid session cookie through to the ASSETS catch-all', async () => {
    const cookie = await mintSessionCookie(SITE_ENV, { sub: 'user_123', email: 'bryan@nyuchi.com' })
    const res = await get('/', { ...SITE_ENV, ASSETS: ASSETS_STUB }, { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('stub-asset')
  })

  it('rejects a tampered session cookie and redirects to /login instead of crashing', async () => {
    const cookie = await mintSessionCookie(SITE_ENV, { sub: 'user_123' })
    const tampered = `${cookie.slice(0, -4)}abcd`
    const res = await get('/', { ...SITE_ENV, ASSETS: ASSETS_STUB }, { Cookie: `${SESSION_COOKIE_NAME}=${tampered}` })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/login?return_to=')
  })
})

describe('GET /login', () => {
  it('returns 500 (fails closed) when SESSION_SECRET is not configured', async () => {
    const res = await get('/login', OPEN_ENV)
    expect(res.status).toBe(500)
  })

  it('sets the oauth cookie and redirects to the authorize endpoint with the right params', async () => {
    const res = await get('/login', SITE_ENV)
    expect(res.status).toBe(302)

    const location = res.headers.get('Location')
    expect(location).toBeTruthy()
    const url = new URL(location!)
    expect(url.origin + url.pathname).toBe('https://identity.nyuchi.com/oauth2/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe(SITE_CLIENT_ID)
    expect(url.searchParams.get('redirect_uri')).toBe('https://tools.nyuchi.com/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('code_challenge')).toBeTruthy()

    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain(`${OAUTH_COOKIE_NAME}=`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')

    const oauthValue = cookieValueFrom(setCookie, OAUTH_COOKIE_NAME)
    const payload = decodeOauthCookie(oauthValue ?? undefined)
    expect(payload?.state).toBe(url.searchParams.get('state'))
    expect(payload?.returnTo).toBe('/')
  })

  it('rejects an absolute-URL return_to and stores "/" instead', async () => {
    const res = await get(`/login?return_to=${encodeURIComponent('https://evil.com')}`, SITE_ENV)
    expect(res.status).toBe(302)
    const oauthValue = cookieValueFrom(res.headers.get('Set-Cookie'), OAUTH_COOKIE_NAME)
    const payload = decodeOauthCookie(oauthValue ?? undefined)
    expect(payload?.returnTo).toBe('/')
  })

  it('rejects a protocol-relative return_to ("//evil.com") and stores "/" instead', async () => {
    const res = await get(`/login?return_to=${encodeURIComponent('//evil.com')}`, SITE_ENV)
    const oauthValue = cookieValueFrom(res.headers.get('Set-Cookie'), OAUTH_COOKIE_NAME)
    const payload = decodeOauthCookie(oauthValue ?? undefined)
    expect(payload?.returnTo).toBe('/')
  })

  it('rejects a return_to containing a CRLF (header-injection attempt) and stores "/" instead', async () => {
    const res = await get(`/login?return_to=${encodeURIComponent('/studio\r\nSet-Cookie: evil=1')}`, SITE_ENV)
    expect(res.status).toBe(302)
    const oauthValue = cookieValueFrom(res.headers.get('Set-Cookie'), OAUTH_COOKIE_NAME)
    const payload = decodeOauthCookie(oauthValue ?? undefined)
    expect(payload?.returnTo).toBe('/')
  })

  it('accepts a legitimate same-origin relative return_to', async () => {
    const res = await get(`/login?return_to=${encodeURIComponent('/studio')}`, SITE_ENV)
    const oauthValue = cookieValueFrom(res.headers.get('Set-Cookie'), OAUTH_COOKIE_NAME)
    const payload = decodeOauthCookie(oauthValue ?? undefined)
    expect(payload?.returnTo).toBe('/studio')
  })
})

describe('GET /callback', () => {
  it('redirects to /login without crashing when there is no oauth cookie at all', async () => {
    const res = await get(`${CALLBACK_PATH}?code=abc&state=whatever`, SITE_ENV)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?error=1')
  })

  it('redirects to /login on a state mismatch, without ever attempting the token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const oauthCookie = encodeOauthCookie({ state: 'expected-state', codeVerifier: 'verifier', returnTo: '/studio' })
    const res = await get(
      `${CALLBACK_PATH}?code=abc&state=WRONG-STATE`,
      SITE_ENV,
      { Cookie: `${OAUTH_COOKIE_NAME}=${oauthCookie}` },
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?error=1')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('redirects to /login when the code is missing', async () => {
    const oauthCookie = encodeOauthCookie({ state: 'expected-state', codeVerifier: 'verifier', returnTo: '/' })
    const res = await get(`${CALLBACK_PATH}?state=expected-state`, SITE_ENV, {
      Cookie: `${OAUTH_COOKIE_NAME}=${oauthCookie}`,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?error=1')
  })

  it('redirects to /login (never crashes) when SESSION_SECRET is unset, even with matching state', async () => {
    const oauthCookie = encodeOauthCookie({ state: 'expected-state', codeVerifier: 'verifier', returnTo: '/' })
    const res = await get(`${CALLBACK_PATH}?code=abc&state=expected-state`, OPEN_ENV, {
      Cookie: `${OAUTH_COOKIE_NAME}=${oauthCookie}`,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?error=1')
  })

  describe('successful exchange (mocked token + JWKS endpoints)', () => {
    const CALLBACK_ENV = { SESSION_SECRET: TEST_SESSION_SECRET, AUTHKIT_DOMAIN: 'identity.nyuchi.com' }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** Sign a real id_token with a locally-generated RS256 keypair, and mock
     * fetch so the token endpoint returns it and the JWKS endpoint serves
     * its matching public key — exercising the ACTUAL jose/JWKS verification
     * path (`verifyJwt`), not just the surrounding cookie/redirect plumbing. */
    async function mockSuccessfulExchange(claims: { sub: string; email?: string }) {
      const { generateKeyPair, exportJWK, SignJWT } = await import('jose')
      const { publicKey, privateKey } = await generateKeyPair('RS256')
      const publicJwk = await exportJWK(publicKey)
      const kid = 'test-key-1'
      const idToken = await new SignJWT({ email: claims.email })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt()
        .setIssuer('https://identity.nyuchi.com')
        .setAudience(SITE_CLIENT_ID)
        .setSubject(claims.sub)
        .setExpirationTime('5m')
        .sign(privateKey)

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url === 'https://identity.nyuchi.com/oauth2/token') {
          return new Response(
            JSON.stringify({ access_token: 'unused-access-token', id_token: idToken, token_type: 'Bearer', expires_in: 300 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url === 'https://identity.nyuchi.com/oauth2/jwks') {
          return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid, alg: 'RS256', use: 'sig' }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        throw new Error(`Unexpected fetch in test: ${url}`)
      })
    }

    it('verifies the id_token (not the access_token) and mints a session cookie', async () => {
      await mockSuccessfulExchange({ sub: 'user_123', email: 'bryan@nyuchi.com' })
      const oauthCookie = encodeOauthCookie({ state: 'expected-state', codeVerifier: 'verifier', returnTo: '/studio' })
      const res = await get(`${CALLBACK_PATH}?code=test-code&state=expected-state`, CALLBACK_ENV, {
        Cookie: `${OAUTH_COOKIE_NAME}=${oauthCookie}`,
      })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/studio')

      const setCookie = res.headers.get('Set-Cookie')
      const sessionValue = cookieValueFrom(setCookie, SESSION_COOKIE_NAME)
      expect(sessionValue).toBeTruthy()
      const claims = await verifySessionCookie(CALLBACK_ENV, sessionValue ?? undefined)
      expect(claims).toEqual({ sub: 'user_123', email: 'bryan@nyuchi.com' })
    })

    it('denies login when the id_token audience is wrong (e.g. an access token used by mistake)', async () => {
      // Same as above, but sign the token with aud=resourceUrl (the /mcp
      // resource indicator) instead of aud=SITE_CLIENT_ID — the exact bug
      // this test guards against regressing to.
      const { generateKeyPair, exportJWK, SignJWT } = await import('jose')
      const { publicKey, privateKey } = await generateKeyPair('RS256')
      const publicJwk = await exportJWK(publicKey)
      const kid = 'test-key-2'
      const wrongAudienceToken = await new SignJWT({ email: 'bryan@nyuchi.com' })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt()
        .setIssuer('https://identity.nyuchi.com')
        .setAudience('https://tools.nyuchi.dev/mcp')
        .setSubject('user_123')
        .setExpirationTime('5m')
        .sign(privateKey)

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url === 'https://identity.nyuchi.com/oauth2/token') {
          return new Response(
            JSON.stringify({ access_token: 'unused', id_token: wrongAudienceToken, token_type: 'Bearer', expires_in: 300 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url === 'https://identity.nyuchi.com/oauth2/jwks') {
          return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid, alg: 'RS256', use: 'sig' }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        throw new Error(`Unexpected fetch in test: ${url}`)
      })

      const oauthCookie = encodeOauthCookie({ state: 'expected-state', codeVerifier: 'verifier', returnTo: '/' })
      const res = await get(`${CALLBACK_PATH}?code=test-code&state=expected-state`, CALLBACK_ENV, {
        Cookie: `${OAUTH_COOKIE_NAME}=${oauthCookie}`,
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/login?error=1')
      // denyLogin() proactively clears any stale session cookie (Max-Age=0,
      // empty value), which is a deletion, not a grant — assert the cookie
      // is being emptied out, not that some NEW valid session was minted.
      expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE_NAME}=;`)
    })

    it('denies login when the token response has no id_token', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url === 'https://identity.nyuchi.com/oauth2/token') {
          return new Response(JSON.stringify({ access_token: 'unused', token_type: 'Bearer', expires_in: 300 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        throw new Error(`Unexpected fetch in test: ${url}`)
      })
      const oauthCookie = encodeOauthCookie({ state: 'expected-state', codeVerifier: 'verifier', returnTo: '/' })
      const res = await get(`${CALLBACK_PATH}?code=test-code&state=expected-state`, CALLBACK_ENV, {
        Cookie: `${OAUTH_COOKIE_NAME}=${oauthCookie}`,
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/login?error=1')
    })
  })
})

describe('GET /logout', () => {
  it('clears the session cookie and redirects to "/"', async () => {
    const res = await get('/logout', SITE_ENV)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(setCookie).toMatch(/Max-Age=0/)
  })
})

describe('Session cookie (site-auth.ts)', () => {
  it('mints a cookie that verifies back to the same claims', async () => {
    const token = await mintSessionCookie(SITE_ENV, { sub: 'user_123', email: 'bryan@nyuchi.com' })
    const claims = await verifySessionCookie(SITE_ENV, token)
    expect(claims).toEqual({ sub: 'user_123', email: 'bryan@nyuchi.com' })
  })

  it('rejects a tampered cookie', async () => {
    const token = await mintSessionCookie(SITE_ENV, { sub: 'user_123' })
    const tampered = `${token.slice(0, -4)}abcd`
    expect(await verifySessionCookie(SITE_ENV, tampered)).toBeNull()
  })

  it('rejects a cookie signed with a different secret', async () => {
    const token = await mintSessionCookie(SITE_ENV, { sub: 'user_123' })
    expect(await verifySessionCookie({ SESSION_SECRET: 'a-different-secret' }, token)).toBeNull()
  })

  it('rejects an expired cookie', async () => {
    const key = new TextEncoder().encode(TEST_SESSION_SECRET)
    const now = Math.floor(Date.now() / 1000)
    const expired = await new SignJWT({ sub: 'user_123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 500)
      .sign(key)
    expect(await verifySessionCookie(SITE_ENV, expired)).toBeNull()
  })

  it('treats a missing SESSION_SECRET as "no valid session" (fails closed, not open)', async () => {
    const token = await mintSessionCookie(SITE_ENV, { sub: 'user_123' })
    expect(await verifySessionCookie({}, token)).toBeNull()
  })

  it('rejects an empty/undefined cookie value', async () => {
    expect(await verifySessionCookie(SITE_ENV, undefined)).toBeNull()
  })
})

describe('POST /api/signature', () => {
  const TEST_API_KEY = 'test-signature-api-key'
  /** Bearer path configured; SESSION_SECRET too so both auth paths exist. */
  const SIG_ENV = { ...SITE_ENV, SIGNATURE_API_KEY: TEST_API_KEY }

  const PARAMS = {
    brand: 'nyuchi' as const,
    name: 'Tariro Chikafu',
    email: 'tariro@nyuchi.com',
    title: 'Operations Lead',
    phone: '+263 77 000 0000',
  }

  function postSignature(body: unknown, env: Env, headers: Record<string, string> = {}) {
    return Promise.resolve(
      worker.fetch(
        new Request(`${BASE}/api/signature`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
        env,
      ),
    )
  }

  it('bearer auth returns HTML byte-equal to buildSignatureHtml', async () => {
    const res = await postSignature(PARAMS, SIG_ENV, { Authorization: `Bearer ${TEST_API_KEY}` })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { html: string }
    expect(body.html).toBe(buildSignatureHtml(PARAMS))
    expect(body.html.startsWith('<table')).toBe(true)
  })

  it('a valid site session cookie also authorizes, with identical output', async () => {
    const cookie = await mintSessionCookie(SITE_ENV, { sub: 'user_123', email: 'bryan@nyuchi.com' })
    const res = await postSignature(PARAMS, SIG_ENV, { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { html: string }
    expect(body.html).toBe(buildSignatureHtml(PARAMS))
  })

  it('rejects a wrong bearer token with 401 JSON', async () => {
    const res = await postSignature(PARAMS, SIG_ENV, { Authorization: 'Bearer wrong-key' })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('unauthorized')
  })

  it('a wrong bearer never falls back to the cookie path (explicit credential is judged on its own)', async () => {
    const cookie = await mintSessionCookie(SITE_ENV, { sub: 'user_123' })
    const res = await postSignature(PARAMS, SIG_ENV, {
      Authorization: 'Bearer wrong-key',
      Cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
    })
    expect(res.status).toBe(401)
  })

  it('rejects a request with neither bearer nor cookie with 401 JSON — not a login redirect', async () => {
    // The route is exempt from the site-wide login gate: an unauthenticated
    // POST must get the route's own 401 JSON, never the gate's 302.
    const res = await postSignature(PARAMS, SIG_ENV)
    expect(res.status).toBe(401)
    expect(res.headers.get('Location')).toBeNull()
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('unauthorized')
    expect(body.detail).toContain('SIGNATURE_API_KEY')
  })

  it('fails closed with a clear detail when SIGNATURE_API_KEY is unset and a bearer is attempted', async () => {
    const res = await postSignature(PARAMS, SITE_ENV, { Authorization: `Bearer ${TEST_API_KEY}` })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('unauthorized')
    expect(body.detail).toContain('SIGNATURE_API_KEY')
    expect(body.detail).toContain('unset')
  })

  it('rejects invalid params (unknown brand, missing name) with 400 and zod issues', async () => {
    const res = await postSignature(
      { brand: 'acme', email: 'x@x.com' },
      SIG_ENV,
      { Authorization: `Bearer ${TEST_API_KEY}` },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; issues: { path: (string | number)[] }[] }
    expect(body.error).toBe('invalid_params')
    expect(Array.isArray(body.issues)).toBe(true)
    const paths = body.issues.map((i) => i.path.join('.'))
    expect(paths).toContain('brand')
    expect(paths).toContain('name')
  })

  it('rejects a non-JSON body with 400 invalid_params', async () => {
    const res = await postSignature('{not json', SIG_ENV, { Authorization: `Bearer ${TEST_API_KEY}` })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_params')
  })

  it('emits HTML byte-identical to the generate_email_signature MCP tool', async () => {
    const httpRes = await postSignature(PARAMS, SIG_ENV, { Authorization: `Bearer ${TEST_API_KEY}` })
    const { html } = (await httpRes.json()) as { html: string }
    const mcpRes = await post(
      '/mcp',
      rpc('tools/call', { name: 'generate_email_signature', arguments: PARAMS }, 70),
    )
    const mcpBody = (await mcpRes.json()) as JsonRpcResponse
    const mcpHtml = (mcpBody.result as { content: { text: string }[] }).content[0].text
    expect(html).toBe(mcpHtml)
  })
})

// -----------------------------------------------------------------------------
// Google OAuth plumbing + self insert (mcp/src/google-auth.ts).
// -----------------------------------------------------------------------------

/** Google OAuth fully configured (values fake; Google endpoints are mocked
 * per test — no live calls). */
const GOOGLE_ENV = {
  SESSION_SECRET: TEST_SESSION_SECRET,
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
}

/** Every /api/google/* and /api/self/* path sits BEHIND the site login
 * gate, so requests need a valid `nyuchi_session` cookie to get through. */
async function siteSessionCookie(): Promise<string> {
  const value = await mintSessionCookie(SITE_ENV, { sub: 'user_123', email: 'bryan@nyuchi.com' })
  return `${SESSION_COOKIE_NAME}=${value}`
}

function request(path: string, env: Env, init: RequestInit): Promise<Response> {
  return Promise.resolve(worker.fetch(new Request(`${BASE}${path}`, init), env))
}

function futureGoogleSession(overrides: Partial<GoogleSession> = {}): GoogleSession {
  return {
    access_token: 'ya29.test-access-token',
    expiry: Math.floor(Date.now() / 1000) + 3600,
    scopes: ['openid', 'email', GMAIL_SETTINGS_BASIC_SCOPE],
    email: 'bryan@nyuchi.com',
    ...overrides,
  }
}

describe('Google session cookie (google-auth.ts) — encrypt/decrypt', () => {
  it('round-trips a session through encrypt → decrypt', async () => {
    const session = futureGoogleSession({ refresh_token: '1//refresh' })
    const value = await encryptGoogleSession(GOOGLE_ENV, session)
    expect(await decryptGoogleSession(GOOGLE_ENV, value)).toEqual(session)
  })

  it('produces a different ciphertext each time (random IV) that still decrypts', async () => {
    const session = futureGoogleSession()
    const a = await encryptGoogleSession(GOOGLE_ENV, session)
    const b = await encryptGoogleSession(GOOGLE_ENV, session)
    expect(a).not.toBe(b)
    expect(await decryptGoogleSession(GOOGLE_ENV, b)).toEqual(session)
  })

  it('encrypt throws when SESSION_SECRET is unset (fails closed, never plaintext)', async () => {
    await expect(encryptGoogleSession({}, futureGoogleSession())).rejects.toThrow('SESSION_SECRET')
  })

  it('decrypt returns null for a tampered cookie', async () => {
    const value = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    const tampered = `${value.slice(0, -4)}AAAA`
    expect(await decryptGoogleSession(GOOGLE_ENV, tampered)).toBeNull()
  })

  it('decrypt returns null under a different secret', async () => {
    const value = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    expect(await decryptGoogleSession({ SESSION_SECRET: 'another-secret' }, value)).toBeNull()
  })

  it('decrypt returns null when SESSION_SECRET is unset (fails closed, not open)', async () => {
    const value = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    expect(await decryptGoogleSession({}, value)).toBeNull()
  })

  it('decrypt returns null for garbage / empty values', async () => {
    expect(await decryptGoogleSession(GOOGLE_ENV, undefined)).toBeNull()
    expect(await decryptGoogleSession(GOOGLE_ENV, '')).toBeNull()
    expect(await decryptGoogleSession(GOOGLE_ENV, 'not-base64url-!!!')).toBeNull()
    expect(await decryptGoogleSession(GOOGLE_ENV, 'AAAA')).toBeNull()
  })
})

describe('GET /api/google/login', () => {
  it('sits behind the site login gate (no site session → redirect to /login)', async () => {
    const res = await get('/api/google/login', GOOGLE_ENV)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/login?return_to=')
  })

  it('fails clearly (JSON 503, not a broken redirect) when Google OAuth is unconfigured', async () => {
    const res = await request('/api/google/login', SITE_ENV, {
      headers: { Cookie: await siteSessionCookie() },
    })
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('google_not_configured')
    expect(body.detail).toContain('GOOGLE_CLIENT_ID')
  })

  it('never 302s to Google when SESSION_SECRET is missing (fails closed)', async () => {
    const env = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec' }
    const res = await get('/api/google/login', env)
    // Without SESSION_SECRET there is no site session either, so the gate
    // redirects to /login first — either way, nothing reaches Google.
    expect(res.headers.get('Location') ?? '').not.toContain('accounts.google.com')
  })

  it('mode=self: 302 to Google authorize with the self scopes and a state cookie', async () => {
    const res = await request('/api/google/login?mode=self', GOOGLE_ENV, {
      headers: { Cookie: await siteSessionCookie() },
    })
    expect(res.status).toBe(302)
    const url = new URL(res.headers.get('Location')!)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('google-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe(`${BASE}${GOOGLE_CALLBACK_PATH}`)
    expect(url.searchParams.get('scope')).toBe(`openid email ${GMAIL_SETTINGS_BASIC_SCOPE}`)
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('include_granted_scopes')).toBe('true')

    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain(`${GOOGLE_STATE_COOKIE_NAME}=`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
    const state = cookieValueFrom(setCookie, GOOGLE_STATE_COOKIE_NAME)
    expect(state).toBeTruthy()
    expect(url.searchParams.get('state')).toBe(state)
  })

  it('mode=admin: scope additionally carries admin.directory.user.readonly', async () => {
    const res = await request('/api/google/login?mode=admin', GOOGLE_ENV, {
      headers: { Cookie: await siteSessionCookie() },
    })
    expect(res.status).toBe(302)
    const url = new URL(res.headers.get('Location')!)
    expect(url.searchParams.get('scope')).toBe(
      `openid email ${GMAIL_SETTINGS_BASIC_SCOPE} https://www.googleapis.com/auth/admin.directory.user.readonly`,
    )
  })

  it('defaults to the self scopes when mode is absent', async () => {
    const res = await request('/api/google/login', GOOGLE_ENV, {
      headers: { Cookie: await siteSessionCookie() },
    })
    const url = new URL(res.headers.get('Location')!)
    expect(url.searchParams.get('scope')).toBe(`openid email ${GMAIL_SETTINGS_BASIC_SCOPE}`)
  })
})

describe('GET /api/google/callback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a state mismatch cleanly — no token exchange, no session cookie', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await request(`${GOOGLE_CALLBACK_PATH}?code=abc&state=WRONG`, GOOGLE_ENV, {
      headers: {
        Cookie: `${await siteSessionCookie()}; ${GOOGLE_STATE_COOKIE_NAME}=expected-state`,
      },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/signature-generator?google=error')
    expect(fetchSpy).not.toHaveBeenCalled()
    // Only the state cookie is cleared; no `nyuchi_google` session cookie
    // is ever set on a failed callback.
    expect(res.headers.get('Set-Cookie') ?? '').not.toContain(`${GOOGLE_COOKIE_NAME}=`)
  })

  it('rejects a callback with no state cookie at all', async () => {
    const res = await request(`${GOOGLE_CALLBACK_PATH}?code=abc&state=whatever`, GOOGLE_ENV, {
      headers: { Cookie: await siteSessionCookie() },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/signature-generator?google=error')
    expect(res.headers.get('Set-Cookie') ?? '').not.toContain(`${GOOGLE_COOKIE_NAME}=`)
  })

  it('rejects a callback when Google OAuth is unconfigured', async () => {
    const res = await request(`${GOOGLE_CALLBACK_PATH}?code=abc&state=s`, SITE_ENV, {
      headers: { Cookie: `${await siteSessionCookie()}; ${GOOGLE_STATE_COOKIE_NAME}=s` },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/signature-generator?google=error')
  })

  it('exchanges the code, fetches the userinfo email, and sets the encrypted session cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === 'https://oauth2.googleapis.com/token') {
        const params = new URLSearchParams(String(init?.body))
        expect(params.get('grant_type')).toBe('authorization_code')
        expect(params.get('code')).toBe('auth-code-1')
        expect(params.get('client_id')).toBe('google-client-id')
        expect(params.get('client_secret')).toBe('google-client-secret')
        expect(params.get('redirect_uri')).toBe(`${BASE}${GOOGLE_CALLBACK_PATH}`)
        return new Response(
          JSON.stringify({
            access_token: 'ya29.fresh',
            refresh_token: '1//refresh-1',
            expires_in: 3599,
            scope: `openid email ${GMAIL_SETTINGS_BASIC_SCOPE}`,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
        expect(auth).toBe('Bearer ya29.fresh')
        return new Response(JSON.stringify({ email: 'bryan@nyuchi.com', email_verified: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      throw new Error(`Unexpected fetch in test: ${url}`)
    })

    const res = await request(`${GOOGLE_CALLBACK_PATH}?code=auth-code-1&state=expected-state`, GOOGLE_ENV, {
      headers: {
        Cookie: `${await siteSessionCookie()}; ${GOOGLE_STATE_COOKIE_NAME}=expected-state`,
      },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/signature-generator')

    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain(`${GOOGLE_COOKIE_NAME}=`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
    const cookieValue = cookieValueFrom(setCookie, GOOGLE_COOKIE_NAME)
    const session = await decryptGoogleSession(GOOGLE_ENV, cookieValue ?? undefined)
    expect(session).toMatchObject({
      access_token: 'ya29.fresh',
      refresh_token: '1//refresh-1',
      email: 'bryan@nyuchi.com',
      scopes: ['openid', 'email', GMAIL_SETTINGS_BASIC_SCOPE],
    })
    expect(session!.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('denies (no cookie) when the token exchange fails upstream', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    )
    const res = await request(`${GOOGLE_CALLBACK_PATH}?code=bad&state=expected-state`, GOOGLE_ENV, {
      headers: {
        Cookie: `${await siteSessionCookie()}; ${GOOGLE_STATE_COOKIE_NAME}=expected-state`,
      },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/signature-generator?google=error')
    expect(res.headers.get('Set-Cookie') ?? '').not.toContain(`${GOOGLE_COOKIE_NAME}=`)
  })
})

describe('GET /api/google/status', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports {connected:false} with no Google cookie', async () => {
    const res = await request('/api/google/status', GOOGLE_ENV, {
      headers: { Cookie: await siteSessionCookie() },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ connected: false })
  })

  it('reports {connected:false} for an undecryptable cookie', async () => {
    const res = await request('/api/google/status', GOOGLE_ENV, {
      headers: { Cookie: `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=garbage` },
    })
    expect(await res.json()).toEqual({ connected: false })
  })

  it('reports connected with email + scopes (never tokens) for a live session', async () => {
    const cookie = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    const res = await request('/api/google/status', GOOGLE_ENV, {
      headers: { Cookie: `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toEqual({
      connected: true,
      email: 'bryan@nyuchi.com',
      scopes: ['openid', 'email', GMAIL_SETTINGS_BASIC_SCOPE],
    })
    expect(JSON.stringify(body)).not.toContain('ya29.')
  })

  it('refreshes an expired access token via the refresh_token and re-sets the cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === 'https://oauth2.googleapis.com/token') {
        const params = new URLSearchParams(String(init?.body))
        expect(params.get('grant_type')).toBe('refresh_token')
        expect(params.get('refresh_token')).toBe('1//refresh-2')
        return new Response(
          JSON.stringify({ access_token: 'ya29.renewed', expires_in: 3600, token_type: 'Bearer' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      throw new Error(`Unexpected fetch in test: ${url}`)
    })
    const expired = futureGoogleSession({
      expiry: Math.floor(Date.now() / 1000) - 10,
      refresh_token: '1//refresh-2',
    })
    const cookie = await encryptGoogleSession(GOOGLE_ENV, expired)
    const res = await request('/api/google/status', GOOGLE_ENV, {
      headers: { Cookie: `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ connected: true, email: 'bryan@nyuchi.com' })
    const setCookie = res.headers.get('Set-Cookie')
    const renewed = await decryptGoogleSession(GOOGLE_ENV, cookieValueFrom(setCookie, GOOGLE_COOKIE_NAME) ?? undefined)
    expect(renewed).toMatchObject({ access_token: 'ya29.renewed', refresh_token: '1//refresh-2' })
  })

  it('reports {connected:false} when the refresh fails (revoked token)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    )
    const expired = futureGoogleSession({
      expiry: Math.floor(Date.now() / 1000) - 10,
      refresh_token: '1//revoked',
    })
    const cookie = await encryptGoogleSession(GOOGLE_ENV, expired)
    const res = await request('/api/google/status', GOOGLE_ENV, {
      headers: { Cookie: `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}` },
    })
    expect(await res.json()).toEqual({ connected: false })
  })

  it('reports {connected:false} when expired with no refresh_token', async () => {
    const expired = futureGoogleSession({ expiry: Math.floor(Date.now() / 1000) - 10 })
    const cookie = await encryptGoogleSession(GOOGLE_ENV, expired)
    const res = await request('/api/google/status', GOOGLE_ENV, {
      headers: { Cookie: `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}` },
    })
    expect(await res.json()).toEqual({ connected: false })
  })
})

describe('refreshIfNeeded (google-auth.ts)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes a still-valid session through untouched (no network)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const session = futureGoogleSession()
    expect(await refreshIfNeeded(GOOGLE_ENV, session)).toEqual({ session, refreshed: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns null for an expired session when Google OAuth is unconfigured (cannot refresh)', async () => {
    const expired = futureGoogleSession({
      expiry: Math.floor(Date.now() / 1000) - 10,
      refresh_token: '1//refresh',
    })
    expect(await refreshIfNeeded({ SESSION_SECRET: TEST_SESSION_SECRET }, expired)).toBeNull()
  })
})

describe('POST /api/google/logout', () => {
  it('clears the Google cookie and answers {ok:true}', async () => {
    const res = await request('/api/google/logout', GOOGLE_ENV, {
      method: 'POST',
      headers: { Cookie: await siteSessionCookie() },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain(`${GOOGLE_COOKIE_NAME}=;`)
    expect(setCookie).toMatch(/Max-Age=0/)
  })
})

describe('POST /api/self/insert', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const PARAMS = {
    brand: 'nyuchi' as const,
    name: 'Bryan Fawcett',
    email: 'bryan@nyuchi.com',
    title: 'Founder',
  }

  function insert(env: Env, cookie: string, body: unknown = PARAMS): Promise<Response> {
    return request('/api/self/insert', env, {
      method: 'POST',
      headers: { Cookie: cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('sits behind the site login gate (no site session → redirect to /login)', async () => {
    const res = await request('/api/self/insert', GOOGLE_ENV, { method: 'POST' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/login?return_to=')
  })

  it('401 google_not_connected without a Google session cookie', async () => {
    const res = await insert(GOOGLE_ENV, await siteSessionCookie())
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('google_not_connected')
  })

  it('401 google_not_connected when the session lacks the gmail.settings.basic scope', async () => {
    const noScope = futureGoogleSession({ scopes: ['openid', 'email'] })
    const cookie = await encryptGoogleSession(GOOGLE_ENV, noScope)
    const res = await insert(GOOGLE_ENV, `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}`)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('google_not_connected')
    expect(body.detail).toContain(GMAIL_SETTINGS_BASIC_SCOPE)
  })

  it('400 invalid_params for a body that fails the signature schema', async () => {
    const cookie = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    const res = await insert(
      GOOGLE_ENV,
      `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}`,
      { brand: 'not-a-brand', name: 'x' },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_params')
  })

  it('PATCHes the engine-rendered signature to the session email send-as (happy path)', async () => {
    let patchUrl = ''
    let patchInit: RequestInit | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      patchUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      patchInit = init
      return new Response(JSON.stringify({ sendAsEmail: 'bryan@nyuchi.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const cookie = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    const res = await insert(GOOGLE_ENV, `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, email: 'bryan@nyuchi.com', sendAs: 'bryan@nyuchi.com' })

    expect(patchUrl).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/bryan%40nyuchi.com',
    )
    expect(patchInit?.method).toBe('PATCH')
    expect((patchInit?.headers as Record<string, string>).Authorization).toBe('Bearer ya29.test-access-token')
    // The body is exactly {signature: <byte-locked engine output>} — the
    // same HTML the MCP tool and the web preview emit for these params.
    const sent = JSON.parse(String(patchInit?.body)) as { signature: string }
    expect(sent).toEqual({ signature: buildSignatureHtml(PARAMS) })
  })

  it('502 gmail_api_error surfacing the upstream message (never the token)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 403, message: 'Insufficient Permission' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const cookie = await encryptGoogleSession(GOOGLE_ENV, futureGoogleSession())
    const res = await insert(GOOGLE_ENV, `${await siteSessionCookie()}; ${GOOGLE_COOKIE_NAME}=${cookie}`)
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('gmail_api_error')
    expect(body.detail).toContain('403')
    expect(body.detail).toContain('Insufficient Permission')
    expect(JSON.stringify(body)).not.toContain('ya29.')
  })
})
