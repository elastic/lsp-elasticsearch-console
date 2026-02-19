#!/usr/bin/env node
/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  createConnection,
  InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  InitializeParams
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getClient } from './elasticsearch.js'
import { parseDocument, removeTree } from './parsing/syntax.js'
import { registerCompletionHandlers } from './features/completion.js'

let connection = createConnection(ProposedFeatures.all)
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  getClient(params.initializationOptions)
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
      }
    }
  }
})

registerCompletionHandlers(connection, documents)

documents.onDidChangeContent(({ document }) => {
  parseDocument(document.uri, document.getText())
})

documents.onDidClose(({ document }) => {
  removeTree(document.uri)
})

connection.onExit(() => {})

try {
  documents.listen(connection)
  connection.listen()
} catch (err) {
  process.exit(1)
}
