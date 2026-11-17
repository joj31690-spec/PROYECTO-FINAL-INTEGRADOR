import { spawn } from 'node:child_process';
const children = [spawn(process.execPath, ['--env-file-if-exists=.env', 'backend/server.mjs'], { stdio: 'inherit' }), spawn('pnpm', ['dev:frontend'], { stdio: 'inherit' })];
function stop(code = 0) { for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of children) child.on('exit', code => stop(code || 0));
