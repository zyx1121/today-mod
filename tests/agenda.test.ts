import { describe, expect, test, tier } from 'claude-code/testing'

import { scheduleOf, listIdOf, envelopeOf } from '../hooks/agenda'
import { spanOf } from '../hooks/views/text'

tier('user')

describe('agenda', () => {
  test('ISO schedules distinguish local date-only and timed deadlines', async () => {
    expect(scheduleOf({kind:'datetime',at:'2026-09-21T13:20:00+08:00',time_zone:'Asia/Taipei'})).toEqual(new Date('2026-09-21T13:20:00+08:00'))
    expect(scheduleOf({kind:'date',date:'2026-09-21'})).toEqual(new Date(2026,8,21,23,59,59,999))
    expect(scheduleOf({kind:'datetime',at:'invalid'})).toBeNull()
    expect(scheduleOf(null)).toBeNull()
    expect(listIdOf([{id:'one',title:'TODO'}], 'TODO')).toBe('one')
    expect(() => listIdOf([{id:'one',title:'TODO'},{id:'two',title:'TODO'}], 'TODO')).toThrow()
    expect(listIdOf([{id:'one',title:'TODO'},{id:'two',title:'TODO'}], 'two')).toBe('two')
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
