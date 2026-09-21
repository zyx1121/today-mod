/**
 * What the day holds, read through three zyx utils scripts and parsed from
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
  const day = dayOf(now)

  switch (source) {
    case 'calendar':
      return [`${scriptsDir}/calendar.py`, 'list', '--from', `${day}T00:00`, '--to', `${day}T23:59`, '--limit', '50']
    case 'reminders':
      return [`${scriptsDir}/reminders.py`, 'list', '--list', options.remindersList, '--limit', '50']
    case 'e3p':
      return [`${scriptsDir}/e3p.py`, 'due', '--days', String(options.dueDays), '--limit', '50']
  }
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

  return { data: Array.isArray(parsed.data) ? parsed.data : [] }
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

const APPLE_DATE = /^(?:\w+, )?(\w+) (\d{1,2}), (\d{4})(?: at (\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?$/i

/**
 * The Date an AppleScript date-as-string names (`Monday, September 21, 2026
 * at 1:20:00 PM`), local time; null when it does not parse.
 *
 * @param text the AppleScript string
 * @returns the Date, or null
 */
export function appleDateOf(text: string): Date | null {
  const match = APPLE_DATE.exec(text.trim())

  if (!match) {
    return null
  }

  const [, monthName, day, year, hour, minute, second, meridiem] = match
  const month = MONTHS.indexOf((monthName ?? '').toLowerCase())

  if (month < 0) {
    return null
  }

  let h = hour === undefined ? 0 : Number(hour)

  if (meridiem?.toUpperCase() === 'PM' && h < 12) {
    h += 12
  }

  if (meridiem?.toUpperCase() === 'AM' && h === 12) {
    h = 0
  }

  return new Date(Number(year), month, Number(day), h, Number(minute ?? 0), Number(second ?? 0))
}

/**
 * Calendar rows as events, by their time of day (a recurring event reports
 * its series' first date, so only the time is trusted).
 *
 * @param rows the envelope's data
 * @returns the events, earliest first
 */
export function eventsOf(rows: unknown[]): Event[] {
  const events: Event[] = []

  for (const row of rows) {
    if (!isRecord(row) || typeof row.summary !== 'string') {
      continue
    }

    const start = typeof row.start === 'string' ? appleDateOf(row.start) : null

    events.push({
      title: row.summary,
      minute: start ? start.getHours() * 60 + start.getMinutes() : null,
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
    if (!isRecord(row) || typeof row.name !== 'string' || row.done === true) {
      continue
    }

    reminders.push({
      name: row.name,
      due: typeof row.due === 'string' && row.due !== '' ? appleDateOf(row.due) : null,
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
