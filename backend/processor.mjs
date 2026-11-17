import { processBatch } from '../engine/sequential.mjs';
// Future C++ adapter belongs here: JSON stdin/stdout, same contract.
export function createProcessor(mode) {
  if (mode !== 'sequential') throw new Error(`Unsupported ENGINE_MODE: ${mode}`);
  return { process: async input => processBatch(input) };
}
