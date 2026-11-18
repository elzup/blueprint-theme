// プレビューの描画。データは gen-preview.ts が #pv-data に埋め込む。DOM は textContent だけで組む
const DATA = JSON.parse(document.getElementById('pv-data').textContent)
const DAY_KEYS = ['none', ...DATA.days.map((d) => d.key)]

const params = new URLSearchParams(location.search)
const state = {
  scheme: params.get('scheme') ?? 'a',
  palette: params.get('palette') ?? 'blueprint',
  appearance: params.get('appearance') ?? 'dark',
  day: params.get('day') ?? DATA.days[new Date().getDay()].key,
}

// 1 行 = [種類, 文字列] の列。種類は preview.css の .t-* (k=keyword s=string n=number t=type f=function
// v=variable p=property o=operator u=punctuation g=tag a=attribute c=comment x=invalid _=素の文字)
const CODE = [
  [['c', '// 1 週間の平均値を出す']],
  [['k', 'import'], ['u', ' { '], ['v', 'readFile'], ['u', ' } '], ['k', 'from'], ['_', ' '], ['s', "'node:fs/promises'"]],
  [],
  [['k', 'export type'], ['_', ' '], ['t', 'Row'], ['o', ' = '], ['u', '{ '], ['p', 'day'], ['u', ': '], ['t', 'number'], ['u', '; '], ['p', 'value'], ['u', ': '], ['t', 'number'], ['u', ' }']],
  [['k', 'const'], ['_', ' '], ['v', 'LIMIT'], ['o', ' = '], ['n', '7'], ['_', '  '], ['c', '// 曜日の数']],
  [],
  [['k', 'export async function'], ['_', ' '], ['f', 'average'], ['u', '('], ['v', 'rows'], ['u', ': '], ['t', 'Row'], ['u', '[]): '], ['t', 'Promise'], ['u', '<'], ['t', 'number'], ['u', '> {']],
  [['_', '  '], ['k', 'if'], ['u', ' ('], ['v', 'rows'], ['u', '.'], ['p', 'length'], ['o', ' === '], ['n', '0'], ['u', ') '], ['k', 'throw new'], ['_', ' '], ['t', 'Error'], ['u', '('], ['s', "'empty'"], ['u', ')']],
  [['_', '  '], ['k', 'const'], ['_', ' '], ['v', 'total'], ['o', ' = '], ['v', 'rows'], ['u', '.'], ['f', 'reduce'], ['u', '(('], ['v', 'sum'], ['u', ', '], ['v', 'r'], ['u', ') '], ['o', '=>'], ['_', ' '], ['v', 'sum'], ['o', ' + '], ['v', 'r'], ['u', '.'], ['p', 'value'], ['u', ', '], ['n', '0'], ['u', ')']],
  [['_', '  '], ['k', 'return'], ['_', ' '], ['v', 'total'], ['o', ' / '], ['t', 'Math'], ['u', '.'], ['f', 'min'], ['u', '('], ['v', 'rows'], ['u', '.'], ['p', 'length'], ['u', ', '], ['v', 'LIMIT'], ['u', ')']],
  [['u', '}']],
  [],
  [['k', 'const'], ['_', ' '], ['v', 'badge'], ['o', ' = '], ['u', '<'], ['g', 'Badge'], ['_', ' '], ['a', 'tone'], ['o', '='], ['s', '"ok"'], ['_', ' '], ['a', 'count'], ['o', '='], ['u', '{'], ['n', '3'], ['u', '} />']],
  [['v', 'broken'], ['_', ' '], ['x', '@@'], ['_', ' '], ['c', '// invalid']],
]
const CURRENT_LINE = 9
const SELECTED = { line: 10, from: 2, to: 4 } // 10 行目の「total / Math」付近を選択中に見せる

const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k === 'style') Object.entries(v).forEach(([p, val]) => el.style.setProperty(p, val))
    else el.setAttribute(k, v)
  })
  children.forEach((c) => el.append(c))
  return el
}

const variantOf = (day) => DATA.variants[[state.scheme, state.palette, state.appearance, day].join('|')]
const LEVEL_CLASS = { ok: 'status--match', warn: 'status--partial', bad: 'status--gap' }
const LEVEL_TEXT = { ok: 'OK', warn: '近い', bad: '衝突' }
const statusChip = (level, text = LEVEL_TEXT[level]) => h('span', { class: `status ${LEVEL_CLASS[level]}`, text })

const scope = (v, extraClass) => h('div', { class: `pv-scope ${extraClass}`, style: v.vars })

const codeBlock = (withCursor) =>
  h('pre', { class: 'pv-code' }, CODE.map((tokens, i) => {
    const n = i + 1
    const line = h('span', { class: `pv-line${withCursor && n === CURRENT_LINE ? ' is-current' : ''}`, 'data-n': String(n) })
    tokens.forEach(([kind, text], ti) => {
      const span = h('span', { class: `t-${kind}`, text })
      const isSelected = withCursor && n === SELECTED.line && ti >= SELECTED.from && ti <= SELECTED.to
      line.append(isSelected ? h('span', { class: 'pv-sel' }, [span]) : span)
    })
    if (withCursor && n === CURRENT_LINE) line.append(h('span', { class: 'pv-cursor' }))
    line.append('\n')
    return line
  }))

// ---- 1. 色見本
const swatch = (name, color, note, textColor) =>
  h('div', { class: 'pv-swatch' }, [
    h('div', { class: 'pv-swatch__chip', style: { background: color, color: textColor }, text: 'Aa' }),
    h('div', { class: 'pv-swatch__meta' }, [h('b', { text: name }), h('span', { text: `${color}${note ? ` · ${note}` : ''}` })]),
  ])

const renderSwatches = () => {
  const box = document.getElementById('pv-swatches')
  const sw = DATA.swatches[[state.scheme, state.palette, state.appearance].join('|')]
  box.replaceChildren(...sw.groups.map((g) =>
    h('div', { class: 'pv-swatch-group' }, [
      h('h3', { text: `${g.title} (${g.items.length})` }),
      h('div', { class: 'pv-swatches' }, g.items.map((it) => swatch(it.name, it.color, it.note, it.on))),
    ])))
}

// ---- 2. 曜日見本帳
const SPEC_CODE = CODE.slice(6, 11)

const specSection = (label, children) =>
  h('div', { class: 'pv-spec__sec' }, [h('div', { class: 'pv-spec__label', text: label }), ...children])

const specCode = () =>
  h('pre', { class: 'pv-code' }, SPEC_CODE.map((tokens, i) => {
    const isCurrent = i === 2
    const line = h('span', { class: `pv-line${isCurrent ? ' is-current' : ''}`, 'data-n': String(i + 7) })
    tokens.forEach(([kind, text], ti) => {
      const span = h('span', { class: `t-${kind}`, text })
      line.append(i === 3 && ti >= 2 && ti <= 4 ? h('span', { class: 'pv-sel' }, [span]) : span)
    })
    if (isCurrent) line.append(h('span', { class: 'pv-cursor' }))
    line.append('\n')
    return line
  }))

const specDiff = () =>
  h('pre', { class: 'pv-diff' }, [
    h('span', { class: 'is-hunk', text: '@@ -12,3 +12,4 @@ export function average' }),
    h('span', { text: '   const total = rows.reduce(sum, 0)' }),
    h('span', { class: 'is-del', text: '-  return total / rows.length' }),
    h('span', { class: 'is-add', text: '+  if (rows.length === 0) return 0' }),
    h('span', { class: 'is-add', text: '+  return total / Math.min(rows.length, LIMIT)' }),
  ])

const specTerminal = (v) => {
  const a = v.ansi
  const line = (parts) => h('div', {}, parts.map(([text, color]) => h('span', { text, style: color ? { color } : {} })))
  return h('pre', { class: 'pv-term' }, [
    line([['~/week-theme ', a[4]], ['(main) ', a[5]], ['$ nr test', null]]),
    line([[' ✓ ', a[2]], ['12 passed', a[2]], ['  ✗ ', a[1]], ['1 failed', a[1]], ['  ⚠ ', a[3]], ['1 obsolete', a[3]]]),
    h('div', {}, [ansiRow(a.slice(0, 8))]),
  ])
}

const chip = (text, color) => h('span', { class: 'pv-chip', text, style: { color } })

const specUi = () => [
  h('div', { class: 'pv-mini-tabs' }, [h('span', { class: 'is-on', text: 'Overview' }), h('span', { text: 'Changes' }), h('span', { text: 'Settings' })]),
  h('div', { class: 'pv-row', style: { 'margin-top': '10px' } }, [
    h('button', { class: 'pv-btn', type: 'button', text: 'Save' }),
    h('button', { class: 'pv-btn is-hover', type: 'button', text: 'hover' }),
    h('button', { class: 'pv-btn pv-btn--2', type: 'button', text: 'Cancel' }),
    h('span', { class: 'pv-link', text: 'リンク' }),
    h('span', { class: 'pv-badge', text: '3' }),
  ]),
  h('div', { class: 'pv-row' }, [
    h('span', { class: 'pv-toggle' }), h('span', { class: 'pv-toggle is-off' }),
    h('span', { class: 'pv-check', text: '✓' }), h('span', { class: 'pv-radio' }),
    h('span', { class: 'pv-progress' }, [h('i')]),
  ]),
  h('div', { class: 'pv-row' }, [
    h('input', { class: 'pv-input is-focus', value: 'focus 中', 'aria-label': 'focus の見本', style: { width: '100px' } }),
    chip('一致', 'var(--m-green)'), chip('注意', 'var(--m-orange)'), chip('失敗', 'var(--m-red)'), chip('要確認', 'var(--m-violet)'),
  ]),
]

const alert = (text, color, bg) => h('div', { class: 'pv-alert', text, style: { color, background: bg } })

const specAlerts = () =>
  h('div', { class: 'pv-alerts' }, [
    alert('✓ 保存しました (success)', 'var(--m-green)', 'var(--m-green-dim)'),
    alert('⚠ 未保存の変更があります (warning)', 'var(--m-orange)', 'var(--m-orange-dim)'),
    alert('✕ ビルドに失敗しました (danger)', 'var(--m-red)', 'var(--m-red-dim)'),
    alert('? 仕様の確認が必要です (notice)', 'var(--m-violet)', 'var(--m-violet-dim)'),
  ])

const specReport = () => {
  const row = (cells, cls = '') => h('tr', { class: cls }, cells.map((c) => h('td', {}, [c])))
  return h('div', {}, [
    h('div', { style: { 'margin-bottom': '6px', color: 'var(--m-text)', 'font-weight': '700' } }, [h('span', { class: 'pv-num-badge', text: '01' }), 'API 仕様との差分']),
    h('table', { class: 'pv-rtable' }, [
      h('thead', {}, [h('tr', {}, ['項目', '状態', '件数'].map((t) => h('th', { text: t })))]),
      h('tbody', {}, [
        row(['/users', chip('一致', 'var(--m-green)'), '12']),
        row(['/orders', chip('注意', 'var(--m-orange)'), '3'], 'is-hl'),
        row(['/payments', chip('失敗', 'var(--m-red)'), '1']),
        row(['/legacy', chip('要確認', 'var(--m-violet)'), '—']),
      ]),
    ]),
  ])
}

const specimen = (key) => {
  const v = variantOf(key)
  const d = v.day
  const card = scope(v, `pv-spec${key === state.day ? ' is-on' : ''}`)
  const head = h('div', { class: 'pv-spec__head', role: 'button', tabindex: '0' }, [
    h('div', { class: 'pv-spec__kanji', text: d ? d.ja : '—' }),
    h('div', { class: 'pv-spec__name', text: d ? `${d.label} · ${d.motif}` : '曜日なし (元の accent)' }),
    statusChip(v.audit.level),
    h('div', { class: 'pv-spec__sub', text: `accent ${v.accent} · keyword ${v.keyword}` }),
  ])
  const select = () => { state.day = key; update() }
  head.addEventListener('click', select)
  head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') select() })
  card.append(
    head,
    specSection('CODE', [specCode()]),
    specSection('DIFF', [specDiff()]),
    specSection('TERMINAL', [specTerminal(v)]),
    specSection('UI', specUi()),
    specSection('ALERT', [specAlerts()]),
    specSection('REPORT', [specReport()]),
  )
  return card
}

const renderDays = () => {
  document.getElementById('pv-days').replaceChildren(...DAY_KEYS.map(specimen))
}

// ---- 3. エディタ全体
const FILES = [
  { name: 'src/', cls: '', mark: '', color: 'var(--m-dim)' },
  { name: '  average.ts', cls: 'is-sel', mark: '', color: 'var(--m-text)' },
  { name: '  tokens.ts', cls: 'is-hover', mark: 'M', color: 'var(--m-orange)' },
  { name: '  week.ts', cls: '', mark: 'U', color: 'var(--m-green)' },
  { name: '  legacy.ts', cls: '', mark: 'D', color: 'var(--m-red)' },
  { name: '  merge.ts', cls: '', mark: '!', color: 'var(--m-violet)' },
]

const ansiRow = (colors) => h('span', {}, colors.map((c) => h('span', { class: 'pv-ansi', style: { background: c } })))

const terminal = (v) => {
  const a = v.ansi
  const line = (parts) => h('div', {}, parts.map(([text, color]) => h('span', { text, style: color ? { color } : {} })))
  return h('pre', { class: 'pv-term' }, [
    line([['$ ', a[2]], ['nr test', null]]),
    line([[' ✓ ', a[2]], ['week.test.ts (12)', null]]),
    line([[' ✗ ', a[1]], ['average.test.ts > empty rows', a[1]]]),
    line([[' ⚠ ', a[3]], ['1 snapshot obsolete', a[3]]]),
    line([[' info ', a[4]], ['coverage → ', null], ['dist/coverage', a[6]], ['  ', null], ['(watch)', a[5]]]),
    h('div', {}, [ansiRow(a.slice(0, 8))]),
    h('div', {}, [ansiRow(a.slice(8))]),
  ])
}

const widgets = () =>
  h('div', { class: 'pv-widgets' }, [
    h('button', { class: 'pv-btn', type: 'button', text: 'Commit' }),
    h('button', { class: 'pv-btn is-hover', type: 'button', text: 'Commit (hover)' }),
    h('button', { class: 'pv-btn pv-btn--2', type: 'button', text: 'Cancel' }),
    h('button', { class: 'pv-btn pv-btn--2 is-hover', type: 'button', text: 'Cancel (hover)' }),
    h('input', { class: 'pv-input is-focus', value: 'focus 中の入力欄', 'aria-label': 'focus の見本' }),
    h('span', { class: 'pv-diag', text: 'error', style: { color: 'var(--m-red)', background: 'var(--m-red-dim)' } }),
    h('span', { class: 'pv-diag', text: 'warning', style: { color: 'var(--m-orange)', background: 'var(--m-orange-dim)' } }),
    h('span', { class: 'pv-diag', text: 'added', style: { color: 'var(--m-green)', background: 'var(--m-green-dim)' } }),
  ])

const renderMock = () => {
  const v = variantOf(state.day)
  const box = document.getElementById('pv-mock')
  const mock = scope(v, 'pv-mock')
  mock.append(
    h('div', { class: 'pv-titlebar' }, [h('i'), h('i'), h('i'), h('span', { text: `average.ts — ${v.label}` })]),
    h('div', { class: 'pv-body' }, [
      h('div', { class: 'pv-activity' }, [h('i', { class: 'is-on' }), h('i', {}, [h('b', { text: '3' })]), h('i'), h('i')]),
      h('div', { class: 'pv-side' }, [
        h('div', { class: 'pv-side__head', text: 'EXPLORER' }),
        ...FILES.map((f) => h('div', { class: `pv-file ${f.cls}`, style: { color: f.color } }, [h('span', { text: f.name }), h('em', { text: f.mark })])),
      ]),
      h('div', { class: 'pv-main' }, [
        h('div', { class: 'pv-tabs' }, [h('div', { class: 'pv-tab is-on', text: 'average.ts' }), h('div', { class: 'pv-tab', text: 'tokens.ts' })]),
        codeBlock(true),
        h('div', { class: 'pv-panel' }, [
          h('div', { class: 'pv-panel__tabs' }, [h('span', { class: 'is-on', text: 'TERMINAL' }), h('span', { text: 'PROBLEMS' })]),
          terminal(v),
        ]),
      ]),
    ]),
    widgets(),
    h('div', { class: 'pv-status' }, [h('span', { text: '⎇ main' }), h('span', { text: '✕ 1  ⚠ 1' }), h('span', { text: `TypeScript · ${v.label}` })]),
  )
  box.replaceChildren(mock)
}

// ---- 4. 判定
const sw = (c) => h('span', { class: 'pv-sw', style: { background: c } })

const renderAudit = () => {
  const v = variantOf(state.day)
  document.getElementById('pv-audit-title').textContent = `${v.label} の判定`
  const cRows = v.audit.contrasts.map((c) => h('tr', {}, [
    h('td', { class: 'item', text: c.label }),
    h('td', {}, [sw(c.fg), sw(c.bg)]),
    h('td', { class: 'pv-num', text: `${c.ratio.toFixed(2)} (≥ ${c.min})` }),
    h('td', {}, [statusChip(c.level, c.level === 'ok' ? 'OK' : c.level === 'warn' ? '不足気味' : '不足')]),
  ]))
  document.getElementById('pv-contrast').replaceChildren(...cRows)
  const pRows = [...v.audit.pairs].sort((x, y) => x.dist - y.dist).map((p) => h('tr', {}, [
    h('td', { class: 'item', text: `${p.a} × ${p.b}` }),
    h('td', {}, [sw(p.colorA), sw(p.colorB)]),
    h('td', { class: 'pv-num', text: p.dist.toFixed(3) }),
    h('td', {}, [statusChip(p.level)]),
  ]))
  document.getElementById('pv-pairs').replaceChildren(...pRows)
}

const renderSummary = () => {
  const rows = DAY_KEYS.map((key) => {
    const cells = DATA.schemes.map((s) => {
      const v = DATA.variants[[s.id, state.palette, state.appearance, key].join('|')]
      const bad = v.audit.pairs.filter((p) => p.level === 'bad').length + v.audit.contrasts.filter((c) => c.level === 'bad').length
      const warn = v.audit.pairs.filter((p) => p.level === 'warn').length + v.audit.contrasts.filter((c) => c.level === 'warn').length
      return h('td', {}, [statusChip(v.audit.level), h('small', { text: `衝突 ${bad} / 近い ${warn}` })])
    })
    const label = DATA.variants[['a', state.palette, state.appearance, key].join('|')].label
    return h('tr', {}, [h('td', { class: 'item', text: label }), ...cells])
  })
  document.getElementById('pv-summary').replaceChildren(...rows)
}

// ---- 操作
const segButtons = (id, key, options) => {
  const box = document.getElementById(id)
  box.replaceChildren(...options.map(([value, text]) => {
    const b = h('button', { type: 'button', class: state[key] === value ? 'active' : '', text })
    b.addEventListener('click', () => { state[key] = value; update() })
    return b
  }))
}

const update = () => {
  segButtons('pv-scheme', 'scheme', DATA.schemes.map((s) => [s.id, s.label]))
  segButtons('pv-palette', 'palette', DATA.palettes.map((p) => [p.id, p.label]))
  segButtons('pv-appearance', 'appearance', [['dark', 'Dark'], ['light', 'Light']])
  segButtons('pv-day', 'day', DAY_KEYS.map((k) => [k, k === 'none' ? 'なし' : DATA.days.find((d) => d.key === k).ja]))
  renderSwatches()
  renderDays()
  renderMock()
  renderAudit()
  renderSummary()
  // URL への保存は共有用の便宜。sandbox された枠 (Artifact) では拒否されうるが、表示には影響しないので止めない
  try {
    history.replaceState(null, '', `?${new URLSearchParams(state)}`)
  } catch (error) {
    console.warn('URL に状態を保存できませんでした', error)
  }
}

update()
