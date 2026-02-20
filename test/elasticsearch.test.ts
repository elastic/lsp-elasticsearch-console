/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest'
import { resolvePlaceholder } from '../src/elasticsearch'

describe('elasticsearch placeholder resolution', () => {
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
