import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

/**
 * Bundle the CLI for pkg compilation.
 *
 * Key issues solved:
 * 1. ESM import.meta.url is not available in CJS -- replaced via plugin with
 *    a CJS-compatible equivalent using require("url").pathToFileURL(__filename).
 * 2. The source reads package.json at runtime for the version number. In a pkg
 *    binary, the file won't exist at the expected path. We inject the version
 *    as a define so it's inlined at build time.
 */

const importMetaPlugin = {
  name: 'import-meta-url',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const fs = await import('fs');
      let contents = fs.readFileSync(args.path, 'utf8');
      if (contents.includes('import.meta.url')) {
        contents = contents.replaceAll(
          'import.meta.url',
          'require("url").pathToFileURL(__filename).href'
        );
        return { contents, loader: 'js' };
      }
      return null;
    });
  },
};

await esbuild.build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/bundle.cjs',
  format: 'cjs',
  plugins: [importMetaPlugin],
  external: ['@yao-pkg/pkg'],
  // Inject version so we don't need to read package.json at runtime
  define: {
    'process.env.MAESTRO_CLI_VERSION': JSON.stringify(pkg.version),
  },
});

console.log(`Bundle created: dist/bundle.cjs (version: ${pkg.version})`);
