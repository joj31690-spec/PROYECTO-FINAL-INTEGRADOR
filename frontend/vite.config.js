import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return { root: fileURLToPath(new URL('./', import.meta.url)), server: { host: env.FRONTEND_HOST || '127.0.0.1', port: Number(env.FRONTEND_PORT || 5173), strictPort: true, proxy: { '/api': env.VITE_API_PROXY || 'http://127.0.0.1:3001' } } };
});
