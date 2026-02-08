import { expect, test, vi } from 'vitest';
import { outputJSON, outputErrorJSON } from '../../src/utils/formatter.js';

test('outputJSON prints valid JSON to stdout', () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const data = { foo: 'bar' };
  outputJSON(data);
  expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ success: true, data }, null, 2));
  consoleSpy.mockRestore();
});

test('outputErrorJSON prints error JSON to stderr', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = { message: 'oops', code: 'E_OOPS', details: { x: 1 } };
  outputErrorJSON(error);
  expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({
      success: false,
      error: 'E_OOPS',
      message: 'oops',
      details: { x: 1 }
  }, null, 2));
  consoleSpy.mockRestore();
});
