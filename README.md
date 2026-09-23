# toastkit

Sonner-style toasts for vanilla JavaScript. CSS is the API.

![toastkit demo: variants, promise toast, undo action, positions, themes, collapsed stack, swipe to dismiss and live CSS editing](/docs/promo.gif)

- `toast()`, `toast.promise()`, action buttons, a capped stack that can collapse behind the newest toast, swipe to dismiss, pause on hover — the API you know from sonner, without React.
- Not one line of CSS is injected from JavaScript. The whole look is one stylesheet of `--tk-*` custom properties. Your theme is a CSS file, not a config object.
- Accessible by default: a labelled region, `role="status"` / `role="alert"` with the matching `aria-live`, real buttons, Escape to dismiss, `prefers-reduced-motion` respected.
- Zero runtime dependencies. ESM, TypeScript types included. 2.7 KB JS + 1.8 KB CSS gzipped, and the build fails if that grows past 3 KB + 2 KB.

Demo and live CSS editor: https://nmrcs.github.io/toastkit/

## Install

```sh
npm i @mrcs/toastkit
```

```js
import { toast } from '@mrcs/toastkit'
import '@mrcs/toastkit/toastkit.css'

toast('Changes saved')
```

Without a bundler, load the two files from your own server or a CDN that mirrors npm:

```html
<link rel="stylesheet" href="/vendor/toastkit.css" />
<script type="module">
  import { toast } from '/vendor/toastkit.js'
  toast('Changes saved')
</script>
```

## Usage

```js
import { mount, toast } from '@mrcs/toastkit'

// Optional. The first toast() mounts a region with these defaults anyway.
mount({ position: 'bottom-right', theme: 'auto', duration: 4000, max: 5 })

toast('Invoice sent', { description: 'Customer will receive it within a minute.' })
toast.success('Payment confirmed')
toast.error('Could not connect')
toast.warning('Storage almost full')
toast.info('New version available')

// Loading → success or error, resolves or rejects with the original promise.
await toast.promise(upload(file), {
  loading: 'Uploading…',
  success: (name) => `Uploaded ${name}`,
  error: (e) => `Upload failed: ${e.message}`,
})

// Action button. The toast closes after the click unless `keepOpen: true`.
toast('Message deleted', { action: { label: 'Undo', onClick: () => restore() } })

// Stays until dismissed.
toast.info('Stays until you close it', { duration: Infinity })

// Your own content: an element or a function returning one.
toast('', { content: buildElement() })

const id = toast.loading('Working…')
toast.update(id, { title: 'Done', kind: 'success' })
toast.dismiss(id) // or toast.dismiss() for all
```

## API

### `mount(options?)`

Creates the toast region once. Called automatically by the first `toast()` if you skip it. Returns the region element.

| Option         | Type                                                                                                       | Default            |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| `position`     | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'`         | `'bottom-right'`   |
| `theme`        | `'light' \| 'dark' \| 'auto'` or any string you style yourself                                             | `'auto'`           |
| `duration`     | default auto-dismiss in ms                                                                                 | `4000`             |
| `max`          | toasts on screen; the oldest is dismissed first                                                            | `5`                |
| `pauseOnHover` | pause timers while the pointer or focus is inside the stack                                                | `true`             |
| `target`       | element the region is appended to                                                                          | `document.body`    |
| `label`        | accessible name of the region                                                                              | `'Notifications'`  |
| `stack`        | `'expand'` lists toasts, `'collapse'` stacks them behind the newest until hovered or focused               | `'expand'`         |
| `swipe`        | drag a toast sideways (mouse or touch) to dismiss it                                                        | `true`             |

`configure(options)` changes any of these at runtime. `unmount()` removes everything.

### `toast(title, options?)` → `id`

Also `toast.success`, `toast.error`, `toast.info`, `toast.warning`, `toast.loading` (no auto-dismiss).

| Option        | Type                                                      | Notes                                                      |
| ------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| `id`          | `string`                                                  | reuse an id to update a toast in place                     |
| `description` | `string`                                                  | second line, muted                                         |
| `duration`    | `number`                                                  | ms, `Infinity` to keep                                     |
| `action`      | `{ label, onClick, keepOpen? }`                           | rendered as a `<button>`                                   |
| `dismissible` | `boolean`                                                 | close button, default `true`                               |
| `onDismiss`   | `(id) => void`                                            | after the toast is gone                                    |
| `className`   | `string`                                                  | extra class on the toast element                           |
| `content`     | `string \| HTMLElement \| () => HTMLElement`              | replaces the title/description block                       |

Strings are rendered through `textContent`, never as HTML. Use `content` with an element when you need markup.

### `toast.promise(promise, messages, options?)`

`messages` is `{ loading, success, error }`; `success` and `error` may be functions of the resolved value or the rejection reason. Returns the same promise (resolves or rejects like the original).

### `toast.update(id, options)`, `toast.dismiss(id?)`

`update` accepts every toast option plus `title`. `dismiss()` without an id closes all.

## CSS is the API

The library never touches styles. `toastkit.css` declares every visual decision as a custom property on `.tk`:

```css
.tk {
  --tk-bg: #fff;
  --tk-fg: #111;
  --tk-muted: #666;
  --tk-border: #e4e4e4;
  --tk-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  --tk-radius: 10px;
  --tk-width: 356px;
  --tk-gap: 10px;
  --tk-inset: 16px;
  --tk-font: system-ui, -apple-system, "Segoe UI", sans-serif;
  --tk-size: 14px;
  --tk-success: #16a34a;
  --tk-error: #dc2626;
  --tk-warning: #d97706;
  --tk-info: #2563eb;
  --tk-accent: var(--tk-fg);
  --tk-action-bg: var(--tk-fg);
  --tk-action-fg: var(--tk-bg);
  --tk-z: 9999;
  --tk-duration: 0.25s;
  --tk-exit: 0.15s;
  --tk-stack-offset: 10px;
  --tk-stack-scale: 0.05;
}
```

Override them anywhere after the stylesheet, or define a theme of your own — the library only writes the name into `data-theme`:

```css
.tk[data-theme="brand"] {
  --tk-bg: #1b1f3a;
  --tk-fg: #fff;
  --tk-radius: 4px;
}
```

```js
mount({ theme: 'brand' })
```

Hooks for deeper changes: `.tk` (region, `data-position`, `data-theme`, `data-stack`), `.tk-toast` (`data-kind`, `data-state="open|closing"`, `data-swiping` while dragged), `.tk-icon`, `.tk-body`, `.tk-title`, `.tk-desc`, `.tk-action`, `.tk-close`. Animations are `tk-in`, `tk-out` and `tk-spin`; a swiped-away toast leaves along its drag direction through `--tk-out`. `prefers-reduced-motion: reduce` turns all of it off.

The collapsed stack is CSS only: with `stack: 'collapse'` the region becomes a grid, the two toasts behind the newest are scaled and offset, older ones are hidden, and hover or focus expands the list. Tune it with `--tk-stack-offset` and `--tk-stack-scale`.

## Frameworks

The core is imperative, so no adapter is needed. Mount once, call `toast()` from anywhere.

```jsx
// React
import { useEffect } from 'react'
import { mount, toast } from '@mrcs/toastkit'
import '@mrcs/toastkit/toastkit.css'

export function App() {
  useEffect(() => mount({ position: 'top-right' }), [])
  return <button onClick={() => toast.success('Saved')}>Save</button>
}
```

```vue
<!-- Vue -->
<script setup>
import { onMounted } from 'vue'
import { mount, toast } from '@mrcs/toastkit'
import '@mrcs/toastkit/toastkit.css'
onMounted(() => mount())
</script>
<template><button @click="toast.success('Saved')">Save</button></template>
```

```astro
---
// Astro: a client script on any page
---
<script>
  import { toast } from '@mrcs/toastkit'
  import '@mrcs/toastkit/toastkit.css'
  document.querySelector('#save')?.addEventListener('click', () => toast.success('Saved'))
</script>
```

## Accessibility

- The region is a `<section role="region" aria-label="Notifications">`.
- Each toast is `role="status"` with `aria-live="polite"`; errors are `role="alert"` with `aria-live="assertive"`.
- Action and close are real `<button>`s. Toasts are focusable; Escape dismisses the focused one; timers pause while focus is inside the stack.
- `prefers-reduced-motion: reduce` removes the enter and exit animations.

## Where it sits

Vanilla toast libraries stopped moving around 2021–2022, and everything that evolved since is a port of sonner to one framework or another. toastkit is the sonner-style API for the rest of the web: plain scripts, Web Components, Astro islands, HTMX, or a React app that does not want a second toast stack.

| Library     | Last release | Framework | Runtime deps | Size, gzip |
| ----------- | ------------ | --------- | ------------ | ------- |
| **toastkit** | **2026**    | **none**  | **0**        | **2.7 KB JS + 1.8 KB CSS, gzip** |
| toastify-js | 2022-07      | none      | 0            | 2.1 KB  |
| notyf       | 2021-06      | none      | 0            | 27.5 KB |
| notiflix    | 2025-01      | none      | 0            | 16.5 KB |
| sonner      | 2026-08      | React     | 0 (+React)   | 9.4 KB  |

Figures from the npm registry and bundlephobia on 2026-09-23.

## Development

```sh
npm ci
npm run dev     # tsc --watch, copies into demo/, serves http://localhost:4323/
npm run build   # tsc → dist/, stylesheet and demo copies
npm run size    # gzip budget: 3000 B JS, 2000 B CSS
npm test        # vitest + jsdom
npm run check   # build + size + test, what CI runs
```

`demo/` is a static page served by `npm run dev`; any static server works too. It is deployed to GitHub Pages on every push to `main`.

## Author and license

Built solo by Nikita MRCS — [@nmrcs](https://github.com/nmrcs). Every design
decision, every number and every mistake in this repository is mine.

MIT.
