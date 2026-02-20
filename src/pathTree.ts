/**
 * PathNode represents a single segment in the path tree
 */
export interface PathNode {
  children: Map<string, PathNode>
  isLeaf: boolean
  methods: Set<string>
  placeholder?: string  // e.g. "index" for {index} segments
}

/**
 * PathTree builds a hierarchical tree structure from API paths,
 * supporting placeholder segments like {index} for dynamic completion.
 */
export class PathTree {
  private root: PathNode

  constructor() {
    this.root = {
      children: new Map(),
      isLeaf: false,
      methods: new Set(),
    }
  }

  /**
   * Add a path to the tree, splitting by '/' into segments
   * @param path - API path like "_search" or "{index}/_bulk"
   * @param methods - HTTP methods that apply to this path
   */
  addPath(path: string, methods: string[]): void {
    const segments = path.split('/').filter(seg => seg.length > 0)

    let current = this.root

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const isLastSegment = i === segments.length - 1

      if (!current.children.has(segment)) {
        const placeholder = this.extractPlaceholder(segment)
        current.children.set(segment, {
          children: new Map(),
          isLeaf: false,
          methods: new Set(),
          placeholder,
        })
      }

      const node = current.children.get(segment)!

      if (isLastSegment) {
        node.isLeaf = true
        methods.forEach(method => node.methods.add(method))
      }

      current = node
    }
  }

  /**
   * Extract placeholder name from segment like "{index}" → "index"
   */
  private extractPlaceholder(segment: string): string | undefined {
    const match = segment.match(/^\{(.+)\}$/)
    return match ? match[1] : undefined
  }

  /**
   * Get completions at a specific depth in the tree
   * @param segments - The path segments typed so far
   * @param method - Optional HTTP method filter
   * @returns Array of possible next segments
   */
  getCompletions(segments: string[], method?: string): string[] {
    const node = this.navigateToNode(segments)
    if (!node) return []

    // if at a leaf WITH NO CHILDREN, no more completions
    // but if a leaf has children (e.g., {index} is both a leaf and has children),
    // we should return the children
    if (node.isLeaf && segments.length > 0 && node.children.size === 0) return []

    const completions: string[] = []

    for (const [segment, child] of node.children) {
      // placeholder segments are resolved separately
      if (child.placeholder) continue

      if (method) {
        if (this.supportsMethod(child, method)) completions.push(segment)
      } else {
        completions.push(segment)
      }
    }

    return completions
  }

  /**
   * Check if a node or any of its descendants support a given method
   */
  private supportsMethod(node: PathNode, method: string): boolean {
    if (node.methods.has(method)) return true
    for (const child of node.children.values()) {
      if (this.supportsMethod(child, method)) return true
    }
    return false
  }

  /**
   * Get placeholder names at a specific depth
   * @param segments - The path segments typed so far
   * @param method - Optional HTTP method filter
   * @returns Array of placeholder names (e.g., ["index"])
   */
  getPlaceholdersAtDepth(segments: string[], method?: string): string[] {
    const node = this.navigateToNode(segments)
    if (!node) return []

    const placeholders: string[] = []

    for (const child of node.children.values()) {
      if (child.placeholder) {
        if (method) {
          if (this.supportsMethod(child, method)) placeholders.push(child.placeholder)
        } else {
          placeholders.push(child.placeholder)
        }
      }
    }

    return placeholders
  }

  /**
   * Navigate to a node at the given path segments.
   * For literal input that doesn't match a static child, falls through to placeholder nodes.
   */
  private navigateToNode(segments: string[]): PathNode | null {
    let current = this.root

    for (const segment of segments) {
      if (current.children.has(segment)) {
        current = current.children.get(segment)!
      } else {
        const placeholderChild = this.findPlaceholderChild(current)
        if (placeholderChild) {
          current = placeholderChild
        } else {
          return null
        }
      }
    }

    return current
  }

  /**
   * Find a placeholder child node (one with a placeholder property)
   */
  private findPlaceholderChild(node: PathNode): PathNode | null {
    for (const child of node.children.values()) {
      if (child.placeholder) return child
    }
    return null
  }

  /**
   * Get the root node (for testing)
   */
  getRoot(): PathNode {
    return this.root
  }
}
