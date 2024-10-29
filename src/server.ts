/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  createConnection,
  CompletionItemKind,
  InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  CompletionItem,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import fetch from 'node-fetch'

import fs from 'fs'
import util from 'util'
const logFile = fs.createWriteStream(__dirname + '/debug.log', { flags: 'a'})
const log = (message: any) => logFile.write(util.format(message) + '\n')

let connection = createConnection(ProposedFeatures.all)

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

async function loadSchema () {
  if (Object.keys(methods).length > 0) return

  const url = 'https://raw.githubusercontent.com/elastic/elasticsearch-specification/main/output/schema/schema.json'
  let schema: Schema | undefined
  try {
    const response = await fetch(url)
    schema = await response.json() as Schema
  } catch (err) {
    // fail quietly, just fewer autocomplete results
    methods['DELETE'] = []
    methods['GET'] = []
    methods['HEAD'] = []
    methods['POST'] = []
    methods['PUT'] = []
    return
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

connection.onInitialize(async (): Promise<InitializeResult> => {
  loadSchema()

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
        kind: CompletionItemKind.Method,
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
