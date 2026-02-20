/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs'
import path from 'node:path'
import { Client, ClientOptions } from '@elastic/elasticsearch'
import envPaths from 'env-paths'
import { PathTree } from './pathTree.js'

const envPath = envPaths('lsp-elasticsearch-console')
const SPEC_CACHE = path.join(envPath.data, 'specification', 'elasticsearch')

let client: Client | undefined
const methods: Record<string, string[]> = {}
const paths: Set<string> = new Set()
let pathTree: PathTree | undefined

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

/**
 * Registry of placeholder handlers
 * Maps placeholder names (e.g., "index") to functions that resolve them
 */
const placeholderHandlers: Record<string, () => Promise<string[] | undefined>> = {
  'index': indices,
}

/**
 * Resolve a placeholder to its actual values
 * @param name - Placeholder name (e.g., "index" from {index})
 * @returns Array of possible values, or empty array if unknown/unavailable
 */
export async function resolvePlaceholder(name: string): Promise<string[]> {
  const handler = placeholderHandlers[name]
  if (!handler) return []

  try {
    const result = await handler()
    return result ?? []
  } catch (error) {
    return []
  }
}

async function loadSchema(branch = "main") {
  // attempt to load from file cache
  const schemaDir = path.join(SPEC_CACHE, branch)
  fs.mkdirSync(schemaDir, { recursive: true })
  const schemaPath = path.join(schemaDir, 'spec.json')
  let schema: Schema | undefined
  pathTree = new PathTree()

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
      const urlPath = url.path.replace(/^\//, '')
      // index all paths (including placeholders) in the tree
      pathTree!.addPath(urlPath, url.methods)

      // keep the old flat paths set for backward compatibility
      if (!urlPath.startsWith('{')) paths.add(urlPath)

      for (let meth of url.methods) {
        methods[meth] ||= []
        methods[meth].push(urlPath)
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

export async function getPathTree (branch = "main"): Promise<PathTree> {
  if (!pathTree) await loadSchema(branch)
  return pathTree!
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
