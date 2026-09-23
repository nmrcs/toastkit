import { configure, mount, toast } from './toastkit.js'
import { highlight } from './highlight.js'

const $ = (s) => document.querySelector(s)
const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']
const state = { position: 'bottom-right', theme: 'auto', duration: 4000, max: 5, pauseOnHover: true, swipe: true, stack: 'expand' }

mount(state)

// Position grid.
const grid = $('#positions')
for (const p of positions) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = p
  b.setAttribute('aria-pressed', String(p === state.position))
  b.addEventListener('click', () => {
    state.position = p
    for (const x of grid.children) x.setAttribute('aria-pressed', String(x === b))
    configure({ position: p })
    show('text')
  })
  grid.append(b)
}

// Theme, behaviour.
for (const r of document.querySelectorAll('input[name="theme"]')) {
  r.addEventListener('change', () => {
    state.theme = r.value
    configure({ theme: r.value })
    show('text')
  })
}
$('#duration').addEventListener('change', (e) => configure({ duration: (state.duration = Number(e.target.value)) }))
$('#max').addEventListener('change', (e) => configure({ max: (state.max = Number(e.target.value)) }))
$('#pause').addEventListener('change', (e) => configure({ pauseOnHover: (state.pauseOnHover = e.target.checked) }))
$('#swipe').addEventListener('change', (e) => configure({ swipe: (state.swipe = e.target.checked) }))
$('#stack').addEventListener('change', (e) => {
  configure({ stack: (state.stack = e.target.value) })
  for (const t of ['Deploy started', 'Tests passed', 'Build published']) toast(t)
})

// Variants: each entry returns the code it ran, shown under "Last call".
const fakeUpload = () => new Promise((resolve, reject) => setTimeout(() => (Math.random() < 0.7 ? resolve('report.pdf') : reject(new Error('network'))), 1800))
const variants = {
  text: () => {
    toast('Changes saved')
    return `toast('Changes saved')`
  },
  description: () => {
    toast('Invoice sent', { description: 'Customer will receive it within a minute.' })
    return `toast('Invoice sent', { description: 'Customer will receive it within a minute.' })`
  },
  success: () => {
    toast.success('Payment confirmed')
    return `toast.success('Payment confirmed')`
  },
  error: () => {
    toast.error('Could not connect', { description: 'Check your network and try again.' })
    return `toast.error('Could not connect', { description: 'Check your network and try again.' })`
  },
  warning: () => {
    toast.warning('Storage almost full')
    return `toast.warning('Storage almost full')`
  },
  info: () => {
    toast.info('New version available')
    return `toast.info('New version available')`
  },
  promise: () => {
    toast.promise(fakeUpload(), { loading: 'Uploading…', success: (name) => `Uploaded ${name}`, error: (e) => `Upload failed: ${e.message}` }).catch(() => {})
    return `toast.promise(upload(), {\n  loading: 'Uploading…',\n  success: (name) => \`Uploaded \${name}\`,\n  error: (e) => \`Upload failed: \${e.message}\`,\n})`
  },
  action: () => {
    toast('Message deleted', { action: { label: 'Undo', onClick: () => toast.success('Restored') } })
    return `toast('Message deleted', {\n  action: { label: 'Undo', onClick: () => toast.success('Restored') },\n})`
  },
  sticky: () => {
    toast.info('Stays until you close it', { duration: Infinity })
    return `toast.info('Stays until you close it', { duration: Infinity })`
  },
  custom: () => {
    const el = document.createElement('div')
    el.innerHTML = '<strong>Build #4821</strong> passed in 42s · <a href="#">open log</a>'
    toast('', { content: el })
    return `const el = document.createElement('div')\nel.innerHTML = '<strong>Build #4821</strong> passed in 42s · <a href="#">open log</a>'\ntoast('', { content: el })`
  },
  dismiss: () => {
    toast.dismiss()
    return `toast.dismiss()`
  },
}
function show(name) {
  $('#code code').innerHTML = highlight(variants[name](), 'js')
}
$('#variants').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.variant
  if (v) show(v)
})

// Live CSS: the variable block of the shipped stylesheet, editable in place.
// Edits are injected as `.tk, .tk[data-theme]` so they win over the built-in
// themes in every mode.
const css = $('#css')
const live = $('#live-css')
const hl = $('#css-hl')
const paint = () => {
  hl.innerHTML = highlight(css.value, 'css') + '\n'
  hl.scrollTop = css.scrollTop
}
const apply = () => (live.textContent = css.value.replace(/^\s*\.tk\s*\{/, '.tk, .tk[data-theme] {'))
fetch('./toastkit.css')
  .then((r) => r.text())
  .then((text) => {
    const block = text.match(/\.tk \{[\s\S]*?\n\}/)?.[0] ?? ''
    css.defaultValue = block
    css.value = block
    paint()
  })
css.addEventListener('input', () => {
  apply()
  paint()
})
css.addEventListener('scroll', () => (hl.scrollTop = css.scrollTop))
$('#reset').addEventListener('click', () => {
  css.value = css.defaultValue
  live.textContent = ''
  paint()
})
$('#copy').addEventListener('click', () => navigator.clipboard?.writeText(css.value).then(() => toast.success('CSS copied')))

// Header badge: gzip sizes written by the build (demo/size.json), the same
// numbers the size budget checks.
fetch('./size.json')
  .then((r) => r.json())
  .then(({ js, css: cssBytes }) => {
    $('#size').textContent = `${(js / 1000).toFixed(1)} KB JS + ${(cssBytes / 1000).toFixed(1)} KB CSS gzip · zero dependencies`
  })
  .catch(() => {})

show('text')
