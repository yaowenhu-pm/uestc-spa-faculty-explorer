import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SITE_FILES, stageSite } from '../scripts/stage-site.mjs';
import { createRequestHandler, resolveSiteRequest } from '../scripts/serve.mjs';

async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'uestc-spa-release-'));
  const root = path.join(temporary, 'project');
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  for (const file of SITE_FILES) await fs.writeFile(path.join(root, file), `fixture:${file}`);
  t.after(async () => {
    const target = path.resolve(temporary);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('uestc-spa-release-'));
    await fs.rm(target, { recursive: true, force: true });
  });
  return { root, temporary };
}

async function request(handler, url, method = 'GET') {
  const result = {};
  await handler({ url, method }, {
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(body) { result.body = body?.toString() || ''; },
  });
  return result;
}

test('Pages artifact contains exactly the website allowlist, never source or stale files', async t => {
  const { root } = await fixture(t);
  await fs.writeFile(path.join(root, 'data/faculty.source.json'), 'source snapshot');
  await fs.writeFile(path.join(root, 'data/raw.json'), 'private collection');
  await fs.mkdir(path.join(root, '_site/data'), { recursive: true });
  await fs.writeFile(path.join(root, '_site/data/old-private.json'), 'stale artifact');
  const { destination } = await stageSite(root);
  const files = (await fs.readdir(destination, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(destination, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(files, [...SITE_FILES].sort());
  for (const file of SITE_FILES) assert.equal(await fs.readFile(path.join(destination, file), 'utf8'), `fixture:${file}`);
});

test('staging fails before replacing the last artifact when a required input is missing', async t => {
  const { root } = await fixture(t);
  await stageSite(root);
  await fs.unlink(path.join(root, 'data/faculty.public.json'));
  await assert.rejects(stageSite(root), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(root, '_site/data/faculty.public.json'), 'utf8'), 'fixture:data/faculty.public.json');
});

test('staging refuses an asset directory that resolves outside the project', async t => {
  const { root, temporary } = await fixture(t);
  const outside = path.join(temporary, 'outside');
  await fs.rename(path.join(root, 'data'), outside);
  try {
    await fs.symlink(outside, path.join(root, 'data'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') { t.skip('Filesystem does not permit symlinks'); return; }
    throw error;
  }
  await assert.rejects(stageSite(root), /escapes project/);
});

test('raw and encoded traversal, Windows paths and malformed encodings are rejected', () => {
  for (const url of ['/../app.js', '/%2e%2e/app.js', '/data/%2e%2e/app.js', '/data%2f..%2fapp.js', '/data%5c..%5capp.js', '/C:/Users/private', '/app.js:secret', '/./app.js']) {
    assert.equal(resolveSiteRequest(url).status, 403, url);
  }
  for (const url of ['/bad%ZZ', '/%00', '//example.com/app.js', 'https://example.com/app.js']) {
    assert.equal(resolveSiteRequest(url).status, 400, url);
  }
  assert.equal(resolveSiteRequest('/%252e%252e/private').status, 404);
});

test('preview serves the same public files from root and the GitHub Pages subpath', async t => {
  const { root } = await fixture(t);
  const handler = createRequestHandler({ root });
  for (const url of ['/', '/?search=公共管理', '/uestc-spa-faculty-explorer/']) {
    const response = await request(handler, url);
    assert.equal(response.status, 200);
    assert.equal(response.body, 'fixture:index.html');
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  }
  const json = await request(handler, '/uestc-spa-faculty-explorer/data/faculty.public.json?v=1');
  assert.equal(json.status, 200);
  assert.equal(json.headers['content-type'], 'application/json; charset=utf-8');
  const head = await request(handler, '/styles.css', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], Buffer.byteLength('fixture:styles.css'));
  assert.equal(head.headers['cache-control'], 'no-store');
});

test('missing files and directories return the 404 page without exposing repository inputs', async t => {
  const { root } = await fixture(t);
  await fs.writeFile(path.join(root, 'data/faculty.source.json'), 'source snapshot');
  const handler = createRequestHandler({ root });
  for (const url of ['/data', '/data/', '/index.html/', '/missing.js', '/nested/missing/', '/data/faculty.source.json', '/scripts/serve.mjs', '/.git/config', '/uestc-spa-faculty-explorer/data/faculty.source.json']) {
    const response = await request(handler, url);
    assert.equal(response.status, 404, url);
    assert.equal(response.body, 'fixture:404.html', url);
  }
  await fs.unlink(path.join(root, 'app.js'));
  assert.equal((await request(handler, '/app.js')).status, 404);
});

test('preview handles directory-root redirects and unsupported HTTP methods explicitly', async t => {
  const { root } = await fixture(t);
  const handler = createRequestHandler({ root });
  const redirect = await request(handler, '/uestc-spa-faculty-explorer?search=test');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/uestc-spa-faculty-explorer/?search=test');
  const post = await request(handler, '/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});
