import { argvOf, inputOf, SOURCES } from '../../hooks/agenda'
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

/** API v2 event occurrences for the current local day. */
export const CALENDAR = JSON.stringify({
  success: true,
  data: { items: [
    { id: 'e1', start: {kind:'datetime', at:new Date(2026,8,21,13,20).toISOString(),time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone}, title: '3D遊戲程式', location: 'ED102' },
    { id: 'e2', start: {kind:'datetime', at:new Date(2026,8,21,15,30).toISOString(),time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone}, title: 'Lab Meetings', location: 'EC411' },
  ], next_cursor: null },
  metadata: { count: 2 },
})

/** API v2 reminders: one overdue, one completed and one without a due. */
export const REMINDERS = JSON.stringify({
  success: true,
  data: { items: [
    { id:'r1', title: 'Reply to advisor', due: {kind:'datetime',at:new Date(2026,8,20,18).toISOString(),time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone}, completed: false },
    { id:'r2', title: 'Old thing', due: null, completed: true },
    { id:'r3', title: 'Buy filament', due: null, completed: false },
  ], next_cursor: null },
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

/** Where the shared reading lives under the tests' TMPDIR. */
export const SHARED = '/tmp/t/today-mod/agenda.json'

/** The key the default settings read on NOW's day. */
export const KEY = JSON.stringify(SOURCES.map(source => [...argvOf(source, source === 'e3p' ? '/plugins/nycu/0.1.0/scripts' : '/plugins/macos/0.2.0/scripts', new Date(NOW), {remindersList:'TODO',dueDays:7}), JSON.stringify(inputOf(source,new Date(NOW))) ?? '', source==='reminders'?'TODO':'']))

/** The three answers as another session's shared reading keeps them. */
export const KEPT = {
  calendar: { exitCode: 0, stdout: CALENDAR, stderr: '' },
  reminders: { exitCode: 0, stdout: EMPTY, stderr: '' },
  e3p: { error: 'timed out' },
}

/**
 * The world beneath the mod: a session that starts, a command that
 * registers, each script answered by its base name, a band that draws
 * BENEATH when the mod passes, a store, HOME, and the clock at NOW.
 *
 * @param on the test's `on`
 * @param answers what each script prints, by base name (mutable)
 * @param stored what the plugin's store holds at the start (mutated by sets)
 * @returns what was kept, the answers, the store, the shared files (and what each
 *   script run found there), the clock
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
  const files: Record<string, string> = {}
  const sharedAtRun: (string | undefined)[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    runs.push(e)
    sharedAtRun.push(files[SHARED])

    const name = e.argv[0]?.endsWith('productivity.py') ? e.argv[1] === 'calendar_list_events' ? 'calendar.py' : 'reminders.py' : e.argv[0]?.split('/').at(-1) ?? ''
    if (e.argv[1] === 'reminders_list_lists') return {value:answers['reminders_list_lists'] ?? {exitCode:0,stdout:JSON.stringify({success:true,data:[{id:'list-1',title:'TODO',account:'iCloud',writable:true}]}),stderr:''}}
    const cursor = e.init?.stdin ? JSON.parse(e.init.stdin).cursor : null
    const answer = answers[cursor ? `${name} next` : name] ?? { exitCode: 127, stdout: '', stderr: `no such script: ${name}` }

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
  on('fs.read', ($, e) => {
    const text = files[e.path]

    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', ($, e) => {
    files[e.path] = e.text

    return { value: undefined }
  })
  files['/Users/loki/.claude/plugins/installed_plugins.json'] = JSON.stringify({ plugins: {
    'macos@zyx1121': [{ scope: 'user', installPath: '/plugins/macos/0.2.0' }],
    'nycu@zyx1121': [{ scope: 'user', installPath: '/plugins/nycu/0.1.0' }],
  } })
  mock.env(on, { HOME: '/Users/loki', TMPDIR: '/tmp/t/' })

  const clock = mock.clock(on, { now: NOW })

  return { runs, invalidated, answers, stored, files, sharedAtRun, clock }
}

/**
 * A rendered tree's text: its strings in order, one newline between a
 * column Box's children.
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

  const props: unknown = Reflect.get(tree, 'props')
  const isColumn = typeof props === 'object' && props ? Reflect.get(props, 'flexDirection') === 'column' : false
  const children: unknown = Reflect.get(tree, 'children') ?? []
  const parts = Array.isArray(children) ? children.map(textOf) : [textOf(children)]

  return parts.join(isColumn ? '\n' : '')
}

/**
 * The mod's own line of a band render: the first line, what is beneath
 * following on the next.
 *
 * @param tree what `$.ui.render` resolved to
 * @returns the mod's line
 */
export function lineOf(tree: unknown): string {
  return textOf(tree).split('\n')[0] ?? ''
}
