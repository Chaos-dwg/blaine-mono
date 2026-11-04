import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import { FLARE_TICKS, foesFor, frame, IDLE_GAP, MIN_ROWS, shotEnds, WAKE_TICKS, wakeAt } from './scene'
import type { Palaver, Reading, Shot, World } from './scene'
import { verb, verse } from './voice'

const KEY = 'mohaine'
const HIDDEN = 'isHidden' // Kept across sessions in $.store.
const ROWS = 9
const MIN_COLUMNS = 40
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 66

let reading: Reading | undefined
let world: World = {} // The hour, the session's cost and the 5 hour limit, kept beside the reading.
let flareAt: number | undefined // The tick the 5 hour limit last reset.
let lastLimit: number | undefined
let compaction: { window: number; tokens: number } | undefined

// The reading blaine-mono takes: the plain usage is free; the compaction point is asked once per window size.
async function measure($: CoreEngineInterface) {
  const { context, rateLimits, cost } = await $.session.usage()
  world = { ...world, cost: cost?.usd, limit: (rateLimits ?? []).find(limit => limit.kind === 'five_hour')?.percentUsed }
  // A limit that drops by a tenth or more has reset: the fire flares.
  if (lastLimit !== undefined && world.limit !== undefined && world.limit <= lastLimit - 10 && !(await isStill($))) {
    flareAt = t
    run($)
  }
  lastLimit = world.limit

  if (compaction?.window !== context.window) {
    const { breakdown } = (await $.session.usage({ breakdown: 'summary' })).context
    // No breakdown comes back before a session is bound: ask again next time.
    compaction = breakdown && { window: context.window, tokens: breakdown.autoCompactThreshold ?? context.window }
  }

  if (context.tokens !== undefined) {
    reading = { tokens: context.tokens, window: context.window, compactAt: compaction?.tokens ?? context.window }
    $.ui.invalidate('ui.render')
  }
}

// The hour on this machine's clock, which is where he sits down for the night and gets up.
async function tock($: CoreEngineInterface) {
  const now = new Date(await $.clock.now())
  world = { ...world, hour: now.getHours() + now.getMinutes() / 60 }
}

// The band's state lives with the module, as `reading` does; a reload starts it over.
let site: { requestId: string; columns: number; rows: number } | undefined
let t = 0
let tick: Timer | undefined
let isHidden = false
let shot: Shot | undefined
let lastDraw = 0
let isTurn = false
let palaver: Palaver | undefined

const isFlaring = () => flareAt !== undefined && t - flareAt < FLARE_TICKS
const sky = (): World => ({ ...world, flare: isFlaring() ? t - (flareAt ?? t) : undefined })

// One draw at a time, only while he walks: never at the golgotha.
function draw(kind: Shot['kind']) {
  if (isTurn && tick !== undefined && palaver === undefined && (shot === undefined || t - shot.at >= shotEnds(shot))) {
    shot = { at: t, kind, foes: foesFor(world.limit) }
    lastDraw = t
  }
}

function stop() {
  tick?.cancel()
  tick = undefined
}

// The clock runs through a turn and through a palaver, whichever lasts longer.
function run($: CoreEngineInterface) {
  tick ??= $.clock.every(TICK_MS, () => {
    t += 1
    if (isTurn && t - lastDraw >= ((world.limit ?? 0) >= 80 ? IDLE_GAP / 2 : IDLE_GAP)) draw('idle') // Pressed hard, more come.
    if (t % 900 === 0) void tock($).catch(() => undefined) // The sun keeps going down while he works.
    if (palaver && verse(t, palaver) !== verse(t - 1, palaver)) $.ui.invalidate('ui.render') // The spinner's next line.
    if (palaver && t >= (wakeAt(palaver) ?? Infinity) + WAKE_TICKS) {
      palaver = undefined
      $.ui.invalidate('ui.render')
    }

    if (site !== undefined) {
      const { requestId, columns, rows } = site
      void $.ui.blit({ requestId, key: KEY, cells: frame(columns, rows, t, isTurn, reading, shot, palaver, sky()) })
    }
    if (!isTurn && palaver === undefined && !isFlaring()) stop()
  })
}

async function isStill($: CoreEngineInterface) {
  return Boolean(await $.settings.read({ key: 'prefersReducedMotion' }).catch(() => false))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'gunslinger', description: 'Show or hide the gunslinger above the prompt' })
    isHidden = (await $.store.get(HIDDEN)) === true
    await tock($).catch(() => undefined)
    await measure($).catch(() => undefined) // A reload or a resumed session has a reading already.

    return next(e)
  })

  on('command.run', { command: 'gunslinger' }, async $ => {
    isHidden = !isHidden
    await $.store.set(HIDDEN, isHidden)
    $.ui.invalidate('ui.render')

    return {
      text: isHidden
        ? 'Roland makes camp. /gunslinger puts him back on the trail.'
        : 'The man in black fled across the desert, and the gunslinger followed.',
    }
  })

  on('session.measure', async ($, e, next) => {
    await measure($).catch(() => undefined)

    return next(e)
  })

  // Each step of a turn may grow the context; a step that errors brings a slow mutant for Roland to drop.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await measure($).catch(() => undefined)
    }

    const result = await next(e)
    if (result.isError) draw('error')

    return result
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      isTurn = true
      lastDraw = t
      if (!(await isStill($))) run($)
    }

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      isTurn = false
      shot = undefined // He holsters when the turn ends; isWorking turning false redraws the band.
      if (palaver === undefined && !isFlaring()) stop()
    }

    return next(e)
  })

  // A compaction is the palaver at the golgotha: the man in black reads the cards while the
  // summary is written. One that stands ends in the long night and dawn over his bones.
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)

    const at = t
    palaver = { at }
    if (!(await isStill($))) run($)
    $.ui.invalidate('ui.render')

    try {
      const result = await next(e)
      palaver = result.messages !== undefined && tick !== undefined ? { at, doneAt: t } : undefined
      await measure($).catch(() => undefined)

      return result
    } finally {
      if (palaver?.doneAt === undefined) palaver = undefined // Skipped, failed, or held still.
      if (palaver === undefined && !isTurn && !isFlaring()) stop()
      $.ui.invalidate('ui.render')
    }
  }).catch(($, e, next) => next(e)) // Replays the compaction's own outcome; it never runs twice.

  // While his band shows, the spinner speaks for Roland: his verbs on the trail, the verse at the golgotha.
  // Parked or too small to draw, he leaves the engine's words alone, and so the Blaine set in settings.json.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (isHidden || site === undefined || e.surface !== 'terminal') return next(e)

    if (palaver !== undefined) {
      const line = verse(t, palaver)

      return next({ ...e, props: { ...e.props, word: line, message: e.props.message === null ? null : line } })
    }

    return next({ ...e, props: { ...e.props, word: verb(e.props.word) } }) // A message the engine set still shows.
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = Math.min(ROWS, e.props.maxRows)
    const columns = Math.min(MAX_COLUMNS, e.props.bodyColumns)

    if (isHidden || e.surface !== 'terminal' || e.props.hasSurvey || rows < MIN_ROWS || columns < MIN_COLUMNS) {
      site = undefined

      return next(e)
    }

    site = { requestId: e.requestId, columns, rows }
    await tock($).catch(() => undefined)
    const { Box, Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {await next(e)}
        <Raster
          key={KEY}
          columns={columns}
          rows={rows}
          cells={frame(columns, rows, t, e.props.isWorking, reading, shot, palaver, sky())}
        />
      </Box>
    )
  })
}
