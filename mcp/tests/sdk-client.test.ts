/* SDK-level tests for the nyuchi-tools MCP server.
 *
 * worker.test.ts drives /mcp with raw HTTP. These tests go through the
 * official MCP TypeScript SDK client instead: a real `Client` over the real
 * Streamable HTTP client transport, whose `fetch` is routed into
 * `worker.fetch(...)`. So a client library talking to the deployed endpoint
 * sees exactly this: the handshake, `tools/list`, typed tool results and
 * resources, with nothing hand-built on either side.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import worker from '../src/index'

/** Local-development opt-out: no bearer token, but only on localhost. */
const ENV = {
  ALLOW_UNAUTHENTICATED_DEV: 'true',
  ASSETS: {
    fetch: async (req: Request) => {
      const url = new URL(req.url)
      if (url.pathname.endsWith('.b64.txt')) return new Response('ZmFrZS1pY29uLWJ5dGVz')
      if (url.pathname.startsWith('/fonts/raster/')) {
        const file = join(__dirname, '../../signature-generator/public', url.pathname)
        return new Response(new Uint8Array(readFileSync(file)))
      }
      return new Response('not found', { status: 404 })
    },
  },
}

const MCP_URL = new URL('http://localhost:8787/mcp')

let client: Client | undefined

async function connect(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(MCP_URL, {
    fetch: (input, init) => Promise.resolve(worker.fetch(new Request(input, init), ENV)),
  })
  client = new Client({ name: 'nyuchi-tools-sdk-test', version: '0.0.0' })
  await client.connect(transport)
  return client
}

afterEach(async () => {
  await client?.close()
  client = undefined
})

describe('nyuchi-tools through the MCP SDK client', () => {
  it('connects and lists the four tools, each with a title and all four annotations', async () => {
    const c = await connect()
    const { tools } = await c.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'nyuchi_generate_email_signature',
      'nyuchi_generate_studio_card',
      'nyuchi_report_issue',
      'nyuchi_upload_asset',
    ])
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy()
      expect(tool.description!.length, tool.name).toBeGreaterThan(40)
      const a = tool.annotations!
      for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
        expect(typeof a[hint], `${tool.name}.${hint}`).toBe('boolean')
      }
    }
  })

  it('advertises bounded input schemas', async () => {
    const c = await connect()
    const { tools } = await c.listTools()
    const sig = tools.find((t) => t.name === 'nyuchi_generate_email_signature')!
    const props = sig.inputSchema.properties as Record<string, { maxLength?: number; description?: string }>
    expect(props.name.maxLength).toBe(200)
    expect(props.email.maxLength).toBe(254)
    for (const [key, prop] of Object.entries(props)) expect(prop.description, key).toBeTruthy()
    const upload = tools.find((t) => t.name === 'nyuchi_upload_asset')!
    expect(upload.outputSchema).toBeDefined()
  })

  it('calls nyuchi_generate_email_signature and gets the signature HTML', async () => {
    const c = await connect()
    const result = await c.callTool({
      name: 'nyuchi_generate_email_signature',
      arguments: { brand: 'nyuchi', name: 'Tendai Moyo', email: 'tendai@nyuchi.com' },
    })
    expect(result.isError).toBeFalsy()
    const text = (result.content as { type: string; text: string }[])[0].text
    expect(text).toContain('Tendai Moyo')
    expect(text).toContain('tendai@nyuchi.com')
  })

  it('calls nyuchi_generate_studio_card in svg mode', async () => {
    const c = await connect()
    const result = await c.callTool({
      name: 'nyuchi_generate_studio_card',
      arguments: { title: 'Hive', category: 'gold', layout: 1, returnFormat: 'svg' },
    })
    expect(result.isError).toBeFalsy()
    const [svg, meta] = result.content as { type: string; text: string }[]
    expect(svg.text.startsWith('<svg')).toBe(true)
    expect(JSON.parse(meta.text).format).toEqual({ w: 1080, h: 1080 })
  })

  it('rasterizes a studio card through the SDK (the PNG path still works)', async () => {
    const c = await connect()
    const result = await c.callTool({
      name: 'nyuchi_generate_studio_card',
      arguments: { title: 'Raster', category: 'cobalt', returnFormat: 'png' },
    })
    expect(result.isError).toBeFalsy()
    const [image] = result.content as { type: string; mimeType: string; data: string }[]
    expect(image.type).toBe('image')
    expect(image.mimeType).toBe('image/png')
    expect(image.data.length).toBeGreaterThan(1000)
  })

  it('returns invalid input as an isError tool result, not a protocol error', async () => {
    const c = await connect()
    const result = await c.callTool({
      name: 'nyuchi_generate_email_signature',
      arguments: { brand: 'acme', name: 'X', email: 'x@y.z' },
    })
    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0].text).toContain('brand')
  })

  it('returns an unconfigured upload as an actionable isError result', async () => {
    const c = await connect()
    const result = await c.callTool({
      name: 'nyuchi_upload_asset',
      arguments: { svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    })
    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0].text).toContain('not configured')
  })

  it('reads resources and gets prompts', async () => {
    const c = await connect()
    const { resources } = await c.listResources()
    expect(resources.map((r) => r.uri)).toContain('nyuchi://minerals')
    const minerals = await c.readResource({ uri: 'nyuchi://minerals' })
    const data = JSON.parse((minerals.contents[0] as { text: string }).text)
    expect(data.minerals.malachite.role).toBe('Growth')
    const prompt = await c.getPrompt({ name: 'mineral_education_card', arguments: { mineral: 'gold' } })
    expect((prompt.messages[0].content as { text: string }).text).toContain("category 'gold'")
  })
})
