import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import { frame, IDLE_GAP, MIN_ROWS, SHOT_TICKS, WAKE_TICKS, wakeAt } from './scene'
import type { Palaver, Reading, Shot } from './scene'

const KEY = 'mohaine'
const HIDDEN = 'isHidden' // Kept across sessions in $.store.
const ROWS = 9
const MIN_COLUMNS = 40
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 66

let reading: Reading | undefined
let compaction: { window: number; tokens: number } | undefined

// The reading blaine-mono takes: the plain usage is free; the compaction point is asked once per window size.
async function measure($: CoreEngineInterface) {
  const { context } = await $.session.usage()

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

// The band's state lives with the module, as `reading` does; a reload starts it over.
let site: { requestId: string; columns: number; rows: number } | undefined
let t = 0
let tick: Timer | undefined
let isHidden = false
let shot: Shot | undefined
let lastDraw = 0
let isTurn = false
let palaver: Palaver | undefined

// One draw at a time, only while he walks: never at the golgotha.
function draw(kind: Shot['kind']) {
  if (isTurn && tick !== undefined && palaver === undefined && (shot === undefined || t - shot.at >= SHOT_TICKS)) {
    shot = { at: t, kind }
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
    if (isTurn && t - lastDraw >= IDLE_GAP) draw('idle')
    if (palaver && t >= (wakeAt(palaver) ?? Infinity) + WAKE_TICKS) palaver = undefined

    if (site !== undefined) {
      const { requestId, columns, rows } = site
      void $.ui.blit({ requestId, key: KEY, cells: frame(columns, rows, t, isTurn, reading, shot, palaver) })
    }
    if (!isTurn && palaver === undefined) stop()
  })
}

async function isStill($: CoreEngineInterface) {
  return Boolean(await $.settings.read({ key: 'prefersReducedMotion' }).catch(() => false))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'gunslinger', description: 'Show or hide the gunslinger above the prompt' })
    isHidden = (await $.store.get(HIDDEN)) === true
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
      if (palaver === undefined) stop()
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
      if (palaver === undefined && !isTurn) stop()
      $.ui.invalidate('ui.render')
    }
  }).catch(($, e, next) => next(e)) // Replays the compaction's own outcome; it never runs twice.

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = Math.min(ROWS, e.props.maxRows)
    const columns = Math.min(MAX_COLUMNS, e.props.bodyColumns)

    if (isHidden || e.surface !== 'terminal' || e.props.hasSurvey || rows < MIN_ROWS || columns < MIN_COLUMNS) {
      site = undefined

      return next(e)
    }

    site = { requestId: e.requestId, columns, rows }
    const { Box, Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {await next(e)}
        <Raster
          key={KEY}
          columns={columns}
          rows={rows}
          cells={frame(columns, rows, t, e.props.isWorking, reading, shot, palaver)}
        />
      </Box>
    )
  })
}
