import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const PANE = {
  plugin: 'dealcheck',
  component: 'Pane',
  requestId: 'dealcheck',
  props: {
    title: 'Dealcheck',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const KEYS = ['urgency', 'market_size', 'pricing_potential', 'acquisition_cost', 'delivery_cost',
  'uniqueness', 'speed', 'upfront_investment', 'upsell_potential', 'evergreen_potential']

const report = (score: number) => ({
  mode: 'idea',
  name: 'Test idea',
  summary: 'A test.',
  factors: KEYS.map(key => ({
    key, name: key, score, reason: 'Because.', confidence: 'medium',
    evidence: [{ claim: 'A source', url: 'https://example.com' }],
  })),
  red_flags: ['One flag'],
  next_questions: ['Ask this'],
  bottom_line: 'Test it first.',
})

function engine(on: Parameters<TestBody>[1]) {
  on('command.register', () => ({ value: { command: 'dealcheck' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__dealcheck__submit_report' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

test('a submitted report is totalled and drawn on every surface', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.tool.call({ tool: 'mcp__dealcheck__submit_report', ...report(6) })
  expect(JSON.stringify(ran)).toContain('60/100')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^60\/100$/ }))?.text).toBe('60/100')
    expect(await ui.find({ type: 'Text', text: /Test before building/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('a report missing factors goes back to the model as an error', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const bad = { ...report(5), factors: report(5).factors.slice(0, 9) }
  const ran = await $.tool.call({ tool: 'mcp__dealcheck__submit_report', ...bad })
  expect(JSON.stringify(ran)).toContain('all 10 factors')
})

test('the pane invites a first check when there are none', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /No checks yet/ })).toBeTruthy()
  await ui.unmount()
})
