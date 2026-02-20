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
import { isHttpMethodContext, isPathContext, getHttpMethodFromLine, getPathPrefix } from '../parsing/context.js'
import { getMethods, getPathTree, resolvePlaceholder } from '../elasticsearch.js'
import { PathTree } from '../pathTree.js'

/**
 * Get completion items based on cursor position and available methods/paths
 * Pure function for testability
 */
export async function getCompletionItems(
  document: TextDocument,
  line: number,
  character: number,
  methods: Record<string, string[]>,
  pathTree: PathTree,
  resolvePlaceholderFn: (name: string) => Promise<string[]>
): Promise<CompletionItem[]> {
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
    const { completeSegments, partial } = getPathPrefix(document, line, character)

    const staticSegments = pathTree.getCompletions(completeSegments, method || undefined)
    const placeholders = pathTree.getPlaceholdersAtDepth(completeSegments, method || undefined)
    let resolvedValues: string[] = []

    for (const placeholder of placeholders) {
      const values = await resolvePlaceholderFn(placeholder)
      resolvedValues = resolvedValues.concat(values)
    }

    const allCandidates = [...staticSegments, ...resolvedValues]
    const filtered = allCandidates.filter(candidate =>
      candidate.toLowerCase().startsWith(partial.toLowerCase())
    )

    const unique = [...new Set(filtered)]
    return unique.map(label => ({
      label,
      kind: CompletionItemKind.Keyword,
    }))
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
    const pathTree = await getPathTree()
    const { line, character } = textDocumentPosition.position
    return getCompletionItems(document, line, character, methods, pathTree, resolvePlaceholder)
  })

  connection.onCompletionResolve(item => item)
}
