/**
 * toastkit — sonner-style toasts for vanilla JavaScript. CSS is the API.
 *
 * The library owns behaviour only: it builds DOM, keeps the stack, runs the
 * timers and handles keyboard and pointer events. Every visual decision lives
 * in toastkit.css and is reachable through `--tk-*` custom properties and the
 * `data-*` attributes documented below.
 */

export type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/** Built-in themes plus any string you style yourself under `.tk[data-theme="…"]`. */
export type Theme = 'light' | 'dark' | 'auto' | (string & {})

export type Kind = 'default' | 'success' | 'error' | 'info' | 'warning' | 'loading'

export interface Action {
  label: string
  /** Called on click. The toast is dismissed afterwards unless `keepOpen` is set. */
  onClick: (event: MouseEvent) => void
  keepOpen?: boolean
}

/** Custom content: a string (rendered as text), an element, or a function that returns one. */
export type Content = string | HTMLElement | (() => HTMLElement)

export interface ToastOptions {
  id?: string
  kind?: Kind
  description?: string
  /** Milliseconds before auto-dismiss. `Infinity` keeps the toast until dismissed. */
  duration?: number
  action?: Action
  /** Show the close button. Defaults to `true`. */
  dismissible?: boolean
  onDismiss?: (id: string) => void
  /** Extra class on the toast element, for your own CSS hooks. */
  className?: string
  /** Replaces the title/description block with your own content. */
  content?: Content
  /** Your own icon on the left, in place of the kind's: text such as an emoji, or an element such as an inline SVG. */
  icon?: string | HTMLElement
}

export interface MountOptions {
  position?: Position
  theme?: Theme
  /** Default auto-dismiss in milliseconds. Defaults to 4000. */
  duration?: number
  /** Maximum toasts on screen; the oldest is dismissed first. Defaults to 5. */
  max?: number
  /** Pause timers while the pointer is over the stack. Defaults to `true`. */
  pauseOnHover?: boolean
  /** Element the region is appended to. Defaults to `document.body`. */
  target?: HTMLElement
  /** Accessible name of the region. Defaults to "Notifications". */
  label?: string
  /** `'expand'` lists toasts; `'collapse'` stacks them behind the newest until hovered or focused. */
  stack?: 'expand' | 'collapse'
  /** Swipe (mouse or touch) to dismiss. Defaults to `true`. */
  swipe?: boolean
}

export interface PromiseMessages<T> {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((reason: unknown) => string)
}

interface Entry {
  id: string
  el: HTMLElement
  duration: number
  remaining: number
  startedAt: number
  timer: ReturnType<typeof setTimeout> | undefined
  onDismiss: ((id: string) => void) | undefined
}

const defaults: Required<Omit<MountOptions, 'target'>> = {
  position: 'bottom-right',
  theme: 'auto',
  duration: 4000,
  max: 5,
  pauseOnHover: true,
  label: 'Notifications',
  stack: 'expand',
  swipe: true,
}

let region: HTMLElement | null = null
let settings = { ...defaults }
let paused = false
let hovering = false
let seq = 0
const entries = new Map<string, Entry>()

function ensureRegion(): HTMLElement {
  if (region) return region
  return mount()
}

/** Creates the toast region. Called automatically by the first `toast()` when you skip it. */
export function mount(options: MountOptions = {}): HTMLElement {
  if (region) {
    configure(options)
    return region
  }
  settings = { ...defaults, ...stripUndefined(options) }
  const el = document.createElement('section')
  el.className = 'tk'
  el.setAttribute('role', 'region')
  el.setAttribute('aria-label', settings.label)
  el.dataset['position'] = settings.position
  el.dataset['theme'] = settings.theme
  el.dataset['stack'] = settings.stack
  el.addEventListener('mouseenter', () => {
    hovering = true
    if (settings.pauseOnHover) pause()
  })
  el.addEventListener('mouseleave', () => {
    hovering = false
    resume()
  })
  el.addEventListener('focusin', pause)
  el.addEventListener('focusout', (e) => {
    if (!el.contains(e.relatedTarget as Node | null)) resume()
  })
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    const t = (e.target as HTMLElement).closest<HTMLElement>('.tk-toast')
    if (t?.dataset['id']) dismiss(t.dataset['id'])
  })
  ;(options.target ?? document.body).appendChild(el)
  region = el
  return el
}

/** Updates region settings at runtime: position, theme, defaults. */
export function configure(options: MountOptions): void {
  settings = { ...settings, ...stripUndefined(options) }
  if (!region) return
  region.dataset['position'] = settings.position
  region.dataset['theme'] = settings.theme
  region.dataset['stack'] = settings.stack
  region.setAttribute('aria-label', settings.label)
  if (options.target && region.parentElement !== options.target) options.target.appendChild(region)
}

/** Removes every toast and the region itself. */
export function unmount(): void {
  for (const id of [...entries.keys()]) remove(id, false)
  region?.remove()
  region = null
  settings = { ...defaults }
  paused = false
  hovering = false
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k in o) if (o[k] !== undefined) out[k] = o[k]
  return out
}

function show(title: string, options: ToastOptions = {}): string {
  const root = ensureRegion()
  const id = options.id ?? `tk-${++seq}`
  const existing = entries.get(id)
  const el = existing?.el ?? document.createElement('div')
  const kind = options.kind ?? 'default'

  el.className = `tk-toast${options.className ? ` ${options.className}` : ''}`
  el.dataset['id'] = id
  el.dataset['kind'] = kind
  el.dataset['state'] = 'open'
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite')
  el.tabIndex = 0
  el.replaceChildren(...build(id, title, options))

  if (!existing) {
    if (settings.swipe) swipeable(el, id)
    if (settings.position.startsWith('top')) root.prepend(el)
    else root.append(el)
  }

  const duration = options.duration ?? (kind === 'loading' ? Infinity : settings.duration)
  const entry: Entry = {
    id,
    el,
    duration,
    remaining: duration,
    startedAt: Date.now(),
    timer: undefined,
    onDismiss: options.onDismiss,
  }
  if (existing?.timer) clearTimeout(existing.timer)
  entries.set(id, entry)
  if (!paused) schedule(entry)
  trim()
  return id
}

function build(id: string, title: string, o: ToastOptions): Node[] {
  const nodes: Node[] = []
  const icon = document.createElement('span')
  icon.className = 'tk-icon'
  icon.setAttribute('aria-hidden', 'true')
  if (o.icon !== undefined) icon.append(o.icon)
  nodes.push(icon)

  const body = document.createElement('div')
  body.className = 'tk-body'
  if (o.content !== undefined && typeof o.content !== 'string') {
    body.append(typeof o.content === 'function' ? o.content() : o.content)
  } else {
    const t = document.createElement('div')
    t.className = 'tk-title'
    t.textContent = typeof o.content === 'string' ? o.content : title
    body.append(t)
    if (o.description) {
      const d = document.createElement('div')
      d.className = 'tk-desc'
      d.textContent = o.description
      body.append(d)
    }
  }
  nodes.push(body)

  if (o.action) {
    const { label, onClick, keepOpen } = o.action
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tk-action'
    b.textContent = label
    b.addEventListener('click', (e) => {
      onClick(e)
      if (!keepOpen) dismiss(id)
    })
    nodes.push(b)
  }

  if (o.dismissible !== false) {
    const c = document.createElement('button')
    c.type = 'button'
    c.className = 'tk-close'
    c.setAttribute('aria-label', 'Dismiss')
    c.textContent = '×'
    c.addEventListener('click', () => dismiss(id))
    nodes.push(c)
  }
  return nodes
}

function swipeable(el: HTMLElement, id: string): void {
  let startX = 0
  let dx = 0
  let active = false
  const width = (): number => el.offsetWidth || 320
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    active = true
    startX = e.clientX
    dx = 0
    el.dataset['swiping'] = ''
    el.setPointerCapture?.(e.pointerId)
    pause()
  })
  el.addEventListener('pointermove', (e) => {
    if (!active) return
    dx = e.clientX - startX
    el.style.transform = `translateX(${dx}px)`
    el.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / width()))
  })
  const end = (): void => {
    if (!active) return
    active = false
    delete el.dataset['swiping']
    if (Math.abs(dx) > width() * 0.4) {
      el.style.setProperty('--tk-out', `translateX(${dx * 2}px)`)
      dismiss(id)
      return
    }
    el.style.transform = ''
    el.style.opacity = ''
    if (!hovering) resume()
  }
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

function schedule(entry: Entry): void {
  if (!Number.isFinite(entry.remaining)) return
  entry.startedAt = Date.now()
  entry.timer = setTimeout(() => dismiss(entry.id), entry.remaining)
}

function pause(): void {
  if (paused) return
  paused = true
  for (const e of entries.values()) {
    if (!e.timer) continue
    clearTimeout(e.timer)
    e.timer = undefined
    e.remaining = Math.max(0, e.remaining - (Date.now() - e.startedAt))
  }
}

function resume(): void {
  if (!paused || (hovering && settings.pauseOnHover)) return
  paused = false
  for (const e of entries.values()) if (!e.timer) schedule(e)
}

function trim(): void {
  const over = entries.size - settings.max
  if (over <= 0) return
  const oldest = [...entries.keys()].slice(0, over)
  for (const id of oldest) dismiss(id)
}

/** Dismisses one toast, or every toast when called without an id. */
export function dismiss(id?: string): void {
  if (id === undefined) {
    for (const key of [...entries.keys()]) dismiss(key)
    return
  }
  const entry = entries.get(id)
  if (!entry || entry.el.dataset['state'] === 'closing') return
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = undefined
  entry.el.dataset['state'] = 'closing'
  const finish = (): void => remove(id, true)
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) finish()
  else {
    entry.el.addEventListener('animationend', finish, { once: true })
    setTimeout(finish, 300)
  }
}

function remove(id: string, notify: boolean): void {
  const entry = entries.get(id)
  if (!entry) return
  entries.delete(id)
  entry.el.remove()
  if (notify) entry.onDismiss?.(id)
}

function update(id: string, options: ToastOptions & { title?: string }): void {
  const entry = entries.get(id)
  if (!entry) return
  const title = options.title ?? entry.el.querySelector('.tk-title')?.textContent ?? ''
  show(title, { ...options, id })
}

async function promise<T>(p: Promise<T>, m: PromiseMessages<T>, options: ToastOptions = {}): Promise<T> {
  const id = show(m.loading, { ...options, kind: 'loading', duration: Infinity })
  try {
    const value = await p
    update(id, { ...options, title: typeof m.success === 'function' ? m.success(value) : m.success, kind: 'success' })
    return value
  } catch (reason) {
    update(id, { ...options, title: typeof m.error === 'function' ? m.error(reason) : m.error, kind: 'error' })
    throw reason
  }
}

type ToastFn = ((title: string, options?: ToastOptions) => string) & {
  success: (title: string, options?: ToastOptions) => string
  error: (title: string, options?: ToastOptions) => string
  info: (title: string, options?: ToastOptions) => string
  warning: (title: string, options?: ToastOptions) => string
  loading: (title: string, options?: ToastOptions) => string
  promise: typeof promise
  update: typeof update
  dismiss: typeof dismiss
}

const kindFn =
  (kind: Kind) =>
  (title: string, options: ToastOptions = {}): string =>
    show(title, { ...options, kind })

/** Shows a toast and returns its id. Mounts the region with defaults on first use. */
export const toast: ToastFn = Object.assign(
  (title: string, options: ToastOptions = {}): string => show(title, options),
  {
    success: kindFn('success'),
    error: kindFn('error'),
    info: kindFn('info'),
    warning: kindFn('warning'),
    loading: kindFn('loading'),
    promise,
    update,
    dismiss,
  },
)

export default toast
