/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { Connection, Hover, MarkupContent, MarkupKind, TextDocuments } from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { isPathContext, isHttpMethodContext, getHttpMethodFromLine, getPathFromLine } from '../parsing/context.js'
import { getEndpoints, findEndpoint, Endpoint } from '../elasticsearch.js'

/**
 * Get hover information for a document position.
 * Pure function for testability.
 */
export function getHoverInfo(document: TextDocument, line: number, character: number, endpoints: Endpoint[]): Hover | null {
  // check if cursor is in path context or HTTP method context
  const inPathContext = isPathContext(document, line, character)
  const inMethodContext = isHttpMethodContext(document, line, character)
  if (!inPathContext && !inMethodContext) return null

  // extract the HTTP method and path from the line
  const method = getHttpMethodFromLine(document, line)
  const path = getPathFromLine(document, line)
  if (!path || !method) return null

  // find the endpoint in the schema
  const endpoint = findEndpoint(path, method, endpoints)
  if (!endpoint) return null

  // build the hover content
  const name = endpoint.name || `${endpoint.request.namespace}.${endpoint.request.name}`
  const description = endpoint.description ?? ''

  // collect all unique methods from all URL templates
  const allMethods = new Set<string>()
  endpoint.urls.forEach(url => {
    url.methods.forEach(m => allMethods.add(m))
  })
  const methodsList = Array.from(allMethods).join(', ')

  // collect all paths
  const pathsList = endpoint.urls
    .map(url => `\`${url.path}\``)
    .join(', ')

  // build markdown content
  let markdown = `**${name}**\n\n`
  if (description) markdown += `${description}\n\n`
  markdown += `**Methods:** ${methodsList}\n\n`
  markdown += `**Paths:** ${pathsList}\n\n`
  if (endpoint.docUrl) markdown += `[Documentation](${endpoint.docUrl})`

  const contents: MarkupContent = {
    kind: MarkupKind.Markdown,
    value: markdown.trim()
  }

  return { contents }
}

/**
 * Register the hover handler with the LSP connection.
 */
export function registerHoverHandler(connection: Connection, documents: TextDocuments<TextDocument>): void {
  connection.onHover(async (params) => {
    const document = documents.get(params.textDocument.uri)
    if (!document) return null

    const endpoints = await getEndpoints()
    const { line, character } = params.position
    return getHoverInfo(document, line, character, endpoints)
  })
}
