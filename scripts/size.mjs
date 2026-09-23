// Size budget. Fails when a built file exceeds its gzip limit, so the numbers
// in the README cannot drift silently.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const budget = {
  'dist/index.js': 3000,
  'dist/toastkit.css': 2000,
}

let failed = false
for (const [file, limit] of Object.entries(budget)) {
  const raw = readFileSync(file)
  const gz = gzipSync(raw, { level: 9 }).length
  const ok = gz <= limit
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file.padEnd(20)} ${String(raw.length).padStart(6)} B raw ${String(gz).padStart(5)} B gzip (limit ${limit})`)
}
process.exit(failed ? 1 : 0)
