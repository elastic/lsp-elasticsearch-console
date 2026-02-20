/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { parseDocument, removeTree } from '../../src/parsing/syntax.js'
import { isHttpMethodContext, isPathContext, getHttpMethodFromLine, getPathPrefix } from '../../src/parsing/context.js'

describe('parsing/context', () => {
  const testUri = 'test://test.es'

  afterEach(() => {
    removeTree(testUri)
  })

  describe('isHttpMethodContext', () => {
    it('should return true at column 0 of request line', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isHttpMethodContext(doc, 0, 0)).toBe(true)
    })

    it('should return true inside partial method', () => {
      const content = 'GE'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isHttpMethodContext(doc, 0, 1)).toBe(true)
    })

    it('should return true on empty line', () => {
      const content = '\n'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isHttpMethodContext(doc, 0, 0)).toBe(true)
    })

    it('should return false after the method', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isHttpMethodContext(doc, 0, 4)).toBe(false)
    })

    it('should return false in JSON body', () => {
      const content = 'GET _search\n{\n  "query": {}\n}'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isHttpMethodContext(doc, 2, 2)).toBe(false)
    })
  })

  describe('isPathContext', () => {
    it('should return true after HTTP method', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isPathContext(doc, 0, 4)).toBe(true)
      expect(isPathContext(doc, 0, 5)).toBe(true)
    })

    it('should return true for partial path', () => {
      const content = 'GET _se'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isPathContext(doc, 0, 5)).toBe(true)
    })

    it('should return false at column 0', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isPathContext(doc, 0, 0)).toBe(false)
    })

    it('should return false on empty line', () => {
      const content = '\n'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isPathContext(doc, 0, 0)).toBe(false)
    })

    it('should return false in JSON body', () => {
      const content = 'GET _search\n{\n  "query": {}\n}'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      expect(isPathContext(doc, 2, 2)).toBe(false)
    })
  })

  describe('getHttpMethodFromLine', () => {
    it('should return GET for GET request', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      expect(getHttpMethodFromLine(doc, 0)).toBe('GET')
    })

    it('should return POST for POST request', () => {
      const content = 'POST _bulk'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      expect(getHttpMethodFromLine(doc, 0)).toBe('POST')
    })

    it('should return all supported methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

      for (const method of methods) {
        const content = `${method} _search`
        const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
        expect(getHttpMethodFromLine(doc, 0)).toBe(method)
      }
    })

    it('should return null for non-request lines', () => {
      const content = '{\n  "query": {}\n}'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      expect(getHttpMethodFromLine(doc, 0)).toBeNull()
      expect(getHttpMethodFromLine(doc, 1)).toBeNull()
    })

    it('should return null for empty line', () => {
      const content = '\n'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      expect(getHttpMethodFromLine(doc, 0)).toBeNull()
    })

    it('should handle whitespace before method', () => {
      const content = '  GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      expect(getHttpMethodFromLine(doc, 0)).toBe('GET')
    })

    it('should extract method from multi-line document', () => {
      const content = 'GET _search\nPOST _bulk\nDELETE /index'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      expect(getHttpMethodFromLine(doc, 0)).toBe('GET')
      expect(getHttpMethodFromLine(doc, 1)).toBe('POST')
      expect(getHttpMethodFromLine(doc, 2)).toBe('DELETE')
    })
  })

  describe('getPathPrefix', () => {
    it('should extract partial segment at root', () => {
      const content = 'GET _se'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 7)
      expect(result.completeSegments).toEqual([])
      expect(result.partial).toBe('_se')
    })

    it('should extract complete segments and partial', () => {
      const content = 'GET _cat/he'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 11)
      expect(result.completeSegments).toEqual(['_cat'])
      expect(result.partial).toBe('he')
    })

    it('should handle trailing slash with empty partial', () => {
      const content = 'GET _cat/'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 9)
      expect(result.completeSegments).toEqual(['_cat'])
      expect(result.partial).toBe('')
    })

    it('should handle empty path after method', () => {
      const content = 'GET '
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 4)
      expect(result.completeSegments).toEqual([])
      expect(result.partial).toBe('')
    })

    it('should handle multi-segment paths', () => {
      const content = 'POST myindex/_search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 20)
      expect(result.completeSegments).toEqual(['myindex'])
      expect(result.partial).toBe('_search')
    })

    it('should handle deep path nesting', () => {
      const content = 'GET _cat/indices/my'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 19)
      expect(result.completeSegments).toEqual(['_cat', 'indices'])
      expect(result.partial).toBe('my')
    })

    it('should handle path with leading slash', () => {
      const content = 'GET /_search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 12)
      expect(result.completeSegments).toEqual([])
      expect(result.partial).toBe('_search')
    })

    it('should handle cursor in middle of segment', () => {
      const content = 'GET _cat/health'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const result = getPathPrefix(doc, 0, 10)
      expect(result.completeSegments).toEqual(['_cat'])
      expect(result.partial).toBe('h')
    })
  })
})
