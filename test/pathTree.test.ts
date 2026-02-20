import { describe, it, expect } from 'vitest'
import { PathTree } from '../src/pathTree'

describe('PathTree', () => {
  it('should create correct tree structure from simple paths', () => {
    const tree = new PathTree()
    tree.addPath('_search', ['GET', 'POST'])
    tree.addPath('_cat/health', ['GET'])
    tree.addPath('{index}/_search', ['GET', 'POST'])

    const root = tree.getRoot()
    expect(root.children.has('_search')).toBe(true)
    expect(root.children.has('_cat')).toBe(true)
    expect(root.children.has('{index}')).toBe(true)

    const searchNode = root.children.get('_search')!
    expect(searchNode.isLeaf).toBe(true)
    expect(searchNode.methods).toEqual(new Set(['GET', 'POST']))

    const catNode = root.children.get('_cat')!
    expect(catNode.isLeaf).toBe(false)
    expect(catNode.children.has('health')).toBe(true)

    const indexNode = root.children.get('{index}')!
    expect(indexNode.placeholder).toBe('index')
    expect(indexNode.children.has('_search')).toBe(true)
  })

  it('should return top-level segments at root', () => {
    const tree = new PathTree()
    tree.addPath('_search', ['GET'])
    tree.addPath('_cat/health', ['GET'])
    tree.addPath('{index}/_search', ['GET'])

    const completions = tree.getCompletions([])
    expect(completions).toContain('_search')
    expect(completions).toContain('_cat')
    expect(completions.length).toBeGreaterThanOrEqual(2)
  })

  it('should return child segments when navigating into tree', () => {
    const tree = new PathTree()
    tree.addPath('_cat/health', ['GET'])
    tree.addPath('_cat/indices', ['GET'])

    const completions = tree.getCompletions(['_cat'])
    expect(completions).toContain('health')
    expect(completions).toContain('indices')
    expect(completions.length).toBe(2)
  })

  it('should filter by HTTP method', () => {
    const tree = new PathTree()
    tree.addPath('_search', ['GET', 'POST'])
    tree.addPath('_refresh', ['POST'])
    tree.addPath('_cat/health', ['GET'])

    const completions = tree.getCompletions([], 'GET')
    expect(completions).toContain('_search')
    expect(completions).toContain('_cat')
    expect(completions).not.toContain('_refresh')
  })

  it('should return placeholders at depth', () => {
    const tree = new PathTree()
    tree.addPath('{index}/_search', ['GET'])
    tree.addPath('{index}/_bulk', ['POST'])
    tree.addPath('_cat/health', ['GET'])

    const placeholders = tree.getPlaceholdersAtDepth([])
    expect(placeholders).toContain('index')
    expect(placeholders.length).toBe(1)
  })

  it('should return empty placeholders when none at depth', () => {
    const tree = new PathTree()
    tree.addPath('_cat/health', ['GET'])
    tree.addPath('_cat/indices', ['GET'])

    const placeholders = tree.getPlaceholdersAtDepth(['_cat'])
    expect(placeholders).toEqual([])
  })

  it('should match literal input to placeholder nodes', () => {
    const tree = new PathTree()
    tree.addPath('{index}/_search', ['GET', 'POST'])
    tree.addPath('{index}/_bulk', ['POST'])

    const completions = tree.getCompletions(['myindex'])
    expect(completions).toContain('_search')
    expect(completions).toContain('_bulk')
  })

  it('should return empty completions at leaf node', () => {
    const tree = new PathTree()
    tree.addPath('_search', ['GET'])

    const completions = tree.getCompletions(['_search'])
    expect(completions).toEqual([])
  })

  it('should handle paths with multiple segments', () => {
    const tree = new PathTree()
    tree.addPath('_cat/indices/{index}', ['GET'])

    const completionsAtCat = tree.getCompletions(['_cat'])
    expect(completionsAtCat).toContain('indices')

    const placeholdersAtIndices = tree.getPlaceholdersAtDepth(['_cat', 'indices'])
    expect(placeholdersAtIndices).toContain('index')
  })

  it('should merge literal and placeholder children', () => {
    const tree = new PathTree()
    tree.addPath('myindex/_search', ['GET'])
    tree.addPath('{index}/_search', ['GET'])
    tree.addPath('_cat/health', ['GET'])

    const completions = tree.getCompletions([])
    expect(completions).toContain('myindex')
    expect(completions).toContain('_cat')
  })

  it('should prefer literal matches over placeholder fallthrough', () => {
    const tree = new PathTree()
    tree.addPath('myindex/custom', ['GET'])
    tree.addPath('{index}/_search', ['GET'])

    const completions = tree.getCompletions(['myindex'])
    expect(completions).toContain('custom')
  })
})
