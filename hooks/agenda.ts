/**
 * What the day holds, read through the macos and nycu plugin scripts and parsed from
 * their JSON envelopes.
 */

/** One calendar event, at a minute of the day. */
export type Event = {
  title: string
  /** Minutes after midnight, local; null when the start could not be read. */
  minute: number | null
  location: string
}

/** One reminder, with a due time when it has one. */
export type Reminder = {
  name: string
  due: Date | null
}

/** One E3 deadline. */
export type Deadline = {
  name: string
  course: string
  due: Date
}

/** Everything read, and what failed. */
export type Agenda = {
  events: Event[]
  reminders: Reminder[]
  deadlines: Deadline[]
  /** One line per source that failed, `calendar: …`. */
  errors: string[]
  /** When the read finished, epoch ms. */
  readAt: number
}

/** A finished run of one script. */
export type Run = { exitCode: number; stdout: string; stderr: string }

/** The three sources, in the order they are read and reported. */
export const SOURCES = ['calendar', 'reminders', 'e3p'] as const

export type Source = (typeof SOURCES)[number]

/** How long one script may take before it counts as failed. */
export const READ_TIMEOUT_MS = 30000

/**
 * The PATH a child needs to find `uv` (the scripts' shebang) without a shell.
 *
 * @param home the person's home directory
 * @returns the PATH value
 */
export function pathOf(home: string): string {
  return ['/opt/homebrew/bin', `${home}/.local/bin`, `${home}/.bun/bin`, '/usr/local/bin', '/usr/bin', '/bin'].join(':')
}

/**
 * `YYYY-MM-DD` of a local date.
 *
 * @param date the date
 * @returns the day
 */
export function dayOf(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

/**
 * The argv that reads one source for `now`'s day.
 *
 * @param source which script
 * @param scriptsDir where the scripts live
 * @param now the moment
 * @param options the reminders list and the E3 window
 * @returns the argv
 */
export function argvOf(
  source: Source,
  scriptsDir: string,
  now: Date,
  options: { remindersList: string; dueDays: number },
): readonly string[] {
  switch (source) {
    case 'calendar':
      return [`${scriptsDir}/productivity.py`, 'calendar_list_events']
    case 'reminders':
      return [`${scriptsDir}/productivity.py`, 'reminders_list']
    case 'e3p':
      return [`${scriptsDir}/e3p.py`, 'due', '--days', String(options.dueDays), '--limit', '50']
  }
}

/** The JSON request body for a native source; timezone offsets are explicit. */
export function inputOf(source: Source, now: Date): Record<string, unknown> | undefined {
  if (source === 'e3p') return undefined
  if (source === 'reminders') return { completed: false, limit: 100 }
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { from: from.toISOString(), to: to.toISOString(), limit: 100 }
}

/** Resolve a configured display name to one native list ID, never the first match. */
export function listIdOf(rows: unknown[], selector: string): string {
  const matches = rows.filter((row): row is Record<string, unknown> => isRecord(row) && (row.id === selector || row.title === selector))
  if (matches.length !== 1 || typeof matches[0]?.id !== 'string') throw new Error(`reminder list '${selector}' is missing or ambiguous; configure its ID`)
  return matches[0].id
}

/** Parse v2 date-only or offset-bearing schedules. Date-only tasks are due at the end of their local day. */
export function scheduleOf(value: unknown): Date | null {
  if (!isRecord(value)) return null
  if (value.kind === 'datetime' && typeof value.at === 'string') {
    const parsed = new Date(value.at)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (value.kind === 'date' && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    const [y,m,d] = value.date.split('-').map(Number)
    return new Date(y!,m!-1,d!,23,59,59,999)
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The `data` of a utils envelope, or the reason there is none.
 *
 * @param run the finished script
 * @returns `{ data }` or `{ error }`
 */
export function envelopeOf(run: Run): { data: unknown[] } | { error: string } {
  let parsed: unknown

  try {
    parsed = JSON.parse(run.stdout)
  } catch {
    const tail = run.stderr.trim().split('\n').at(-1) ?? ''

    return { error: run.exitCode === 0 ? 'answered something that is not JSON' : `exited ${run.exitCode}${tail ? `: ${tail}` : ''}` }
  }

  if (!isRecord(parsed)) {
    return { error: 'answered something that is not an envelope' }
  }

  if (parsed.success !== true) {
    const error = isRecord(parsed.error) ? parsed.error : {}
    const message = typeof error.message === 'string' ? error.message : 'failed'
    const hint = typeof error.hint === 'string' ? ` (${error.hint})` : ''

    return { error: `${message}${hint}` }
  }

  return { data: Array.isArray(parsed.data) ? parsed.data : isRecord(parsed.data) && Array.isArray(parsed.data.items) ? parsed.data.items : [] }
}

/**
 * API v2 calendar occurrences as local event times. Date-only events start at midnight.
 *
 * @param rows the envelope's data
 * @returns the events, earliest first
 */
export function eventsOf(rows: unknown[]): Event[] {
  const events: Event[] = []

  for (const row of rows) {
    if (!isRecord(row) || typeof row.title !== 'string') {
      continue
    }

    const start = scheduleOf(row.start)

    events.push({
      title: row.title,
      minute: isRecord(row.start) && row.start.kind === 'date' ? 0 : start ? start.getHours() * 60 + start.getMinutes() : null,
      location: typeof row.location === 'string' ? row.location.trim() : '',
    })
  }

  return events.sort((a, b) => (a.minute ?? 1e9) - (b.minute ?? 1e9))
}

/**
 * Reminder rows as reminders, the undone ones only.
 *
 * @param rows the envelope's data
 * @returns the reminders, due ones first
 */
export function remindersOf(rows: unknown[]): Reminder[] {
  const reminders: Reminder[] = []

  for (const row of rows) {
    if (!isRecord(row) || typeof row.title !== 'string' || row.completed === true) {
      continue
    }

    reminders.push({
      name: row.title,
      due: scheduleOf(row.due),
    })
  }

  return reminders.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))
}

/**
 * E3 rows as deadlines.
 *
 * @param rows the envelope's data
 * @returns the deadlines, soonest first
 */
export function deadlinesOf(rows: unknown[]): Deadline[] {
  const deadlines: Deadline[] = []

  for (const row of rows) {
    if (!isRecord(row) || typeof row.name !== 'string' || typeof row.timesort !== 'number') {
      continue
    }

    deadlines.push({
      name: row.name,
      course: typeof row.course === 'string' ? row.course : '',
      due: new Date(row.timesort * 1000),
    })
  }

  return deadlines.sort((a, b) => a.due.getTime() - b.due.getTime())
}

/**
 * The agenda three finished runs make.
 *
 * @param runs each source's run, or the error that stopped it
 * @param readAt when the reads finished
 * @returns the agenda
 */
export function agendaOf(runs: Record<Source, Run | Error>, readAt: number): Agenda {
  const agenda: Agenda = { events: [], reminders: [], deadlines: [], errors: [], readAt }

  for (const source of SOURCES) {
    const run = runs[source]

    if (run instanceof Error) {
      agenda.errors.push(`${source}: ${run.message}`)
      continue
    }

    const envelope = envelopeOf(run)

    if ('error' in envelope) {
      agenda.errors.push(`${source}: ${envelope.error}`)
      continue
    }

    if (source === 'calendar') {
      agenda.events = eventsOf(envelope.data)
    } else if (source === 'reminders') {
      agenda.reminders = remindersOf(envelope.data)
    } else {
      agenda.deadlines = deadlinesOf(envelope.data)
    }
  }

  return agenda
}
