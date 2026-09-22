import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/server', { recursive: true });
await copyFile('src/index.js', 'dist/server/index.js');
