import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Factor, Report, Run } from '../types'

const PANE = 'dealcheck'
const TOOL = 'mcp__dealcheck__submit_report'
// Bump a tag when its value's fields change: it declines what an earlier version stored.
const reports = atom({ plugin: 'dealcheck', key: 'reports' } as const, [] as Report[], { shape: 'reports-1' })
const run = atom({ plugin: 'dealcheck', key: 'run' } as const, null as Run, { shape: 'run-1' })
const shown = atom({ plugin: 'dealcheck', key: 'shown' } as const, 0, { shape: 'shown-1' })

const KEYS = [
  'urgency', 'market_size', 'pricing_potential', 'acquisition_cost', 'delivery_cost',
  'uniqueness', 'speed', 'upfront_investment', 'upsell_potential', 'evergreen_potential',
] as const

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'name', 'summary', 'factors', 'red_flags', 'next_questions', 'bottom_line'],
  properties: {
    mode: { type: 'string', enum: ['idea', 'acquisition'] },
    name: { type: 'string', description: 'Short name of the idea or business' },
    summary: { type: 'string', description: 'What it sells, to whom, how it makes money. Two sentences.' },
    factors: {
      type: 'array', minItems: 10, maxItems: 10,
      items: {
        type: 'object', additionalProperties: false,
        required: ['key', 'name', 'score', 'reason', 'confidence', 'evidence'],
        properties: {
          key: { type: 'string', enum: [...KEYS] },
          name: { type: 'string' },
          score: { type: 'integer', minimum: 0, maximum: 10 },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          evidence: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', additionalProperties: false, required: ['claim', 'url'],
              properties: { claim: { type: 'string' }, url: { type: 'string' } },
            },
          },
        },
      },
    },
    red_flags: { type: 'array', items: { type: 'string' } },
    next_questions: { type: 'array', items: { type: 'string' } },
    bottom_line: { type: 'string' },
  },
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])
const band = (t: number): Report['band'] => (t >= 75 ? 'promising' : t >= 50 ? 'maybe' : 'pass')
const tone = (s: number) => (s >= 7 ? 'success' : s >= 4 ? 'warning' : 'error')
const bar = (s: number) => '█'.repeat(s) + '░'.repeat(10 - s)
const VERDICT = { idea: { pass: 'Drop it', maybe: 'Test before building', promising: 'Worth building' },
  acquisition: { pass: 'Walk away', maybe: 'Negotiate with care', promising: 'Promising buy' } }

/** Checks the model's input and adds the totals; a string is an error for the model to fix. */
function toReport(input: unknown): Report | string {
  const i = (input ?? {}) as Record<string, unknown>
  const raw = list(i.factors)
  if (raw.length !== 10) return `factors must hold all 10 factors; got ${raw.length}.`
  const factors: Factor[] = raw.map((f: Record<string, unknown>) => ({
    key: str(f.key),
    name: str(f.name) || str(f.key),
    score: Math.max(0, Math.min(10, Math.round(Number(f.score) || 0))),
    reason: str(f.reason),
    confidence: (['high', 'medium', 'low'].includes(str(f.confidence)) ? f.confidence : 'low') as Factor['confidence'],
    evidence: list(f.evidence).map((x: Record<string, unknown>) => ({ claim: str(x.claim), url: str(x.url) })),
  }))
  const missing = KEYS.filter(k => !factors.some(f => f.key === k))
  if (missing.length) return `Missing factors: ${missing.join(', ')}.`
  const total = factors.reduce((n, f) => n + f.score, 0)
  return {
    id: Math.random().toString(36).slice(2, 10),
    mode: i.mode === 'acquisition' ? 'acquisition' : 'idea',
    name: str(i.name) || 'Untitled',
    summary: str(i.summary),
    factors,
    total,
    band: band(total),
    zeroFactors: factors.filter(f => f.score === 0).map(f => f.name),
    redFlags: list(i.red_flags).map(str).filter(Boolean),
    nextQuestions: list(i.next_questions).map(str).filter(Boolean),
    bottomLine: str(i.bottom_line),
    createdAt: Date.now(),
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'submit_report',
      description: 'Save a finished Dealcheck report and show it in the Dealcheck pane. Call once, after researching, with all ten factors.',
      inputSchema: SCHEMA,
      isDeferred: false,
    })
    return next(e)
  })

  // /dealcheck is the plugin's skill (skills/dealcheck/SKILL.md), which sends the brief to the model.
  // This hook only marks the run as started and opens the pane, then lets the skill run.
  on('command.run', async ($, e, next) => {
    if (e.command === 'dealcheck' || e.command.endsWith(':dealcheck')) {
      await update($, run, () => ({ subject: e.args.trim() || 'Waiting for a subject', steps: [] }))
      await $.ui.open({ id: PANE, title: 'Dealcheck' })
    }
    return next(e)
  })

  // A turn that ends without a submitted report (a question back, an error) stops showing "Researching".
  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && (await read($, run))) await update($, run, () => null)
    return next(e)
  })

  // Feed the pane's progress list while a check runs.
  on('tool.call', async ($, e, next) => {
    if ((e.tool === 'WebSearch' || e.tool === 'WebFetch') && (await read($, run))) {
      const label = e.tool === 'WebSearch' ? `search  ${e.query}` : `read    ${e.url}`
      await update($, run, r => (r ? { ...r, steps: [...r.steps, label].slice(-100) } : r))
    }
    return next(e)
  })

  on('tool.run', { tool: TOOL }, async ($, e) => {
    const report = toReport(e)  // the call's input fields sit on the event itself
    if (typeof report === 'string') return { deny: report }
    await update($, reports, rs => [report, ...rs].slice(0, 50))
    await update($, shown, () => 0)
    await update($, run, () => null)
    await $.ui.open({ id: PANE, title: 'Dealcheck' })
    $.ui.toast(`Dealcheck: ${report.name} scored ${report.total}/100`)
    return { result: `Saved. ${report.name}: ${report.total}/100 (${VERDICT[report.mode][report.band]}). The person sees the full report in the Dealcheck pane; do not repeat it.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const [rs, current, idx] = [await read($, reports), await read($, run), await read($, shown)]

    if (current) {
      const room = Math.max(3, (e.viewport?.rows ?? 24) - 6)
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold color="claude">Researching</Text>
          <Text wrap="truncate-end">{current.subject}</Text>
          <Box flexDirection="column">
            {current.steps.length === 0 && <Text dimColor>Starting…</Text>}
            {current.steps.slice(-room).map(s => (
              <Text dimColor wrap="truncate-end">{s}</Text>
            ))}
          </Box>
        </Box>
      )
    }

    const r = rs[Math.min(idx, rs.length - 1)]
    if (!r) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>Dealcheck</Text>
          <Text dimColor>No checks yet. Run /dealcheck with a startup idea, or a link to a business you want to buy.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>{r.name}</Text>
          <Text>
            <Text bold color={tone(r.total / 10)}>{r.total}/100</Text>
            <Text>  {VERDICT[r.mode][r.band]}</Text>
            <Text dimColor>  · {r.mode === 'idea' ? 'idea' : 'acquisition'}</Text>
          </Text>
        </Box>
        {r.zeroFactors.length > 0 && <Text color="error">Deal-breaker: {r.zeroFactors.join(', ')} scored 0.</Text>}
        <Text>{r.bottomLine}</Text>

        <Box flexDirection="column">
          {r.factors.map(f => (
            <Box key={f.key} flexDirection="column" marginBottom={1}>
              <Text>
                <Text mono color={tone(f.score)}>{bar(f.score)}</Text>
                <Text bold> {String(f.score).padStart(2)} </Text>
                <Text>{f.name}</Text>
                <Text dimColor> · {f.confidence}</Text>
              </Text>
              <Text dimColor>{f.reason}</Text>
              {f.evidence.slice(0, 2).map((x, n) =>
                /^https?:\/\//.test(x.url)
                  ? <Link key={`${f.key}${n}`} href={x.url} label={`↳ ${x.claim}`} />
                  : <Text dimColor>↳ {x.claim}</Text>,
              )}
            </Box>
          ))}
        </Box>

        {r.redFlags.length > 0 && (
          <Box flexDirection="column">
            <Text bold color="warning">Red flags</Text>
            {r.redFlags.map(x => <Text>• {x}</Text>)}
          </Box>
        )}
        <Box flexDirection="column">
          <Text bold>{r.mode === 'idea' ? 'Test first' : 'Ask the seller'}</Text>
          {r.nextQuestions.map(x => <Text>• {x}</Text>)}
        </Box>

        {rs.length > 1 && (
          <Box gap={2}>
            <Button key="prev" hotkey="p" onPress={() => update($, shown, i => Math.min(rs.length - 1, i + 1))}>Older</Button>
            <Button key="next" hotkey="n" onPress={() => update($, shown, i => Math.max(0, i - 1))}>Newer</Button>
            <Text dimColor>{idx + 1} of {rs.length}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
