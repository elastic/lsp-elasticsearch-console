#!/usr/bin/env node
/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  createConnection,
  CompletionItemKind,
  InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  CompletionItem,
  InitializeParams
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import Parser, { Language } from 'tree-sitter'
import ElasticsearchConsole from 'tree-sitter-elasticsearch-console'
import { getClient, getMethods, getPaths } from './elasticsearch.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const parser = new Parser()
parser.setLanguage(ElasticsearchConsole as Language)

const logFile = fs.createWriteStream(path.join(__dirname, 'debug.log'), { flags: 'a'})
const log = (message: any) => logFile.write(util.format(message) + '\n')

let connection = createConnection(ProposedFeatures.all)

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
      }
    }
  }
})

connection.onCompletion(async textDocumentPosition => {
  const document = documents.get(textDocumentPosition.textDocument.uri)
  if (!document) return []

  const methods = await getMethods()
  const paths = await getPaths()

  const { line, character } = textDocumentPosition.position

  if (isHttpMethodContext(document, line, character)) {
    return Object.keys(methods).map((method): CompletionItem => {
      return {
        label: method,
        kind: CompletionItemKind.Keyword,
        data: method
      }
    })
  }

  if (isPathContext(document, line, character)) {
    const method = getHttpMethodFromLine(document, line)
    const availablePaths = method && methods[method]
      ? methods[method]
      : [...paths.values()]

    return availablePaths.map(path => {
      return {
        label: path,
        kind: CompletionItemKind.Keyword,
      }
    })
  }

  return []
})

connection.onCompletionResolve(item => item)

connection.onExit(() => {})

const documentTrees = new Map()
documents.onDidChangeContent(({ document }) => {
  const tree = parser.parse(document.getText())
  documentTrees.set(document.uri, tree)
})

documents.onDidClose(({ document }) => {
  documentTrees.delete(document.uri)
})

/**
 * Convert LSP Position to byte offset in document
 */
function getByteOffset(document: TextDocument, line: number, character: number): number {
  const text = document.getText()
  const lines = text.split('\n')
  let offset = 0

  for (let i = 0; i < line; i++) {
    offset += Buffer.byteLength(lines[i]) + 1 // +1 for newline
  }

  offset += Buffer.byteLength(lines[line].substring(0, character))
  return offset
}

/**
 * Get the syntax tree node at the cursor position
 */
function getNodeAtPosition(document: TextDocument, line: number, character: number) {
  const tree = documentTrees.get(document.uri)
  if (!tree) return null

  const byteOffset = getByteOffset(document, line, character)
  return tree.rootNode.descendantForIndex(byteOffset)
}

/**
 * Check if cursor is in HTTP method context (at start of request line)
 */
function isHttpMethodContext(document: TextDocument, line: number, character: number): boolean {
  const node = getNodeAtPosition(document, line, character)
  if (!node) return false

  return node.type === 'method' ||
         node.parent?.type === 'method' ||
         (node.type === 'ERROR' && node.parent?.type === 'request') ||
         (node.startPosition.column === 0)
}

/**
 * Extract HTTP method from the current request line
 */
function getHttpMethodFromLine(document: TextDocument, line: number): string | null {
  const lineText = document.getText({
    start: { line, character: 0 },
    end: { line: line + 1, character: 0 }
  })

  // Match HTTP method at start of line
  const match = lineText.match(/^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/)
  return match ? match[1] : null
}

/**
 * Check if cursor is in path/endpoint context
 */
function isPathContext(document: TextDocument, line: number, character: number): boolean {
  const node = getNodeAtPosition(document, line, character)
  if (!node) return false

  // Check if we're in a path node or after a method
  return node.type === 'path' ||
         node.parent?.type === 'path' ||
         node.parent?.type === 'request' ||
         (node.type === 'ERROR' && node.parent?.type === 'request')
}

try {
  documents.listen(connection)
  connection.listen()
} catch (err) {
  process.exit(1)
}
