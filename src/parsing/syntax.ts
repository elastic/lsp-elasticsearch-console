/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import Parser, { Language } from 'tree-sitter'
import ElasticsearchConsole from 'tree-sitter-elasticsearch-console'
import { TextDocument } from 'vscode-languageserver-textdocument'

const parser = new Parser()
parser.setLanguage(ElasticsearchConsole as Language)

const documentTrees = new Map<string, Parser.Tree>()

/**
 * Parse a document and cache its syntax tree
 */
export function parseDocument(uri: string, text: string): void {
  const tree = parser.parse(text)
  documentTrees.set(uri, tree)
}

/**
 * Remove a document's syntax tree from the cache
 */
export function removeTree(uri: string): void {
  documentTrees.delete(uri)
}

/**
 * Convert LSP Position to byte offset in document
 */
export function getByteOffset(document: TextDocument, line: number, character: number): number {
  const text = document.getText()
  const lines = text.split('\n')
  let offset = 0

  for (let i = 0; i < line; i++) {
    offset += Buffer.byteLength(lines[i]) + 1
  }

  offset += Buffer.byteLength(lines[line].substring(0, character))
  return offset
}

/**
 * Get the syntax tree node at the cursor position
 */
export function getNodeAtPosition(document: TextDocument, line: number, character: number): Parser.SyntaxNode | null {
  const tree = documentTrees.get(document.uri)
  if (!tree) return null

  const byteOffset = getByteOffset(document, line, character)
  let node = tree.rootNode.descendantForIndex(byteOffset)

  // if we got the source_file node, try to find a more specific node
  // this happens when the cursor is at the boundary of an incomplete parse
  if (node.type === 'source_file' && node.childCount > 0) {
    for (let i = node.childCount - 1; i >= 0; i--) {
      const child = node.child(i)
      if (child && child.endIndex <= byteOffset) {
        const descendant = child.descendantForIndex(byteOffset)
        if (descendant && descendant !== child) return descendant
        return child
      }
    }
  }

  return node
}
