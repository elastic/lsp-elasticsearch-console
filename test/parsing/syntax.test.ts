/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getByteOffset, getNodeAtPosition, parseDocument, removeTree } from '../../src/parsing/syntax.js'

describe('parsing/syntax', () => {
  const testUri = 'test://test.es'

  afterEach(() => {
    removeTree(testUri)
  })

  describe('getByteOffset', () => {
    it('should calculate byte offset for basic ASCII text', () => {
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, 'GET _search\nPOST _bulk')

      expect(getByteOffset(doc, 0, 0)).toBe(0)
      expect(getByteOffset(doc, 0, 0)).toBe(0)
      expect(getByteOffset(doc, 0, 3)).toBe(3)
      expect(getByteOffset(doc, 1, 0)).toBe(12) // 'GET _search\n' = 12 bytes
      expect(getByteOffset(doc, 1, 0)).toBe(12)
    })

    it('should handle multi-byte UTF-8 characters', () => {
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, 'GET ©test')
      expect(getByteOffset(doc, 0, 4)).toBe(4)
      expect(getByteOffset(doc, 0, 5)).toBe(6)
    })

    it('should handle empty lines', () => {
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, 'GET _search\n\nPOST _bulk')
      expect(getByteOffset(doc, 1, 0)).toBe(12)
      expect(getByteOffset(doc, 2, 0)).toBe(13)
    })
  })

  describe('getNodeAtPosition', () => {
    it('should return tree-sitter node at position', () => {
      const content = 'GET _search\nPOST _bulk'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)

      const node1 = getNodeAtPosition(doc, 0, 0)
      expect(node1).not.toBeNull()
      expect(node1?.type).toBe('GET')
      expect(node1?.parent?.type).toBe('method')

      const node2 = getNodeAtPosition(doc, 0, 4)
      expect(node2).not.toBeNull()
      expect(['path', '_search']).toContain(node2?.type)

      const node3 = getNodeAtPosition(doc, 1, 0)
      expect(node3).not.toBeNull()
      expect(node3?.type).toBe('POST')
      expect(node3?.parent?.type).toBe('method')
    })

    it('should return null when no tree is cached', () => {
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, 'GET _search')
      const node = getNodeAtPosition(doc, 0, 0)
      expect(node).toBeNull()
    })

    it('should handle cursor at end of document', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const node = getNodeAtPosition(doc, 0, 11)
      expect(node).not.toBeNull()
    })
  })

  describe('parseDocument and removeTree', () => {
    it('should cache parsed tree for document', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      const node = getNodeAtPosition(doc, 0, 0)
      expect(node).not.toBeNull()
    })

    it('should update tree when parsing same URI again', () => {
      const content1 = 'GET _search'
      const content2 = 'POST _bulk'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content2)
      parseDocument(testUri, content1)
      parseDocument(testUri, content2)
      const node = getNodeAtPosition(doc, 0, 0)
      expect(node?.type).toBe('POST')
      expect(node?.parent?.type).toBe('method')
    })

    it('should remove tree from cache', () => {
      const content = 'GET _search'
      const doc = TextDocument.create(testUri, 'elasticsearch', 1, content)
      parseDocument(testUri, content)
      removeTree(testUri)
      const node = getNodeAtPosition(doc, 0, 0)
      expect(node).toBeNull()
    })
  })
})
