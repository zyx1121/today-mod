import { describe, expect, test, tier } from 'claude-code/testing'

import { appleDateOf, envelopeOf } from '../hooks/agenda'
import { spanOf } from '../hooks/views/text'

tier('user')

describe('agenda', () => {
  test('AppleScript dates parse, morning, noon and midnight included', async () => {
    expect(appleDateOf('Monday, September 21, 2026 at 1:20:00 PM')).toEqual(new Date(2026, 8, 21, 13, 20, 0))
    expect(appleDateOf('September 21, 2026 at 12:05:00 AM')).toEqual(new Date(2026, 8, 21, 0, 5, 0))
    expect(appleDateOf('September 21, 2026 at 12:00:00 PM')).toEqual(new Date(2026, 8, 21, 12, 0, 0))
    expect(appleDateOf('September 21, 2026')).toEqual(new Date(2026, 8, 21, 0, 0, 0))
    expect(appleDateOf('someday')).toBeNull()
  })

  test('envelopes: success data, failure message with hint, non-JSON, exit code', async () => {
    expect(envelopeOf({ exitCode: 0, stdout: '{"success":true,"data":[1]}', stderr: '' })).toEqual({ data: [1] })
    expect(
      envelopeOf({ exitCode: 1, stdout: '{"success":false,"error":{"message":"not logged in","hint":"run utils e3p login"}}', stderr: '' }),
    ).toEqual({ error: 'not logged in (run utils e3p login)' })
    expect(envelopeOf({ exitCode: 0, stdout: 'nope', stderr: '' })).toEqual({ error: 'answered something that is not JSON' })
    expect(envelopeOf({ exitCode: 2, stdout: '', stderr: 'a\nTCC denied' })).toEqual({ error: 'exited 2: TCC denied' })
  })

  test('spans read naturally', async () => {
    expect(spanOf(5)).toBe('5m')
    expect(spanOf(60)).toBe('1h')
    expect(spanOf(200)).toBe('3h 20m')
    expect(spanOf(3 * 24 * 60)).toBe('3d')
  })
})
