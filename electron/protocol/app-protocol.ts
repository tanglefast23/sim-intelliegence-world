import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Protocol } from 'electron';

export const APP_SCHEME = 'app' as const;
export const APP_HOST = 'game' as const;
export const APP_URL = `${APP_SCHEME}://${APP_HOST}/` as const;
export const WEBGL2_PROBE_URL = `${APP_URL}webgl2-probe.html` as const;

export const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

type ResolvedRequest =
  | Readonly<{ ok: true; filePath: string }>
  | Readonly<{ ok: false; status: 400 | 404 }>;

export function registerAppSchemePrivileges(protocolModule: Pick<Protocol, 'registerSchemesAsPrivileged'>): void {
  protocolModule.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        bypassCSP: false,
        codeCache: true,
        corsEnabled: false,
        secure: true,
        standard: true,
        stream: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

export function resolveAppRequest(requestUrl: string, distributionRoot: string): ResolvedRequest {
  if (/(?:\/\.\.?\/|%(?:2e|2f|5c))/iu.test(requestUrl)) {
    return { ok: false, status: 400 };
  }

  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return { ok: false, status: 400 };
  }

  if (
    url.protocol !== `${APP_SCHEME}:` ||
    url.hostname !== APP_HOST ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return { ok: false, status: 404 };
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return { ok: false, status: 400 };
  }

  if (decodedPath.includes('\0') || decodedPath.includes('\\')) {
    return { ok: false, status: 400 };
  }

  const requestedPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const root = resolve(distributionRoot);
  const filePath = resolve(root, requestedPath);
  const relativePath = relative(root, filePath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath) || relativePath === '') {
    return { ok: false, status: 400 };
  }

  return { ok: true, filePath };
}

function securityHeaders(sourceHeaders?: Headers): Headers {
  const headers = new Headers(sourceHeaders);
  headers.set('Content-Security-Policy', APP_CONTENT_SECURITY_POLICY);
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

export function createAppProtocolHandler(
  distributionRoot: string,
  fetchFile: (fileUrl: string) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: securityHeaders(),
      });
    }

    const resolved = resolveAppRequest(request.url, distributionRoot);
    if (!resolved.ok) {
      return new Response(resolved.status === 404 ? 'Not found' : 'Bad request', {
        status: resolved.status,
        headers: securityHeaders(),
      });
    }

    const fileResponse = await fetchFile(pathToFileURL(resolved.filePath).toString());
    return new Response(request.method === 'HEAD' ? null : fileResponse.body, {
      status: fileResponse.status,
      statusText: fileResponse.statusText,
      headers: securityHeaders(fileResponse.headers),
    });
  };
}
