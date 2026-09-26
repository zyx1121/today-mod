import { describe, expect, test, tier } from 'claude-code/testing'

import { cachePathOf, entryOf, isFresh, keptOf, runsOf } from '../hooks/shared-read'

tier('user')

describe('shared-read', () => {
  test('the file sits under TMPDIR, else /tmp', async () => {
    expect(cachePathOf('/var/folders/x/T/')).toBe('/var/folders/x/T/today-mod/agenda.json')
    expect(cachePathOf(undefined)).toBe('/tmp/today-mod/agenda.json')
  })

  test('runs survive the file, an Error as its message', async () => {
    const run = { exitCode: 0, stdout: '{}', stderr: '' }
    const text = JSON.stringify({ key: 'k', readAt: 1, runs: keptOf({ calendar: run, reminders: run, e3p: new Error('boom') }) })
    const entry = entryOf(text)

    expect(entry?.key).toBe('k')

    const runs = entry?.runs ? runsOf(entry.runs) : null

    expect(runs?.calendar).toEqual(run)
    expect(runs?.e3p instanceof Error && runs.e3p.message).toBe('boom')
  })

  test('a claim parses with no runs; what is not an entry is null', async () => {
    expect(entryOf(JSON.stringify({ key: 'k', readAt: 1, runs: null }))).toEqual({ key: 'k', readAt: 1, runs: null })
    expect(entryOf('nope')).toBeNull()
    expect(entryOf(JSON.stringify({ key: 'k', readAt: 1, runs: { calendar: {} } }))).toBeNull()
    expect(entryOf(JSON.stringify({ readAt: 1, runs: null }))).toBeNull()
  })

  test('fresh means younger than the age asked, and never from the future', async () => {
    expect(isFresh(1000, 1000, 5000)).toBe(true)
    expect(isFresh(1000, 6000, 5000)).toBe(false)
    expect(isFresh(1000, 500, 5000)).toBe(false)
  })
})
