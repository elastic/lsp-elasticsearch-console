/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind } from 'vscode-languageserver/node.js'
import { parseDocument, removeTree } from '../../src/parsing/syntax.js'
import { getCompletionItems } from '../../src/features/completion.js'

describe('features/completion', () => {
  const testUri = 'test://test.es'

  const mockMethods = {
    GET: ['_search', '_cat/health', '_cat/indices'],
    POST: ['_bulk', '_search'],
    DELETE: ['_search', '_delete_by_query']
  }
  const mockPaths = new Set(['_search', '_cat/health', '_cat/indices', '_bulk', '_delete_by_query'])

  afterEach(() => {
    removeTree(testUri)
  })

  describe('getCompletionItems', () => {
    it('should return method completions in HTTP method context', () => {
      const content = 'G'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, content.length, mockMethods, mockPaths)
      expect(items).toHaveLength(3)
      expect(items.map(i => i.label).sort()).toEqual(['DELETE', 'GET', 'POST'])
      expect(items.every(i => i.kind === CompletionItemKind.Keyword)).toBe(true)
    })

    it('should return path completions for recognized method', () => {
      const content = 'GET _se'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, content.length, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual(['_cat/health', '_cat/indices', '_search'])
      expect(items.every(i => i.kind === CompletionItemKind.Keyword)).toBe(true)
    })

    it('should return all paths when method not recognized', () => {
      const content = 'PATCH _se'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, content.length, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual([
        '_bulk',
        '_cat/health',
        '_cat/indices',
        '_delete_by_query',
        '_search'
      ])
    })

    it('should return POST-specific paths for POST request', () => {
      const content = 'POST _'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, content.length, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual(['_bulk', '_search'])
    })

    it('should return DELETE-specific paths for DELETE request', () => {
      const content = 'DELETE _'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, content.length, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual(['_delete_by_query', '_search'])
    })

    it('should return empty array when not in method or path context', () => {
      const content = 'GET _search\n{\n  "query": {}\n}'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 2, 2, mockMethods, mockPaths)
      expect(items).toEqual([])
    })

    it('should prioritize method context over path context', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, 0, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual(['DELETE', 'GET', 'POST'])
    })

    it('should handle empty document', () => {
      const content = ''
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 0, 0, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual(['DELETE', 'GET', 'POST'])
    })

    it('should handle multi-line document', () => {
      const content = 'GET _search\n\nPOST '
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = getCompletionItems(doc, 2, 5, mockMethods, mockPaths)
      expect(items.map(i => i.label).sort()).toEqual(['_bulk', '_search'])
    })
  })
})
