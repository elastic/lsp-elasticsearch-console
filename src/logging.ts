/**
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import envPaths from 'env-paths'
import debugLib from 'debug'
import type { Connection } from 'vscode-languageserver/node.js'

interface LoggerOptions {
  connection?: Connection
  enableFileLogging?: boolean
  namespace?: string
}

let connection: Connection | undefined
let fileStream: ReturnType<typeof createWriteStream> | undefined
let debuggers: Map<string, ReturnType<typeof debugLib>> = new Map()

/**
 * Initialize the logging system.
 * Must be called before using the logger.
 */
export function initializeLogger(options: LoggerOptions = {}): void {
  connection = options.connection
  const namespace = options.namespace || 'lsp-elasticsearch-console'

  if (options.enableFileLogging !== false) {
    setupFileLogging(namespace)
  }
}

function setupFileLogging(namespace: string): void {
  try {
    const paths = envPaths(namespace, { suffix: '' })
    const logsDir = paths.log
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFile = join(logsDir, `${namespace}-${timestamp}.log`)
    fileStream = createWriteStream(logFile, { flags: 'a' })

    fileStream.on('error', (err) => {
      console.error('Failed to write to log file:', err)
    })
  } catch (err) {
    console.error('Failed to initialize file logging:', err)
  }
}

/**
 * Get or create a logger for a specific namespace.
 */
export function getLogger(namespace: string): Logger {
  if (!debuggers.has(namespace)) {
    debuggers.set(namespace, debugLib(namespace))
  }
  return new Logger(namespace, debuggers.get(namespace)!)
}

class Logger {
  private debug: ReturnType<typeof debugLib>

  constructor(
    private namespace: string,
    debugFn: ReturnType<typeof debugLib>
  ) {
    this.debug = debugFn
  }

  /**
   * Log an info level message
   */
  info(message: string, ...args: unknown[]): void {
    this.debug(message, ...args)
    this.writeToFile('INFO', message, args)
    if (connection) {
      connection.console.log(`[${this.namespace}] ${message}`)
    }
  }

  /**
   * Log a warning level message
   */
  warn(message: string, ...args: unknown[]): void {
    this.debug(message, ...args)
    this.writeToFile('WARN', message, args)
    if (connection) {
      connection.console.warn(`[${this.namespace}] ${message}`)
    }
  }

  /**
   * Log an error level message
   */
  error(message: string, ...args: unknown[]): void {
    this.debug(message, ...args)
    this.writeToFile('ERROR', message, args)
    if (connection) {
      connection.console.error(`[${this.namespace}] ${message}`)
    }
  }

  /**
   * Log a debug level message
   */
  debugLog(message: string, ...args: unknown[]): void {
    this.debug(message, ...args)
    this.writeToFile('DEBUG', message, args)
  }

  private writeToFile(level: string, message: string, args: unknown[]): void {
    if (!fileStream) return

    const timestamp = new Date().toISOString()
    const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : ''
    const logLine = `[${timestamp}] [${level}] [${this.namespace}] ${message}${formattedArgs}\n`

    fileStream.write(logLine, (err) => {
      if (err) {
        console.error('Failed to write log line:', err)
      }
    })
  }
}

export { Logger }
