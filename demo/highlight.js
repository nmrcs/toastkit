// A tiny highlighter for the demo: enough for the snippets on this page,
// no dependency. Returns HTML with <span class="t-…"> tokens.
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const grammars = {
  js: {
    re: /(\/\/.*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(const|let|var|function|return|import|from|export|await|async|new|if|else|throw|try|catch|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()|([{}()[\],;.=>:])/g,
    classes: ['t-com', 't-str', 't-kw', 't-num', 't-fn', 't-pun'],
  },
  css: {
    re: /(\/\*[\s\S]*?\*\/)|(--[\w-]+|[a-z-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?(?:px|em|rem|s|ms|%)?\b)|([.#]?[\w-]+(?:\[[^\]]*\])?)(?=\s*\{)|([{}:;,()])/g,
    classes: ['t-com', 't-prop', 't-num', 't-str', 't-num', 't-sel', 't-pun'],
  },
}

export function highlight(code, lang) {
  const { re, classes } = grammars[lang]
  let out = ''
  let last = 0
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index))
    const i = m.slice(1).findIndex((g) => g !== undefined)
    out += `<span class="${classes[i]}">${esc(m[0])}</span>`
    last = m.index + m[0].length
  }
  return out + esc(code.slice(last))
}
