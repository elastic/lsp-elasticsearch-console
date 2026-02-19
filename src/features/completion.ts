/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  Connection,
  CompletionItem,
  CompletionItemKind,
  TextDocuments
} from 'vscode-languageserver/node.js'
import { isHttpMethodContext, isPathContext, getHttpMethodFromLine } from '../parsing/context.js'
import { getMethods, getPaths } from '../elasticsearch.js'

/**
 * Get completion items based on cursor position and available methods/paths
 * Pure function for testability
 */
export function getCompletionItems(
  document: TextDocument,
  line: number,
  character: number,
  methods: Record<string, string[]>,
  paths: Set<string>
): CompletionItem[] {
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
}

/**
 * Register completion handlers on the LSP connection
 */
export function registerCompletionHandlers(
  connection: Connection,
  documents: TextDocuments<TextDocument>
): void {
  connection.onCompletion(async textDocumentPosition => {
    const document = documents.get(textDocumentPosition.textDocument.uri)
    if (!document) return []

    const methods = await getMethods()
    const paths = await getPaths()

    const { line, character } = textDocumentPosition.position

    return getCompletionItems(document, line, character, methods, paths)
  })

  connection.onCompletionResolve(item => item)
}
