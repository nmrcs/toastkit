// Copies the stylesheet into dist and the built files into the demo folder,
// so the demo page runs against the exact artifact that is published, and
// writes their gzip sizes for the demo header (same numbers as `npm run size`).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

mkdirSync('dist', { recursive: true })
copyFileSync('src/toastkit.css', 'dist/toastkit.css')
copyFileSync('dist/index.js', 'demo/toastkit.js')
copyFileSync('dist/toastkit.css', 'demo/toastkit.css')

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length
writeFileSync('demo/size.json', JSON.stringify({ js: gz('dist/index.js'), css: gz('dist/toastkit.css') }) + '\n')
