import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppStore } from '../db/store.ts';
import { hashSessionToken } from '../lib/crypto.ts';
import type { AuthContext } from '../types.ts';

export const SESSION_COOKIE_NAME = 'fb_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthContext | null;
  }
}

export function setSessionCookie(
  reply: FastifyReply,
  rawToken: string,
  isProduction: boolean,
): void {
  reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(
  reply: FastifyReply,
  isProduction: boolean,
): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Hydrates `request.authContext` from the HttpOnly session cookie on every request.
 */
export function createAuthHook(store: AppStore) {
  return async function authenticateRequest(
    request: FastifyRequest,
  ): Promise<void> {
    request.authContext = null;
    const rawToken = request.cookies?.[SESSION_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== 'string') {
      return;
    }

    const tokenHash = hashSessionToken(rawToken);
    const context = await store.findActiveSession(
      tokenHash,
      new Date().toISOString(),
    );
    if (context) {
      request.authContext = context;
    }
  };
}
