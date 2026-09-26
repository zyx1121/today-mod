/**
 * One reading of the day shared by every session on the machine: each
 * session looks at a small file under the temporary directory first and runs
 * the three scripts only when the reading there is older than it can use, so
 * five open sessions cost one Calendar walk per refresh, not five.
 */
import { SOURCES, type Run, type Source } from './agenda'

/** A source's outcome as the file keeps it: the run, or why it did not run. */
export type Kept = Run | { error: string }

/**
 * What the shared file holds: which reads it answers (`key`, the argv of
 * each source, so another day or other settings never match), when it was
 * taken (milliseconds since the epoch), and the runs, or null while a read
 * is still under way.
 */
export type Entry = { key: string; readAt: number; runs: Record<Source, Kept> | null }

/** The shared file's name under the temporary directory. */
export const CACHE_NAME = 'today-mod/agenda.json'

/**
 * The shared file's path.
 *
 * @param tmpdir `TMPDIR`, when set
 * @returns the path under it, else under /tmp
 */
export function cachePathOf(tmpdir: string | undefined): string {
  const dir = tmpdir && tmpdir !== '' ? tmpdir : '/tmp'

  return `${dir.replace(/\/+$/, '')}/${CACHE_NAME}`
}

/**
 * The key a read answers: the argv of every source, in order.
 *
 * @param argvs each source's argv
 * @returns the key
 */
export function keyOf(argvs: Record<Source, readonly string[]>): string {
  return JSON.stringify(SOURCES.map(source => argvs[source]))
}

function isKept(value: unknown): value is Kept {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const kept = value as Record<string, unknown>

  if (typeof kept.error === 'string') {
    return true
  }

  return typeof kept.exitCode === 'number' && typeof kept.stdout === 'string' && typeof kept.stderr === 'string'
}

/**
 * The runs as the file keeps them: an Error becomes its message.
 *
 * @param runs each source's run or error
 * @returns the JSON-safe runs
 */
export function keptOf(runs: Record<Source, Run | Error>): Record<Source, Kept> {
  const kept = {} as Record<Source, Kept>

  for (const source of SOURCES) {
    const run = runs[source]

    kept[source] = run instanceof Error ? { error: run.message } : run
  }

  return kept
}

/**
 * The runs the file kept, an error message back as an Error.
 *
 * @param kept what the file holds
 * @returns each source's run or error
 */
export function runsOf(kept: Record<Source, Kept>): Record<Source, Run | Error> {
  const runs = {} as Record<Source, Run | Error>

  for (const source of SOURCES) {
    const one = kept[source]

    runs[source] = 'error' in one ? new Error(one.error) : one
  }

  return runs
}

/**
 * The entry a shared file's text stands for.
 *
 * @param text the file's content
 * @returns the entry, or null when the text is not one
 */
export function entryOf(text: string): Entry | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }

  const { key, readAt, runs } = parsed as Record<string, unknown>

  if (typeof key !== 'string' || typeof readAt !== 'number' || !Number.isFinite(readAt)) {
    return null
  }

  if (runs === null) {
    return { key, readAt, runs: null }
  }

  if (typeof runs !== 'object' || runs === undefined) {
    return null
  }

  const all = runs as Record<string, unknown>

  if (!SOURCES.every(source => isKept(all[source]))) {
    return null
  }

  return { key, readAt, runs: all as Record<Source, Kept> }
}

/**
 * Whether a reading at `readAt` is recent enough at `at`. A reading from the
 * future (a clock set back) is never fresh.
 *
 * @param readAt when it was taken
 * @param at now
 * @param maxAgeMs the oldest the caller takes
 * @returns whether to use it
 */
export function isFresh(readAt: number, at: number, maxAgeMs: number): boolean {
  return readAt <= at && at - readAt < maxAgeMs
}
