/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest'
import { resolvePlaceholder, findEndpoint, type Endpoint } from '../src/elasticsearch.js'

describe('elasticsearch', () => {
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

  describe('findEndpoint', () => {
    it('should find exact match for _search with GET', () => {
      const result = findEndpoint('_search', 'GET', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('search')
    })

    it('should find exact match for _search with POST', () => {
      const result = findEndpoint('_search', 'POST', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('search')
    })

    it('should match template path {index}/_search', () => {
      const result = findEndpoint('my-index/_search', 'GET', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('search')
    })

    it('should match multi-segment template {index}/_doc/{id}', () => {
      const result = findEndpoint('my-index/_doc/abc123', 'PUT', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('index')
    })

    it('should return undefined when method does not match', () => {
      const result = findEndpoint('_search', 'DELETE', mockEndpoints)
      expect(result).toBeUndefined()
    })

    it('should return undefined for unknown path', () => {
      const result = findEndpoint('_nonexistent', 'GET', mockEndpoints)
      expect(result).toBeUndefined()
    })

    it('should handle leading slash in input path', () => {
      const result = findEndpoint('/_search', 'GET', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('search')
    })

    it('should handle leading slash in template path', () => {
      const result = findEndpoint('/_cat/health', 'GET', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('cat.health')
    })

    it('should match template with leading slash', () => {
      const result = findEndpoint('/my-index/_search', 'POST', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.name).toBe('search')
    })

    it('should prefer exact match over template match', () => {
      const result = findEndpoint('_search', 'GET', mockEndpoints)
      expect(result).toBeDefined()
      expect(result?.urls.some(u => u.path === '/_search')).toBe(true)
    })
  })

  describe('resolvePlaceholder', () => {
    it('should return empty array for unknown placeholder', async () => {
      const result = await resolvePlaceholder('unknown')
      expect(result).toEqual([])
    })

    it('should handle "index" placeholder gracefully when no client', async () => {
      const result = await resolvePlaceholder('index')
      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array for "name" placeholder (not yet implemented)', async () => {
      const result = await resolvePlaceholder('name')
      expect(result).toEqual([])
    })

    it('should handle multiple placeholder types', async () => {
      const indexResult = await resolvePlaceholder('index')
      const unknownResult = await resolvePlaceholder('unknown')
      expect(Array.isArray(indexResult)).toBe(true)
      expect(Array.isArray(unknownResult)).toBe(true)
      expect(unknownResult).toEqual([])
    })
  })
})
