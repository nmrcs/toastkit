import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, dismiss, mount, toast, unmount } from '../src/index'

const region = (): HTMLElement => document.querySelector('.tk') as HTMLElement
const toasts = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.tk-toast')]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  unmount()
  vi.useRealTimers()
})

describe('region', () => {
  it('mounts once with defaults and accessible name', () => {
    mount()
    mount({ position: 'top-left' })
    expect(document.querySelectorAll('.tk')).toHaveLength(1)
    expect(region().getAttribute('role')).toBe('region')
    expect(region().getAttribute('aria-label')).toBe('Notifications')
    expect(region().dataset['position']).toBe('top-left')
  })

  it('mounts automatically on the first toast', () => {
    toast('Hello')
    expect(region()).not.toBeNull()
    expect(toasts()).toHaveLength(1)
  })

  it('accepts any theme string and reflects it as data-theme', () => {
    mount({ theme: 'mono' })
    expect(region().dataset['theme']).toBe('mono')
    configure({ theme: 'dark', position: 'bottom-center' })
    expect(region().dataset['theme']).toBe('dark')
    expect(region().dataset['position']).toBe('bottom-center')
  })
})

describe('toast', () => {
  it('renders text through textContent, never as HTML', () => {
    toast('<b>bold</b>', { description: '<i>x</i>' })
    expect(toasts()[0]!.querySelector('.tk-title')!.textContent).toBe('<b>bold</b>')
    expect(toasts()[0]!.querySelector('b')).toBeNull()
    expect(toasts()[0]!.querySelector('.tk-desc')!.textContent).toBe('<i>x</i>')
  })

  it('uses status/polite by default and alert/assertive for errors', () => {
    toast('ok')
    toast.error('bad')
    const [a, b] = toasts()
    expect(a!.getAttribute('role')).toBe('status')
    expect(a!.getAttribute('aria-live')).toBe('polite')
    expect(b!.getAttribute('role')).toBe('alert')
    expect(b!.getAttribute('aria-live')).toBe('assertive')
    expect(b!.dataset['kind']).toBe('error')
  })

  it('auto-dismisses after the duration and calls onDismiss', () => {
    const onDismiss = vi.fn()
    const id = toast('bye', { duration: 1000, onDismiss })
    vi.advanceTimersByTime(999)
    expect(toasts()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts()[0]!.dataset['state']).toBe('closing')
    vi.advanceTimersByTime(300)
    expect(toasts()).toHaveLength(0)
    expect(onDismiss).toHaveBeenCalledWith(id)
  })

  it('keeps loading toasts until dismissed', () => {
    toast.loading('wait')
    vi.advanceTimersByTime(60_000)
    expect(toasts()).toHaveLength(1)
    dismiss()
    vi.advanceTimersByTime(400)
    expect(toasts()).toHaveLength(0)
  })

  it('pauses timers while hovered', () => {
    toast('hover', { duration: 1000 })
    region().dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(5000)
    expect(toasts()).toHaveLength(1)
    region().dispatchEvent(new Event('mouseleave'))
    vi.advanceTimersByTime(1000 + 400)
    expect(toasts()).toHaveLength(0)
  })

  it('dismisses the oldest toast above max', () => {
    mount({ max: 2 })
    toast('1')
    toast('2')
    toast('3')
    vi.advanceTimersByTime(400)
    expect(toasts().map((t) => t.textContent)).toEqual(['2×', '3×'])
  })

  it('prepends at top positions and appends at bottom positions', () => {
    mount({ position: 'top-right' })
    toast('first')
    toast('second')
    expect(toasts()[0]!.textContent).toContain('second')
    unmount()
    mount({ position: 'bottom-right' })
    toast('first')
    toast('second')
    expect(toasts()[0]!.textContent).toContain('first')
  })

  it('runs the action and dismisses unless keepOpen', () => {
    const onClick = vi.fn()
    toast('deleted', { action: { label: 'Undo', onClick } })
    const button = document.querySelector<HTMLButtonElement>('.tk-action')!
    expect(button.textContent).toBe('Undo')
    button.click()
    expect(onClick).toHaveBeenCalledOnce()
    expect(toasts()[0]!.dataset['state']).toBe('closing')
  })

  it('dismisses on Escape from a focused toast and hides the close button when not dismissible', () => {
    toast('esc')
    toast('stay', { dismissible: false })
    const [a, b] = toasts()
    expect(b!.querySelector('.tk-close')).toBeNull()
    a!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(a!.dataset['state']).toBe('closing')
  })

  it('renders custom element content', () => {
    const el = document.createElement('strong')
    el.textContent = 'custom'
    toast('ignored', { content: el })
    expect(toasts()[0]!.querySelector('.tk-body strong')!.textContent).toBe('custom')
    expect(toasts()[0]!.querySelector('.tk-title')).toBeNull()
  })

  it('puts a custom icon into the icon slot', () => {
    toast('hi', { icon: '👋' })
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement
    toast.success('done', { icon: svg })
    const [a, b] = toasts()
    expect(a!.querySelector('.tk-icon')!.textContent).toBe('👋')
    expect(b!.querySelector('.tk-icon svg')).not.toBeNull()
    expect(b!.dataset['kind']).toBe('success')
  })

  it('updates a toast in place by id', () => {
    const id = toast('one', { id: 'fixed' })
    expect(id).toBe('fixed')
    toast.update('fixed', { title: 'two', kind: 'success' })
    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]!.querySelector('.tk-title')!.textContent).toBe('two')
    expect(toasts()[0]!.dataset['kind']).toBe('success')
  })
})

describe('swipe', () => {
  const pointer = (el: HTMLElement, type: string, clientX: number): void => {
    const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent
    el.dispatchEvent(new Ctor(type, { clientX, button: 0, bubbles: true }))
  }

  it('dismisses after a long horizontal drag and keeps the direction', () => {
    toast('drag me')
    const el = toasts()[0]!
    pointer(el, 'pointerdown', 10)
    pointer(el, 'pointermove', 210)
    expect(el.style.transform).toBe('translateX(200px)')
    pointer(el, 'pointerup', 210)
    expect(el.dataset['state']).toBe('closing')
    expect(el.style.getPropertyValue('--tk-out')).toBe('translateX(400px)')
  })

  it('snaps back after a short drag and resumes the timer', () => {
    toast('stay', { duration: 1000 })
    const el = toasts()[0]!
    pointer(el, 'pointerdown', 10)
    pointer(el, 'pointermove', 30)
    vi.advanceTimersByTime(5000)
    expect(toasts()).toHaveLength(1)
    pointer(el, 'pointerup', 30)
    expect(el.style.transform).toBe('')
    vi.advanceTimersByTime(1000 + 300)
    expect(toasts()).toHaveLength(0)
  })

  it('ignores drags that start on a button and can be disabled', () => {
    toast('btn', { action: { label: 'Undo', onClick: () => {} } })
    const button = document.querySelector<HTMLElement>('.tk-action')!
    pointer(button, 'pointerdown', 10)
    pointer(button, 'pointermove', 300)
    expect(toasts()[0]!.style.transform).toBe('')
    unmount()
    mount({ swipe: false })
    toast('no swipe')
    const el = toasts()[0]!
    pointer(el, 'pointerdown', 10)
    pointer(el, 'pointermove', 300)
    expect(el.style.transform).toBe('')
  })

  it('reflects the stack mode on the region', () => {
    mount({ stack: 'collapse' })
    expect(region().dataset['stack']).toBe('collapse')
    configure({ stack: 'expand' })
    expect(region().dataset['stack']).toBe('expand')
  })
})

describe('toast.promise', () => {
  it('goes loading → success and resolves with the value', async () => {
    const p = toast.promise(Promise.resolve(42), {
      loading: 'Saving…',
      success: (v) => `Saved ${v}`,
      error: 'Failed',
    })
    expect(toasts()[0]!.dataset['kind']).toBe('loading')
    await expect(p).resolves.toBe(42)
    expect(toasts()[0]!.dataset['kind']).toBe('success')
    expect(toasts()[0]!.querySelector('.tk-title')!.textContent).toBe('Saved 42')
  })

  it('goes loading → error and rethrows', async () => {
    const p = toast.promise(Promise.reject(new Error('nope')), {
      loading: 'Saving…',
      success: 'Saved',
      error: (e) => `Failed: ${(e as Error).message}`,
    })
    await expect(p).rejects.toThrow('nope')
    expect(toasts()[0]!.dataset['kind']).toBe('error')
    expect(toasts()[0]!.querySelector('.tk-title')!.textContent).toBe('Failed: nope')
  })
})
