import { processBatch } from './sequential.mjs';
let raw = '';
try {
  for await (const chunk of process.stdin) raw += chunk;
  process.stdout.write(JSON.stringify(processBatch(JSON.parse(raw))) + '\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
