import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'

export default defineConfig({
  test: {
		globals: true,
		exclude: ['**/node_modules', '**/dist', '.idea', '.git', '.cache','**/lib', '**/out'],
	},
	build: {
		lib: {
			entry: resolve( __dirname, 'src/index.ts' ),
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
	plugins: [
		dts({
			outDir: 'lib/esm',
			entryRoot: 'src',
			exclude: ['**/*.spec.ts', '**/*.test.ts', 'src/mocks/**']
		})
	]
})
