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
import { initializeLogger, getLogger } from './logging.js'

let connection = createConnection(ProposedFeatures.all)
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

// Initialize logging
initializeLogger({ connection })
const logger = getLogger('server')

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  logger.debugLog('Server initializing', { initOptions: params.initializationOptions })
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
  logger.debugLog('Document content changed', { uri: document.uri })
  parseDocument(document.uri, document.getText())
})

documents.onDidClose(({ document }) => {
  logger.debugLog('Document closed', { uri: document.uri })
  removeTree(document.uri)
})

connection.onExit(() => {
  logger.info('Server exiting')
})

try {
  documents.listen(connection)
  connection.listen()
  logger.info('Language server started')
} catch (err) {
  logger.error('Failed to start language server', err)
  process.exit(1)
}
