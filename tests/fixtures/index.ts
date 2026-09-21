import type { Args, CommandRunInput, On, RenderElement, RenderInput, SessionStartInput } from 'claude-code'
import { mock } from 'claude-code/testing'

/** Monday 2026-09-21 10:00 local, as epoch ms. */
export const NOW = new Date(2026, 8, 21, 10, 0, 0).getTime()

/** An interactive terminal session in /work. */
export const SESSION: SessionStartInput = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/work',
}

/** /today with the given args. */
export function today(args = ''): CommandRunInput {
  return {
    command: 'today',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  }
}

/** The band above the prompt, 120 body columns, no survey. */
export const BAND: RenderInput<'AbovePrompt'> = {
  component: 'AbovePrompt',
  surface: 'terminal',
  requestId: 'above-prompt',
  viewport: { columns: 120, rows: 40 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
}

/** What the world beneath draws in the band when the mod passes. */
export const BENEATH: RenderElement = { type: 'Text', children: ['(beneath)'] }

/** calendar.py's answer: a class at 13:20 and a recurring meeting reporting its series' first date. */
export const CALENDAR = JSON.stringify({
  success: true,
  data: [
    { calendar: 'loki.cs14@nycu.edu.tw', start: 'Monday, September 21, 2026 at 1:20:00 PM', summary: '3D遊戲程式', location: 'ED102' },
    { calendar: 'loki.cs14@nycu.edu.tw', start: 'Monday, July 13, 2026 at 3:30:00 PM', summary: 'Lab Meetings', location: 'EC411' },
  ],
  metadata: { count: 2 },
})

/** reminders.py's answer: one overdue, one done, one without a due. */
export const REMINDERS = JSON.stringify({
  success: true,
  data: [
    { name: 'Reply to advisor', due: 'Sunday, September 20, 2026 at 6:00:00 PM', done: false },
    { name: 'Old thing', due: '', done: true },
    { name: 'Buy filament', due: '', done: false },
  ],
  metadata: { count: 3, list: 'TODO' },
})

/** e3p.py's answer: one deadline on Wednesday night. */
export const E3P = JSON.stringify({
  success: true,
  data: [{ name: 'HW1', timesort: Math.floor(new Date(2026, 8, 23, 23, 59).getTime() / 1000), course: '1151.535654', courseid: 25893 }],
  metadata: { count: 1, days: 7 },
})

/** An empty success envelope. */
export const EMPTY = JSON.stringify({ success: true, data: [], metadata: {} })

/** e3p.py not logged in. */
export const E3P_LOGGED_OUT = {
  exitCode: 1,
  stdout: JSON.stringify({ success: false, error: { message: 'not logged in', why: 'no config', hint: 'run utils e3p login' } }),
  stderr: '',
}

type Answer = { exitCode: number; stdout: string; stderr: string }

/**
 * The world beneath the mod: a session that starts, a command that
 * registers, each script answered by its base name, a band that draws
 * BENEATH when the mod passes, a store, HOME, and the clock at NOW.
 *
 * @param on the test's `on`
 * @param answers what each script prints, by base name (mutable)
 * @param stored what the plugin's store holds at the start (mutated by sets)
 * @returns what was kept, the answers, the store, the clock
 */
export function world(
  on: On,
  answers: Record<string, Answer> = {
    'calendar.py': { exitCode: 0, stdout: CALENDAR, stderr: '' },
    'reminders.py': { exitCode: 0, stdout: REMINDERS, stderr: '' },
    'e3p.py': { exitCode: 0, stdout: E3P, stderr: '' },
  },
  stored: Record<string, unknown> = {},
) {
  const runs: Args<'process.run'>[] = []
  const invalidated: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    runs.push(e)

    const name = e.argv[0]?.split('/').at(-1) ?? ''
    const answer = answers[name] ?? { exitCode: 127, stdout: '', stderr: `no such script: ${name}` }

    return { value: answer }
  })
  on('ui.invalidate', ($, e) => {
    invalidated.push(e.event)

    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, () => BENEATH)
  on('store.get', ($, e) => ({ value: stored[e.key] }))
  on('store.set', ($, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  on('prompt.context', ($, e) => ({ blocks: e.blocks }))
  mock.env(on, { HOME: '/Users/loki' })

  const clock = mock.clock(on, { now: NOW })

  return { runs, invalidated, answers, stored, clock }
}

/**
 * A rendered tree's text: its strings in order.
 *
 * @param tree what `$.ui.render` resolved to
 * @returns the text
 */
export function textOf(tree: unknown): string {
  if (typeof tree === 'string' || typeof tree === 'number') {
    return String(tree)
  }

  if (Array.isArray(tree)) {
    return tree.map(textOf).join('')
  }

  if (typeof tree !== 'object' || !tree) {
    return ''
  }

  return textOf(Reflect.get(tree, 'children') ?? [])
}
