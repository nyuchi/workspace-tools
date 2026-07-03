/* HTTP-level tests for the nyuchi-tools Worker (mcp/src/index.ts).
 *
 * The Worker is a plain Hono app exported as `{ fetch }`, with no
 * cloudflare:-namespace imports, so it runs under node vitest by calling
 * `worker.fetch(new Request(...), env)` directly — the same entrypoint the
 * Workers runtime uses. Bindings (AUTHKIT_DOMAIN / MCP_RESOURCE) are passed
 * as the `env` argument.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../src/index'

const BASE = 'https://tools.nyuchi.com'

/** No auth configured: the MCP server runs open. */
const OPEN_ENV = {}

/** Auth configured: WorkOS AuthKit protects /mcp. */
const AUTH_ENV = { AUTHKIT_DOMAIN: 'x.authkit.app' }

type Env = Record<string, string>

function get(path: string, env: Env = OPEN_ENV): Promise<Response> {
  return Promise.resolve(worker.fetch(new Request(`${BASE}${path}`), env))
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
  it('returns the server identity JSON', async () => {
    const res = await get('/mcp')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      name: 'nyuchi-tools',
      version: '0.1.0',
      protocol: 'mcp/2024-11-05',
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

  it('tools/list exposes exactly the three tools', async () => {
    const res = await post('/mcp', rpc('tools/list', {}, 2))
    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    const tools = (body.result as { tools: { name: string }[] }).tools
    expect(tools.map((t) => t.name).sort()).toEqual([
      'generate_article_banner',
      'generate_email_signature',
      'generate_studio_card',
    ])
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
    expect(result.content[0].text).toContain("received 'acme'")
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

  it('tools/call generate_article_banner returns a real banner SVG plus JSON metadata', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_article_banner',
          arguments: {
            title: 'Speed is rented. Truth is owned.',
            dek: 'A note on local-first software and the cost of being online.',
            category: 'cobalt',
            format: 'og',
          },
        },
        15,
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
    expect(svg).toContain('viewBox="0 0 1200 630"')
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('height="630"')
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(5)
    expect((svg.match(/<line /g) ?? []).length).toBeGreaterThan(3)
    expect(svg.length).toBeGreaterThan(5000)
    expect(svg).not.toContain('placeholder')
    // The title may wrap across several <text> lines; check a fragment.
    expect(svg).toContain('Speed is rented.')

    const meta = JSON.parse(content[1].text) as { format: { w: number; h: number }; seed: number }
    expect(meta.format).toEqual({ w: 1200, h: 630 })
    expect(typeof meta.seed).toBe('number')
  })

  it('generate_article_banner defaults to 16x9 and keeps markup escaped', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_article_banner',
          arguments: { title: 'Attack <script>alert(1)</script>', category: 'terracotta' },
        },
        16,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const content = (body.result as { content: { text: string }[] }).content
    const svg = content[0].text
    expect(svg).toContain('viewBox="0 0 1600 900"')
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    const meta = JSON.parse(content[1].text) as { format: { w: number; h: number } }
    expect(meta.format).toEqual({ w: 1600, h: 900 })
  })

  it('generate_article_banner renders a shamwari-branded banner (lockup wordmark)', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_article_banner',
          arguments: { title: 'AI that actually works for Africa', category: 'sodalite', brand: 'shamwari' },
        },
        34,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    const svg = (body.result as { content: { text: string }[] }).content[0].text
    expect(svg).toContain('>shamwari.ai</text>')
    expect(svg).not.toContain('>nyuchi.com</text>')
  })

  it('generate_article_banner rejects an unknown brand', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_article_banner',
          arguments: { title: 'X', category: 'gold', brand: 'travel' },
        },
        35,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('-32602')
  })

  it('generate_article_banner rejects layout 5 (banner engine has layouts 1-4)', async () => {
    const res = await post(
      '/mcp',
      rpc(
        'tools/call',
        {
          name: 'generate_article_banner',
          arguments: { title: 'X', category: 'gold', layout: 5 },
        },
        17,
      ),
    )
    const body = (await res.json()) as JsonRpcResponse
    const result = body.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('-32602')
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
      resource: 'https://tools.nyuchi.com',
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
      'resource_metadata="https://tools.nyuchi.com/.well-known/oauth-protected-resource"',
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
        'MCP server for Nyuchi Africa tools: email signatures, Nyuchi Studio social cards, and article banners.',
      websiteUrl: 'https://tools.nyuchi.com',
      remotes: [{ transportType: 'streamable-http', url: 'https://tools.nyuchi.com/mcp' }],
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
    expect(body).toContain('tools.nyuchi.com is a resource server')
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
