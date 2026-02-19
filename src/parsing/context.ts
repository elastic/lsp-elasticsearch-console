/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getNodeAtPosition } from './syntax.js'

/**
 * Check if cursor is in HTTP method context (at start of request line)
 */
export function isHttpMethodContext(document: TextDocument, line: number, character: number): boolean {
  const node = getNodeAtPosition(document, line, character)
  if (!node) return false

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
  if (httpMethods.includes(node.type)) return true

  if (node.type === 'method' || node.parent?.type === 'method') return true

  if (node.startPosition.column === 0) {
    if (node.type === 'ERROR') {
      const lineText = document.getText({
        start: { line, character: 0 },
        end: { line: line + 1, character: 0 }
      })

      const hasMethodAndSpace = lineText.match(/^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/)
      if (hasMethodAndSpace) return false

      return true
    }
    if (node.type !== 'path' && node.type !== 'body') return true
  }

  return false
}

/**
 * Extract HTTP method from the current request line
 */
export function getHttpMethodFromLine(document: TextDocument, line: number): string | null {
  const lineText = document.getText({
    start: { line, character: 0 },
    end: { line: line + 1, character: 0 }
  })

  const match = lineText.match(/^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/)
  return match ? match[1] : null
}

/**
 * Check if cursor is in path/endpoint context
 */
export function isPathContext(document: TextDocument, line: number, character: number): boolean {
  const node = getNodeAtPosition(document, line, character)
  if (!node) return false

  if (node.type === 'path' ||
      node.parent?.type === 'path' ||
      node.parent?.type === 'request' ||
      (node.type === 'ERROR' && node.parent?.type === 'request')) {
    return true
  }

  if (node.type === 'ERROR' && node.parent?.type === 'source_file') {
    const lineText = document.getText({
      start: { line, character: 0 },
      end: { line: line + 1, character: 0 }
    })

    const methodMatch = lineText.match(/^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/)
    if (methodMatch) return true
  }

  return false
}
