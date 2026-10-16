import type { Agenda, Deadline, Event, Reminder } from '../agenda'
import { COLOR, type Seg } from './panel'

/** How long an event without an end is taken to run, for "now". */
export const EVENT_SPAN_MIN = 110

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * `HH:MM` of a minute of the day.
 *
 * @param minute minutes after midnight
 * @returns the clock
 */
export function clockOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/**
 * `1h 12m`, `45m`, or `2d` for a span.
 *
 * @param minutes a non-negative span
 * @returns the text
 */
export function spanOf(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes))

  if (whole >= 48 * 60) {
    return `${Math.floor(whole / (24 * 60))}d`
  }

  if (whole >= 60) {
    const rest = whole % 60

    return rest === 0 ? `${Math.floor(whole / 60)}h` : `${Math.floor(whole / 60)}h ${rest}m`
  }

  return `${whole}m`
}

/**
 * `Wed 09-23 23:59` for a Date.
 *
 * @param date the moment
 * @returns the text
 */
export function whenOf(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${WEEKDAYS[date.getDay()]} ${mm}-${dd} ${clockOf(date.getHours() * 60 + date.getMinutes())}`
}

/**
 * The event to point at: one running now, else the next to start today.
 *
 * @param events today's events
 * @param nowMinute minutes after midnight now
 * @returns `{ event, kind }` or null past the last one
 */
export function pointerOf(
  events: readonly Event[],
  nowMinute: number,
): { event: Event; kind: 'now' | 'next' } | null {
  const timed = events.filter((event): event is Event & { minute: number } => event.minute !== null)
  const running = timed.find(event => event.minute <= nowMinute && nowMinute < event.minute + EVENT_SPAN_MIN)

  if (running) {
    return { event: running, kind: 'now' }
  }

  const next = timed.find(event => event.minute > nowMinute)

  return next ? { event: next, kind: 'next' } : null
}

/** How soon a deadline counts as close. */
export const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000

/**
 * The band's line as colored runs.
 *
 * @param agenda what was read
 * @param now the moment
 * @returns `13:20 3D遊戲程式  ED102  in 1h 12m │ DUE 2  1 within 3d │ TODO 1 overdue`
 */
export function bandSegsOf(agenda: Agenda, now: Date): Seg[] {
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const pointer = pointerOf(agenda.events, nowMinute)
  const segs: Seg[] = []
  const gap = () => segs.push({ text: '  │  ', color: COLOR.line })

  if (pointer) {
    const { event, kind } = pointer

    segs.push({ text: `${clockOf(event.minute!)} `, color: COLOR.text })
    segs.push({ text: event.title, color: COLOR.text, bold: true })

    if (event.location) {
      segs.push({ text: `  ${event.location}`, color: COLOR.muted })
    }

    segs.push(
      kind === 'now'
        ? { text: '  now', color: COLOR.warn, bold: true }
        : { text: `  in ${spanOf(event.minute! - nowMinute)}`, color: COLOR.muted },
    )
  } else {
    segs.push({ text: agenda.events.length === 0 ? 'no events today' : 'no more events today', color: COLOR.muted })
  }

  const dueSoon = agenda.deadlines.filter(deadline => deadline.due.getTime() - now.getTime() < DUE_SOON_MS)

  if (agenda.deadlines.length > 0) {
    gap()
    segs.push({ text: 'DUE ', color: COLOR.label })
    segs.push({ text: String(agenda.deadlines.length), color: dueSoon.length ? COLOR.warn : COLOR.text, bold: true })

    if (dueSoon.length) {
      segs.push({ text: `  ${dueSoon.length} within 3d`, color: COLOR.muted })
    }
  }

  const overdue = agenda.reminders.filter(reminder => reminder.due !== null && reminder.due.getTime() <= now.getTime())
  const dueToday = agenda.reminders.filter(
    reminder => reminder.due !== null && reminder.due.getTime() > now.getTime() && reminder.due.toDateString() === now.toDateString(),
  )

  if (overdue.length || dueToday.length) {
    gap()
    segs.push({ text: 'TODO ', color: COLOR.label })

    if (overdue.length) {
      segs.push({ text: `${overdue.length} overdue`, color: COLOR.error, bold: true })
    }

    if (dueToday.length) {
      segs.push({ text: `${overdue.length ? '  ' : ''}${dueToday.length} today`, color: COLOR.text })
    }
  }

  if (agenda.errors.length) {
    gap()
    segs.push({ text: 'FAILED ', color: COLOR.label })
    segs.push({ text: `${agenda.errors.length} source${agenda.errors.length > 1 ? 's' : ''}`, color: COLOR.error, bold: true })
  }

  return segs
}

/**
 * The band's line as plain text.
 *
 * @param agenda what was read
 * @param now the moment
 * @returns the runs joined
 */
export function bandTextOf(agenda: Agenda, now: Date): string {
  return bandSegsOf(agenda, now)
    .map(seg => seg.text)
    .join('')
}

function eventLine(event: Event): string {
  const at = event.minute === null ? '--:--' : clockOf(event.minute)

  return `- ${at} ${event.title}${event.location ? ` (${event.location})` : ''}`
}

function deadlineLine(deadline: Deadline): string {
  return `- ${whenOf(deadline.due)} ${deadline.name}${deadline.course ? ` [${deadline.course}]` : ''}`
}

function reminderLine(reminder: Reminder): string {
  return `- ${reminder.due ? `${whenOf(reminder.due)} ` : ''}${reminder.name}`
}

/**
 * The agenda as Markdown: the `today` context block, and /today's answer.
 *
 * @param agenda what was read
 * @param now the moment
 * @returns the text
 */
export function agendaTextOf(agenda: Agenda, now: Date): string {
  const lines: string[] = [`Today is ${WEEKDAYS[now.getDay()]} ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}, now ${clockOf(now.getHours() * 60 + now.getMinutes())} (local time).`, '']

  lines.push('Calendar today:')
  lines.push(...(agenda.events.length ? agenda.events.map(eventLine) : ['- nothing']))
  lines.push('')
  lines.push('E3 deadlines ahead:')
  lines.push(...(agenda.deadlines.length ? agenda.deadlines.map(deadlineLine) : ['- none']))
  lines.push('')
  lines.push('Reminders open:')
  lines.push(...(agenda.reminders.length ? agenda.reminders.map(reminderLine) : ['- none']))

  if (agenda.errors.length) {
    lines.push('', 'Sources that failed:')
    lines.push(...agenda.errors.map(error => `- ${error}`))
  }

  return lines.join('\n')
}
