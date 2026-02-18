#!/usr/bin/env node
/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import {
  createConnection,
  CompletionItemKind,
  InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  CompletionItem,
  InitializeParams
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import envPaths from 'env-paths'
import { Client, ApiKeyAuth } from '@elastic/elasticsearch'

const envPath = envPaths('lsp-elasticsearch-console')
const SPEC_CACHE = path.join(envPath.data, 'specification', 'elasticsearch')

const logFile = fs.createWriteStream(__dirname + '/debug.log', { flags: 'a'})
const log = (message: any) => logFile.write(util.format(message) + '\n')

let connection = createConnection(ProposedFeatures.all)

let client

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

const methods: Record<string, string[]> = {}
const paths: Set<string> = new Set()

interface UrlTemplate {
  path: string
  methods: string[]
}

interface Endpoint {
  urls: UrlTemplate[]
}

interface Schema {
  endpoints: Endpoint[]
}

async function loadSchema (branch = "main") {
  if (Object.keys(methods).length > 0) return

  const schemaPath = path.join(SPEC_CACHE, branch, 'spec.json')
  let schema: Schema | undefined
  if (fs.existsSync(schemaPath)) {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Schema
  } else {
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

  // index each endpoint by HTTP method
  schema.endpoints.forEach(endpoint => {
    for (let url of endpoint.urls) {
      for (let meth of url.methods) {
        if (!methods[meth]) {
          methods[meth] = []
        }
        const noSlash = url.path.replace(/^\//, '')
        methods[meth].push(noSlash)
        // index all paths that are not index placeholders
        if (!noSlash.startsWith('{')) paths.add(noSlash)
      }
    }
  })
}

function initClient(params: InitializeParams) {
  const options = params.initializationOptions ?? {}
  let auth: ApiKeyAuth | { username: string, password: string }
  if (options?.auth?.username != null && options?.auth?.password != null) {
    auth = {
      username: options.username,
      password: options.password
    }
  } else if (options?.auth?.apiKey != null) {
    auth = { apiKey: options.auth.apiKey }
  } else {
    return
  }

  const { url } = options
  if (url == null) return

  client = new Client({ node: url, auth })
}

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  loadSchema()
  initClient(params)

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
      }
    }
  }
})

connection.onCompletion(textDocumentPosition => {
  if (textDocumentPosition.position.character === 1) {
    return Object.keys(methods).map((method, index): CompletionItem => {
      return {
        label: method,
        kind: CompletionItemKind.Keyword,
        data: method
      }
    })
  } else {
    // TODO: only return paths that have the specified HTTP method
    // how do we determine what method is entered?
    return [...paths.values()].map(path => {
      return {
        label: path,
        kind: CompletionItemKind.Function,
      }
    })
  }
})

connection.onCompletionResolve(item => item)

connection.onExit(() => {})

try {
  documents.listen(connection)
  connection.listen()
} catch (err) {
  process.exit(1)
}
