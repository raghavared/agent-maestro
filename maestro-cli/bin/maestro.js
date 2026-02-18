#!/usr/bin/env node

// Suppress ExperimentalWarning for JSON module imports (triggered by cli-spinners used in ora)
const originalEmit = process.emit;
process.emit = function (event, ...args) {
  if (event === 'warning' && args[0]?.name === 'ExperimentalWarning' && args[0]?.message?.includes('Importing JSON modules')) {
    return false;
  }
  return originalEmit.call(this, event, ...args);
};

await import('../dist/index.js');
