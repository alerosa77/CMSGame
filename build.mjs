import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await copyFile('src/index.js', 'dist/server/app.js');
await copyFile('src/realtime.js', 'dist/server/index.js');
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
