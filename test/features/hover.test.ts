/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { MarkupKind } from 'vscode-languageserver/node.js'
import { parseDocument, removeTree } from '../../src/parsing/syntax.js'
import { getHoverInfo } from '../../src/features/hover.js'
import type { Endpoint } from '../../src/elasticsearch.js'

describe('features/hover', () => {
  const testUri = 'test://test.es'

  const mockEndpoints: Endpoint[] = [
    {
      name: 'search',
      description: 'Returns search hits that match the query defined in the request.',
      docUrl: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html',
      urls: [
        { path: '/_search', methods: ['GET', 'POST'] },
        { path: '/{index}/_search', methods: ['GET', 'POST'] }
      ],
      request: { name: 'search', namespace: '_global' },
      availability: { stack: { since: '0.0.0' } }
    },
    {
      name: 'index',
      description: 'Adds a JSON document to the specified data stream or index.',
      docUrl: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html',
      urls: [
        { path: '/{index}/_doc/{id}', methods: ['PUT', 'POST'] },
        { path: '/{index}/_create/{id}', methods: ['PUT', 'POST'] }
      ],
      request: { name: 'index', namespace: 'index' },
      availability: { stack: { since: '0.0.0' } }
    },
    {
      name: 'cat.health',
      description: 'Returns the health status of a cluster.',
      docUrl: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-health.html',
      urls: [
        { path: '/_cat/health', methods: ['GET'] }
      ],
      request: { name: 'health', namespace: 'cat' },
      availability: { stack: { since: '0.0.0' } }
    }
  ]

  afterEach(() => {
    removeTree(testUri)
  })

  describe('getHoverInfo', () => {
    it('should return hover info when cursor is on a known API path', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 5, mockEndpoints)
      expect(hover).toBeDefined()
      expect(hover?.contents).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        // @ts-expect-error
        expect(hover.contents.kind).toBe(MarkupKind.Markdown)
        expect(hover.contents.value).toContain('search')
        expect(hover.contents.value).toContain('Returns search hits')
      }
    })

    it('should return hover info when cursor is on the HTTP method', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 1, mockEndpoints)
      expect(hover).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        expect(hover.contents.value).toContain('search')
      }
    })

    it('should match template paths', () => {
      const content = 'GET my-index/_doc/123'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 10, mockEndpoints)
      expect(hover).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        expect(hover.contents.value).toContain('index')
        expect(hover.contents.value).toContain('Adds a JSON document')
      }
    })

    it('should return null for unknown paths', () => {
      const content = 'GET _nonexistent'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 5, mockEndpoints)
      expect(hover).toBeNull()
    })

    it('should return null in JSON body', () => {
      const content = 'GET _search\n{\n  "query": {}\n}'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 2, 2, mockEndpoints)
      expect(hover).toBeNull()
    })

    it('should return null for empty document', () => {
      const content = ''
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 0, mockEndpoints)
      expect(hover).toBeNull()
    })

    it('should handle multi-line document with multiple requests', () => {
      const content = 'GET _search\n\nPOST my-index/_doc/123'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 2, 10, mockEndpoints)
      expect(hover).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        expect(hover.contents.value).toContain('index')
      }
    })

    it('should include methods in hover content', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 5, mockEndpoints)
      expect(hover).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        expect(hover.contents.value).toContain('GET')
        expect(hover.contents.value).toContain('POST')
      }
    })

    it('should include paths in hover content', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 5, mockEndpoints)
      expect(hover).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        expect(hover.contents.value).toContain('_search')
      }
    })

    it('should include documentation URL in hover content', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const hover = getHoverInfo(doc, 0, 5, mockEndpoints)
      expect(hover).toBeDefined()

      if (hover && typeof hover.contents === 'object' && 'value' in hover.contents) {
        expect(hover.contents.value).toContain('elastic.co')
      }
    })
  })
})
