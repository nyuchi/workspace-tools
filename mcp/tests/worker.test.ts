/* HTTP-level tests for the nyuchi-tools Worker (mcp/src/index.ts).
 *
 * The Worker is a plain Hono app exported as `{ fetch }`, with no
 * cloudflare:-namespace imports, so it runs under node vitest by calling
 * `worker.fetch(new Request(...), env)` directly — the same entrypoint the
 * Workers runtime uses. Bindings (AUTHKIT_DOMAIN / MCP_RESOURCE) are passed
 * as the `env` argument.
 */

import { describe, expect, it } from 'vitest'
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
