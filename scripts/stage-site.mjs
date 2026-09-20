import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// This is the entire website artifact. Source snapshots and collection archives
// must never enter it through a directory-wide copy or a data/*.json glob.
export const SITE_FILES = Object.freeze([
  'index.html',
  'methodology.html',
  '404.html',
  'styles.css',
  'app.js',
  'DATA_NOTICE.md',
  'data/faculty.public.json',
  'data/statistics.json',
  'data/data-version.json',
]);

export async function readSiteFile(projectRoot, filename) {
  if (!SITE_FILES.includes(filename)) throw new Error(`Not a website file: ${filename}`);
  const root = await fs.realpath(projectRoot);
  const target = path.join(root, filename);
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected regular file: ${filename}`);
  const resolved = await fs.realpath(target);
  const relative = path.relative(root, resolved);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Website file escapes project: ${filename}`);
  }
  return fs.readFile(resolved);
}

export async function stageSite(projectRoot = PROJECT_ROOT) {
  const root = await fs.realpath(projectRoot);
  // Validate and read everything before replacing a previous successful build.
  const files = await Promise.all(SITE_FILES.map(async filename => [filename, await readSiteFile(root, filename)]));
  const destination = path.resolve(root, '_site');
  if (path.dirname(destination) !== root || path.basename(destination) !== '_site') {
    throw new Error('Refusing to replace a directory outside the project _site output');
  }
  try {
    if ((await fs.lstat(destination)).isSymbolicLink()) throw new Error('Refusing to replace a symlinked _site output');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, 'data'), { recursive: true });
  for (const [filename, contents] of files) await fs.writeFile(path.join(destination, filename), contents);
  return { destination, files: [...SITE_FILES] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await stageSite(), null, 2));
}
