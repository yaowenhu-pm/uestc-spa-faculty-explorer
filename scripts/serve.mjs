import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, SITE_FILES, readSiteFile } from './stage-site.mjs';

const projectPath = '/uestc-spa-faculty-explorer/';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

// Inspect the raw request path before URL normalization can erase traversal.
export function resolveSiteRequest(url = '/') {
  let pathname;
  const queryIndex = url.indexOf('?');
  const query = queryIndex < 0 ? '' : url.slice(queryIndex);
  try {
    pathname = decodeURIComponent(queryIndex < 0 ? url : url.slice(0, queryIndex));
  } catch {
    return { status: 400 };
  }
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\0')) return { status: 400 };
  if (/[\\:]/.test(pathname) || pathname.split('/').some(segment => segment === '.' || segment === '..')) return { status: 403 };
  if (pathname === projectPath.slice(0, -1)) return { status: 308, location: projectPath + query };
  if (pathname.startsWith(projectPath)) pathname = pathname.slice(projectPath.length - 1);
  const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
  return SITE_FILES.includes(filename) ? { status: 200, filename } : { status: 404 };
}

export function createRequestHandler({ root = PROJECT_ROOT } = {}) {
  return async (request, response) => {
    const send = (status, body = '', headers = {}) => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      response.writeHead(status, {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': bytes.length,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        ...headers,
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    };
    const notFound = async () => {
      try {
        send(404, await readSiteFile(root, '404.html'), { 'content-type': types['.html'] });
      } catch {
        send(404, 'Not Found');
      }
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      send(405, 'Method Not Allowed', { allow: 'GET, HEAD' });
      return;
    }
    const route = resolveSiteRequest(request.url);
    if (route.status === 308) {
      send(308, '', { location: route.location });
      return;
    }
    if (route.status === 404) {
      await notFound();
      return;
    }
    if (route.status !== 200) {
      send(route.status, route.status === 400 ? 'Bad Request' : 'Forbidden');
      return;
    }
    try {
      send(200, await readSiteFile(root, route.filename), { 'content-type': types[path.extname(route.filename)] });
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) await notFound();
      else send(500, 'Unable to read website file');
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  const server = http.createServer(createRequestHandler());
  server.on('error', error => { console.error(`Preview failed: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}${projectPath}`));
}
