/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs'
import path from 'node:path'
import { Client, ClientOptions } from '@elastic/elasticsearch'
import envPaths from 'env-paths'

const envPath = envPaths('lsp-elasticsearch-console')
const SPEC_CACHE = path.join(envPath.data, 'specification', 'elasticsearch')

let client: Client | undefined
const methods: Record<string, string[]> = {}
const paths: Set<string> = new Set()

interface UrlTemplate {
  path: string
  methods: string[]
}

interface Endpoint {
  urls: UrlTemplate[]
  request: { name: string, namespace: string }
}

interface Type {
  kind: string
  name: { name: string, namespace: string }
  path?: []
}

interface Schema {
  endpoints: Endpoint[]
  types: Type[]
}

let _indices: string[]
export async function indices() {
  if (_indices == null) {
    const client = getClient()
    if (client == null) return
    const res = await client.indices.get({ index: '*', expand_wildcards: 'all' })
    _indices = Object.keys(res)
  }
  return _indices
}

async function loadSchema(branch = "main") {
  // attempt to load from file cache
  const schemaDir = path.join(SPEC_CACHE, branch)
  fs.mkdirSync(schemaDir, { recursive: true })
  const schemaPath = path.join(schemaDir, 'spec.json')
  let schema: Schema | undefined

  if (fs.existsSync(schemaPath)) {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Schema
  } else {
    // load from URL if not found in cache
    try {
      const url = `https://raw.githubusercontent.com/elastic/elasticsearch-specification/${branch}/output/schema/schema.json`
      const response = await fetch(url)
      schema = await response.json() as Schema
      fs.writeFileSync(schemaPath, JSON.stringify(schema), 'utf-8')
    } catch (err) {
      // fail quietly, just fewer autocomplete results
      methods['DELETE'] = []
      methods['GET'] = []
      methods['HEAD'] = []
      methods['POST'] = []
      methods['PUT'] = []
      return
    }
  }

  // index all HTTP methods and API paths
  schema.endpoints.forEach(endpoint => {
    for (let url of endpoint.urls) {
      for (let meth of url.methods) {
        methods[meth] ||= []
        const urlPath = url.path.replace(/^\//, '')
        methods[meth].push(urlPath)

        // index all paths that are not index placeholders
        if (!urlPath.startsWith('{')) paths.add(urlPath)

        // index all path placeholders
        // TODO
      }
    }
  })
}

export async function getMethods (branch = "main"): Promise<typeof methods> {
  if (Object.keys(methods).length === 0) await loadSchema(branch)
  return methods
}

export async function getPaths (branch = "main") {
  if (paths.size === 0) await loadSchema(branch)
  return paths
}

interface ApiAuth {
  api_key: string
}

interface BasicAuth {
  username: string
  password: string
}

interface LspParams {
  url?: string,
  auth?: ApiAuth | BasicAuth
}
export function getClient (options: LspParams = {}): Client | undefined {
  if (client != null) return client

  const clientOptions: ClientOptions = {}

  if (options.auth != null) {
    if ('username' in options.auth && 'password' in options.auth) {
      clientOptions.auth = {
        username: options.auth.username,
        password: options.auth.password
      }
    } else if ('api_key' in options.auth) {
      clientOptions.auth = { apiKey: options.auth.api_key }
    }
  }

  if (options.url != null) {
    clientOptions.node = options.url
  }

  client = new Client(clientOptions)
  return client
}
