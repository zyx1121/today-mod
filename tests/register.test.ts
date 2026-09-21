import { describe, expect, test, tier } from 'claude-code/testing'

import * as Fixtures from './fixtures'

tier('user')

describe('register', () => {
  test('an interactive start reads the three sources and draws the next event', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    const scripts = world.runs.map(run => run.argv[0]?.split('/').at(-1)).sort()

    expect(scripts).toEqual(['calendar.py', 'e3p.py', 'reminders.py'])
    expect(world.runs.every(run => run.init?.env?.PATH?.startsWith('/opt/homebrew/bin')), 'uv is on the child PATH').toBe(true)

    const calendar = world.runs.find(run => run.argv[0]?.endsWith('calendar.py'))

    expect(calendar?.argv.slice(1)).toEqual(['list', '--from', '2026-09-21T00:00', '--to', '2026-09-21T23:59', '--limit', '50'])

    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toBe(
      '📅 13:20 3D遊戲程式 · ED102 · in 3h 20m  📝 1 due (1 within 3d)  ☑ 1 overdue',
    )
  })

  test('during an event the band says now; after the last one it says so', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    await world.clock.advance(4 * 60 * 60 * 1000) // 14:00
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toContain('📅 13:20 3D遊戲程式 · ED102 · now')

    await world.clock.advance(4 * 60 * 60 * 1000) // 18:00
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toContain('📅 no more events today')
  })

  test('/today answers with the whole agenda as Markdown', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    const { text } = await $.command.run(Fixtures.today())

    expect(text).toContain('Today is Mon 2026-09-21, now 10:00')
    expect(text).toContain('- 13:20 3D遊戲程式 (ED102)')
    expect(text).toContain('- 15:30 Lab Meetings (EC411)')
    expect(text).toContain('- Wed 09-23 23:59 HW1 [1151.535654]')
    expect(text).toContain('- Sun 09-20 18:00 Reply to advisor')
    expect(text).toContain('- Buy filament')
    expect(text).not.toContain('Old thing')
  })

  test('the first user message carries a today block', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    const { blocks } = await $.prompt.context({ blocks: [{ name: 'currentDate', text: '2026-09-21' }], instructionFiles: [] })

    expect(blocks.map(block => block.name)).toEqual(['currentDate', 'today'])
    expect(blocks[1]?.text).toContain('- 13:20 3D遊戲程式 (ED102)')
  })

  test('/today off hides the band and remembers; a later start stays hidden', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    expect(await $.command.run(Fixtures.today('off'))).toEqual({ text: 'Today hidden' })
    expect(world.stored.shown).toBe(false)
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')

    expect(await $.command.run(Fixtures.today('on'))).toEqual({ text: 'Today shown above the prompt' })
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toContain('📅 13:20')
  })

  test('a start the person hid draws nothing but still reads, for the context', async ($, on) => {
    const world = Fixtures.world(on, undefined, { shown: false })

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    expect(world.runs.length).toBe(3)
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')

    const { blocks } = await $.prompt.context({ blocks: [], instructionFiles: [] })

    expect(blocks.map(block => block.name)).toEqual(['today'])
  })

  test('a source that fails is reported, the others still show', async ($, on) => {
    const world = Fixtures.world(on, {
      'calendar.py': { exitCode: 0, stdout: Fixtures.CALENDAR, stderr: '' },
      'reminders.py': { exitCode: 0, stdout: Fixtures.EMPTY, stderr: '' },
      'e3p.py': Fixtures.E3P_LOGGED_OUT,
    })

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.BAND))

    expect(drawn).toContain('📅 13:20 3D遊戲程式')
    expect(drawn).toContain('⚠️ 1 source failed')

    const { text } = await $.command.run(Fixtures.today())

    expect(text).toContain('- e3p: not logged in (run utils e3p login)')
  })

  test('the sources are re-read on the refresh timer', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()

    expect(world.runs.length).toBe(3)

    await world.clock.advance(5 * 60 * 1000)

    expect(world.runs.length).toBe(6)
  })

  test('a non-interactive start reads nothing', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start({ ...Fixtures.SESSION, isInteractive: false })
    await world.clock.settle()

    expect(world.runs).toEqual([])
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')
  })

  test('the session ending stops the timers', async ($, on) => {
    const world = Fixtures.world(on)

    on('session.end', ($, e) => ({ sessionId: e.sessionId }))
    await $.session.start(Fixtures.SESSION)
    await world.clock.settle()
    await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } })
    await world.clock.advance(60 * 60 * 1000)

    expect(world.runs.length).toBe(3)
  })
})
