/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind } from 'vscode-languageserver/node.js'
import { parseDocument, removeTree } from '../../src/parsing/syntax.js'
import { getCompletionItems } from '../../src/features/completion.js'
import { PathTree } from '../../src/pathTree.js'

describe('features/completion', () => {
  const testUri = 'test://test.es'

  const mockMethods = {
    GET: ['_search', '_cat/health', '_cat/indices', '{index}/_search'],
    POST: ['_bulk', '_search', '{index}/_bulk', '{index}/_search'],
    DELETE: ['_search', '_delete_by_query', '{index}']
  }

  const mockPathTree = new PathTree()
  mockPathTree.addPath('_search', ['GET', 'POST', 'DELETE'])
  mockPathTree.addPath('_cat/health', ['GET'])
  mockPathTree.addPath('_cat/indices', ['GET'])
  mockPathTree.addPath('_bulk', ['POST'])
  mockPathTree.addPath('_delete_by_query', ['DELETE'])
  mockPathTree.addPath('{index}/_search', ['GET', 'POST'])
  mockPathTree.addPath('{index}/_bulk', ['POST'])
  mockPathTree.addPath('{index}', ['DELETE'])

  const mockResolvePlaceholder = async (name: string): Promise<string[]> => {
    if (name === 'index') return ['myindex', 'testindex', 'logstash-2024']
    return []
  }

  afterEach(() => {
    removeTree(testUri)
  })

  describe('getCompletionItems', () => {
    it('should return method completions in HTTP method context', async () => {
      const content = 'G'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)
      expect(items).toHaveLength(3)
      expect(items.map(i => i.label).sort()).toEqual(['DELETE', 'GET', 'POST'])
      expect(items.every(i => i.kind === CompletionItemKind.Keyword)).toBe(true)
    })

    it('should return top-level path segments at root', async () => {
      const content = 'GET '
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      const labels = items.map(i => i.label).sort()
      expect(labels).toContain('_search')
      expect(labels).toContain('_cat')
      expect(labels).toContain('myindex')
      expect(labels).toContain('testindex')
      expect(labels).not.toContain('_cat/health')
      expect(labels).not.toContain('_bulk') // POST only
      expect(labels).not.toContain('_delete_by_query') // DELETE only
    })

    it('should return child segments when navigating into tree', async () => {
      const content = 'GET _cat/'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      const labels = items.map(i => i.label).sort()
      expect(labels).toEqual(['health', 'indices'])
    })

    it('should filter segments by partial input', async () => {
      const content = 'GET _cat/he'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      expect(items.map(i => i.label)).toEqual(['health'])
    })

    it('should resolve placeholders and return matching indices', async () => {
      const content = 'GET my'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      const labels = items.map(i => i.label)
      expect(labels).toContain('myindex')
    })

    it('should show placeholder children when index is selected', async () => {
      const content = 'POST myindex/'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      const labels = items.map(i => i.label).sort()
      expect(labels).toContain('_search')
      expect(labels).toContain('_bulk')
    })

    it('should filter by HTTP method', async () => {
      const content = 'POST '
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      const labels = items.map(i => i.label).sort()
      expect(labels).toContain('_bulk')
      expect(labels).toContain('_search')
      expect(labels).not.toContain('_delete_by_query') // DELETE only
      expect(labels).not.toContain('_cat') // GET only
    })

    it('should return empty array when not in method or path context', async () => {
      const content = 'GET _search\n{\n  "query": {}\n}'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 2, 2, mockMethods, mockPathTree, mockResolvePlaceholder)
      expect(items).toEqual([])
    })

    it('should prioritize method context over path context', async () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, 0, mockMethods, mockPathTree, mockResolvePlaceholder)
      expect(items.map(i => i.label).sort()).toEqual(['DELETE', 'GET', 'POST'])
    })

    it('should handle empty document', async () => {
      const content = ''
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, 0, mockMethods, mockPathTree, mockResolvePlaceholder)
      expect(items.map(i => i.label).sort()).toEqual(['DELETE', 'GET', 'POST'])
    })

    it('should handle multi-line document', async () => {
      const content = 'GET _search\n\nPOST '
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 2, 5, mockMethods, mockPathTree, mockResolvePlaceholder)
      const labels = items.map(i => i.label).sort()
      expect(labels).toContain('_bulk')
      expect(labels).toContain('_search')
    })

    it('should merge literal and placeholder-resolved values', async () => {
      const content = 'GET '
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)

      const labels = items.map(i => i.label)
      expect(labels).toContain('_search')
      expect(labels).toContain('myindex')
      expect(labels).toContain('testindex')
    })

    it('should handle cursor at leaf node', async () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const items = await getCompletionItems(doc, 0, content.length, mockMethods, mockPathTree, mockResolvePlaceholder)
      const labels = items.map(i => i.label)
      expect(labels).toContain('_search')
    })
  })
})
