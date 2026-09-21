import type { EngineInterface, On, PluginOptions, Timer } from 'claude-code'

import { agendaOf, argvOf, pathOf, READ_TIMEOUT_MS, SOURCES, type Agenda, type Run, type Source } from './agenda'
import { bandView } from './views/band-view'
import { agendaTextOf } from './views/text'

export const COMMAND_NAME = 'today'
export const CONTEXT_BLOCK = 'today'
export const DEFAULT_REFRESH_MS = 300000
export const MIN_REFRESH_MS = 60000
export const TICK_MS = 60000
export const DEFAULT_SCRIPTS_DIR =
  '/Users/loki/Library/Mobile Documents/com~apple~CloudDocs/Projects/zyx1121/plugin/utils/scripts'
export const STORE_SHOWN_KEY = 'shown'
export const SHOWN_TEXT = 'Today shown above the prompt'
export const HIDDEN_TEXT = 'Today hidden'
export const NOT_READ_TEXT = 'Today has not been read yet; try again in a moment'

/** How long `prompt.context` waits for a first read still in flight. */
export const CONTEXT_WAIT_MS = 8000

type Settings = {
  scriptsDir: string
  refreshMs: number
  dueDays: number
  remindersList: string
  showOnStart: boolean
}

/**
 * The settings the options ask for, defaults filled in and floors applied.
 *
 * @param options the plugin's userConfig values
 * @returns the settings
 */
export function settingsOf(options: PluginOptions): Settings {
  const refreshMs = options.refreshMs

  return {
    scriptsDir: typeof options.scriptsDir === 'string' && options.scriptsDir !== '' ? options.scriptsDir : DEFAULT_SCRIPTS_DIR,
    refreshMs:
      typeof refreshMs === 'number' && Number.isFinite(refreshMs) ? Math.max(MIN_REFRESH_MS, Math.floor(refreshMs)) : DEFAULT_REFRESH_MS,
    dueDays: typeof options.dueDays === 'number' && options.dueDays > 0 ? Math.floor(options.dueDays) : 7,
    remindersList: typeof options.remindersList === 'string' && options.remindersList !== '' ? options.remindersList : 'TODO',
    showOnStart: options.showOnStart !== false,
  }
}

/**
 * Whether the band shows at a session's start: the last /today choice the
 * store kept, else `showOnStart`.
 *
 * @param kept what the store holds under STORE_SHOWN_KEY
 * @param settings the settings
 * @returns whether to show
 */
export function isShownAtStart(kept: unknown, settings: Settings): boolean {
  return typeof kept === 'boolean' ? kept : settings.showOnStart
}

type Host = {
  run: (argv: readonly string[], init: { timeoutMs: number; env: Record<string, string> }) => Promise<Run>
  home: () => Promise<string | undefined>
  now: () => Promise<number>
  invalidate: (event: 'ui.render' | 'prompt.context') => void
  every: (ms: number, fn: () => void) => Timer
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
}

/**
 * The engine calls the band needs, taken off `$`.
 *
 * @param $ the engine
 * @returns the host
 */
function hostOf($: EngineInterface): Host {
  return {
    run: (argv, init) => $.process.run(argv, init),
    home: () => $.env.get('HOME'),
    now: () => $.clock.now(),
    invalidate: event => $.ui.invalidate(event),
    every: (ms, fn) => $.clock.every(ms, fn),
    storeGet: key => $.store.get(key),
    storeSet: (key, value) => $.store.set(key, value),
  }
}

/**
 * The Today band and context: on an interactive start the mod reads the
 * three sources, draws the next event above the prompt, re-reads on a timer,
 * ticks the countdown every minute, answers /today with the whole agenda and
 * adds a `today` block to the conversation's context.
 *
 * @param on the engine's hook registrar
 * @param options the plugin's userConfig values
 */
export function register(on: On, options: PluginOptions): void {
  const settings = settingsOf(options)

  let agenda: Agenda | null = null
  let reading: Promise<void> | null = null
  let refresh: Timer | null = null
  let tick: Timer | null = null
  let isShown = false
  let host: Host | null = null

  async function read(engine: Host): Promise<void> {
    if (reading) {
      return reading
    }

    reading = (async () => {
      const home = (await engine.home().catch(() => undefined)) ?? '/Users/loki'
      const env = { PATH: pathOf(home), HOME: home }
      const now = new Date(await engine.now())
      const runs = {} as Record<Source, Run | Error>

      await Promise.all(
        SOURCES.map(async source => {
          runs[source] = await engine
            .run(argvOf(source, settings.scriptsDir, now, settings), { timeoutMs: READ_TIMEOUT_MS, env })
            .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))))
        }),
      )

      agenda = agendaOf(runs, await engine.now())
      engine.invalidate('ui.render')
      engine.invalidate('prompt.context')
    })().finally(() => {
      reading = null
    })

    return reading
  }

  function start(engine: Host): void {
    host = engine
    refresh?.cancel()
    tick?.cancel()
    refresh = engine.every(settings.refreshMs, () => {
      void read(engine)
    })
    tick = engine.every(TICK_MS, () => {
      if (isShown) {
        engine.invalidate('ui.render')
      }
    })
  }

  function stop(): void {
    refresh?.cancel()
    tick?.cancel()
    refresh = null
    tick = null
  }

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND_NAME,
        description: "Today's calendar, E3 deadlines and Reminders; `on` or `off` shows or hides the line above the prompt",
        argumentHint: '[on|off]',
      })
    } catch (error) {
      $.ui.log(`/${COMMAND_NAME} did not register: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (e.isInteractive && e.surface === 'terminal') {
      const engine = hostOf($)
      const kept = await engine.storeGet(STORE_SHOWN_KEY).catch(() => undefined)

      isShown = isShownAtStart(kept, settings)
      start(engine)
      void read(engine)
    }

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($, e) => {
    const engine = hostOf($)
    const want = e.args.trim().toLowerCase()

    if (want === 'on' || want === 'off') {
      isShown = want === 'on'

      if (isShown && host === null) {
        start(engine)
        void read(engine)
      }

      engine.invalidate('ui.render')
      await engine.storeSet(STORE_SHOWN_KEY, isShown).catch(() => undefined)

      return { text: isShown ? SHOWN_TEXT : HIDDEN_TEXT }
    }

    if (host === null) {
      start(engine)
    }

    await read(engine)

    return { text: agenda ? agendaTextOf(agenda, new Date(await engine.now())) : NOT_READ_TEXT }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isShown || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return bandView({ Box, Text }, agenda, new Date(await $.clock.now()))
  })

  on('prompt.context', async ($, e, next) => {
    if (agenda === null && reading) {
      await Promise.race([reading, $.clock.sleep(CONTEXT_WAIT_MS)]).catch(() => undefined)
    }

    const below = await next(e)

    if (agenda === null) {
      return below
    }

    const text = agendaTextOf(agenda, new Date(await $.clock.now()))

    return {
      ...below,
      blocks: [...below.blocks.filter(block => block.name !== CONTEXT_BLOCK), { name: CONTEXT_BLOCK, text }],
    }
  })

  on('session.end', ($, e, next) => {
    stop()

    return next(e)
  })
}
