import { createRequire } from 'node:module'
import { defineConfig } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import ts from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'
import rm from 'rollup-plugin-rm'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {})
]

export default defineConfig([
  {
    input: ['src/main.ts', 'src/preload.ts', 'src/renderer.ts'],
    output: [
      {
        entryFileNames: '[name].cjs',
        chunkFileNames: 'chunks/lib-[hash].cjs',
        format: 'cjs',
        dir: 'dist'
      },
      {
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/lib-[hash].mjs',
        format: 'es',
        dir: 'dist'
      }
    ],
    external,
    plugins: [
      rm('dist', 'buildStart'),
      resolve(),
      commonjs(),
      ts({
        compilerOptions: {
          rootDir: 'src',
          declaration: true,
          outDir: 'dist/types'
        }
      })
    ]
  },
  {
    input: ['src/global.ts'],
    output: [
      {
        entryFileNames: 'electron-conf-preload.cjs',
        format: 'cjs',
        dir: 'dist'
      },
      {
        entryFileNames: 'electron-conf-preload.mjs',
        format: 'es',
        dir: 'dist'
      }
    ],
    external,
    plugins: [resolve(), commonjs(), ts()]
  },
  {
    input: ['dist/types/main.d.ts'],
    output: [{ file: './dist/main.d.ts', format: 'es' }],
    plugins: [dts()]
  },
  {
    input: ['dist/types/preload.d.ts'],
    output: [{ file: './dist/preload.d.ts', format: 'es' }],
    plugins: [dts()]
  },
  {
    input: ['dist/types/renderer.d.ts'],
    output: [{ file: './dist/renderer.d.ts', format: 'es' }],
    plugins: [dts(), rm('dist/types', 'buildEnd')]
  }
])
