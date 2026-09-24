// Dev loop without extra dependencies: tsc in watch mode, the stylesheet and
// the build copied into demo/ on every change, and a static server for demo/.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, watch } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { styleText } from 'node:util'

const port = Number(process.env.PORT ?? 4323)
const root = 'demo'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }

function copy() {
  spawn(process.execPath, ['scripts/copy.mjs'], { stdio: 'inherit' })
}

// tsc straight from node_modules: no shell, no npx, no DEP0190 warning.
const tsc = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput', '--pretty'], { stdio: ['ignore', 'pipe', 'inherit'] })
// The URL goes last after every compile, so tsc output never buries it.
const url = `http://localhost:${port}/`
tsc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
  if (String(chunk).includes('Watching for file changes')) {
    console.log(`\n  ${styleText(['bold', 'green'], 'toastkit demo')}  ${styleText('green', '➜')}  ${styleText(['bold', 'cyan'], url)}\n`)
  }
})
let timer
const schedule = () => {
  clearTimeout(timer)
  timer = setTimeout(copy, 150)
}
watch('src', schedule)
if (existsSync('dist')) watch('dist', schedule)
else setTimeout(() => existsSync('dist') && watch('dist', schedule), 3000)

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  let path = normalize(decodeURIComponent(url.pathname))
  if (path.endsWith('/')) path += 'index.html'
  const file = join(root, path)
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(readFileSync(file))
}).listen(port)

process.on('SIGINT', () => {
  tsc.kill()
  process.exit(0)
})
