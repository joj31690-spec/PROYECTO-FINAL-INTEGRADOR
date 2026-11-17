import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3001),
  dataDir: resolve(root, process.env.DATA_DIR || 'backend/storage'),
  engineMode: process.env.ENGINE_MODE || 'sequential'
};
