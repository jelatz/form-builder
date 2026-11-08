/**
 * Vite Dev Server & Preview Plugin for Local Cloudflare D1 (SQLite) + Worker Middleware
 * Connects /api/* requests directly to cloudflare/worker.ts using Node's built-in node:sqlite.
 */

import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import worker from './worker.ts';
import type { D1Database, D1PreparedStatement, D1Result, D1AllResult, Env } from './worker.ts';

/**
 * Adapts Node.js 22+ built-in node:sqlite DatabaseSync into Cloudflare D1Database API
 */
export function createNodeSqliteD1Adapter(db: DatabaseSync): D1Database {
  function normalizeParams(values: unknown[]): (string | number | bigint | Buffer | null)[] {
    return values.map((val) => {
      if (val === undefined || val === null) {
        return null;
      }
      if (typeof val === 'boolean') {
        return val ? 1 : 0;
      }
      if (typeof val === 'number' || typeof val === 'string' || typeof val === 'bigint') {
        return val;
      }
      if (Buffer.isBuffer(val)) {
        return val;
      }
      return JSON.stringify(val);
    });
  }

  function createStatement(query: string, boundValues: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]): D1PreparedStatement {
        return createStatement(query, values);
      },

      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = db.prepare(query);
        const params = normalizeParams(boundValues);
        const row = stmt.get(...params) as Record<string, unknown> | undefined;
        if (!row) {
          return null;
        }
        if (colName) {
          return (row[colName] ?? null) as T;
        }
        return row as T;
      },

      async all<T = unknown>(): Promise<D1AllResult<T>> {
        const stmt = db.prepare(query);
        const params = normalizeParams(boundValues);
        const rows = stmt.all(...params) as T[];
        return {
          results: rows,
          success: true,
        };
      },

      async run<T = unknown>(): Promise<D1Result<T>> {
        const stmt = db.prepare(query);
        const params = normalizeParams(boundValues);
        const res = stmt.run(...params);
        return {
          results: [] as T[],
          success: true,
          meta: {
            changes: res.changes,
            last_row_id: Number(res.lastInsertRowid),
          },
        };
      },
    };
  }

  return {
    prepare(query: string): D1PreparedStatement {
      return createStatement(query);
    },

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        const res = await stmt.run<T>();
        results.push(res);
      }
      return results;
    },

    async exec<T = unknown>(query: string): Promise<D1Result<T>> {
      db.exec(query);
      return {
        results: [] as T[],
        success: true,
      };
    },
  };
}

/**
 * Attaches Connect middleware handling /api/* by proxying to the Cloudflare Worker fetch router
 */
function registerApiMiddleware(
  middlewares: ViteDevServer['middlewares'],
  db: DatabaseSync,
  d1Adapter: D1Database,
  schemaSql: string
): void {
  middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/')) {
      return next();
    }

    try {
      const host = req.headers.host || 'localhost:5173';
      const fullUrl = `http://${host}${rawUrl}`;
      const parsedUrl = new URL(fullUrl);

      // Dedicated fast-path for workspace reset
      if (parsedUrl.pathname === '/api/workspace/reset' && req.method === 'POST') {
        db.exec('DELETE FROM submission_deliveries;');
        db.exec('DELETE FROM submissions;');
        db.exec('DELETE FROM forms;');
        db.exec('DELETE FROM clients;');
        db.exec(schemaSql);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, success: true, message: 'Workspace reset to default seed state' }));
        return;
      }

      // Read incoming request body if present
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : null;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, value);
          }
        }
      }

      const method = req.method?.toUpperCase() || 'GET';
      const hasBody = !['GET', 'HEAD'].includes(method) && bodyBuffer !== null && bodyBuffer.length > 0;

      const webRequest = new Request(fullUrl, {
        method,
        headers,
        body: hasBody ? bodyBuffer : undefined,
        duplex: 'half',
      });

      const env: Env = {
        DB: d1Adapter,
        ENVIRONMENT: 'development',
        RESET_SQL: schemaSql,
      };

      const response = await worker.fetch(webRequest, env);

      res.statusCode = response.status;
      response.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      const responseArrayBuffer = await response.arrayBuffer();
      res.end(Buffer.from(responseArrayBuffer));
    } catch (err) {
      console.error('[vite-d1-plugin] Middleware handler error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }));
    }
  });
}

/**
 * Vite plugin that mounts Cloudflare D1 (SQLite) and Cloudflare Worker API middleware in dev & preview
 */
export function cloudflareD1DevPlugin(): Plugin {
  const rootDir = process.cwd();
  const wranglerDir = path.resolve(rootDir, '.wrangler');
  if (!fs.existsSync(wranglerDir)) {
    fs.mkdirSync(wranglerDir, { recursive: true });
  }

  const dbPath = path.resolve(wranglerDir, 'local-d1.sqlite');
  const db = new DatabaseSync(dbPath);

  const schemaPath = path.resolve(rootDir, 'cloudflare/d1-schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Initialize SQLite database schema and initial seed data idempotently
  db.exec(schemaSql);

  const d1Adapter = createNodeSqliteD1Adapter(db);

  return {
    name: 'vite-plugin-cloudflare-d1',
    configureServer(server: ViteDevServer) {
      registerApiMiddleware(server.middlewares, db, d1Adapter, schemaSql);
    },
    configurePreviewServer(previewServer: PreviewServer) {
      registerApiMiddleware(previewServer.middlewares, db, d1Adapter, schemaSql);
    },
  };
}
