import { defineConfig } from 'vitest/config'

const nodeBuiltIns = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'crypto', 'dns',
  'events', 'fs', 'http', 'http2', 'https', 'net', 'os', 'path', 'process',
  'querystring', 'stream', 'tls', 'url', 'util', 'worker_threads', 'zlib',
]

const nodeBuiltInsPrefixes = [ 'node:' ]

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/node_modules', '**/dist', '.idea', '.git', '.cache', '**/lib', '**/out'],
  },
  build: {
    lib: {
      entry: import.meta.dirname + '/src/index.ts',
      name: 'entropic-bond-firebase-admin',
			formats: ['es', 'cjs'],
			fileName: (format) => {
				if (format === 'es') return 'esm/index.js';
				if (format === 'cjs') return 'cjs/index.js';
				return `index.${format}.js`;
			}
		},
		sourcemap: true,
		outDir: 'lib',
		rollupOptions: {
			external: [
				/^entropic-bond/,
				/^firebase-admin/,
				/^firebase-functions/,
				'async_hooks', 'fs', 'path', 'util', 'events', 'stream', 'http', 'https', 'crypto', 'url', 'os', 'zlib', 'child_process', 'assert', 'querystring', 'net', 'tls', 'buffer', 'process', 'tty', 'v8', 'vm', 'worker_threads',
				/^node:.*/,
			]
		}
	},
})
