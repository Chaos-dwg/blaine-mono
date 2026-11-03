import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import { frame, IDLE_GAP, MIN_ROWS, SHOT_TICKS } from './scene'
import type { Reading, Shot } from './scene'

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

export const register: Register = on => {
  let site: { requestId: string; columns: number; rows: number } | undefined
  let t = 0
  let tick: Timer | undefined
  let isHidden = false
  let shot: Shot | undefined
  let lastDraw = 0

  // One draw at a time, and only while the scene is moving.
  const draw = (kind: Shot['kind']) => {
    if (tick !== undefined && (shot === undefined || t - shot.at >= SHOT_TICKS)) {
      shot = { at: t, kind }
      lastDraw = t
    }
  }

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
    const isStill = await $.settings.read({ key: 'prefersReducedMotion' })

    if (e.agentId === undefined && tick === undefined && !isStill) {
      lastDraw = t
      tick = $.clock.every(TICK_MS, () => {
        t += 1
        if (t - lastDraw >= IDLE_GAP) draw('idle')

        if (site !== undefined) {
          const { requestId, columns, rows } = site
          void $.ui.blit({ requestId, key: KEY, cells: frame(columns, rows, t, true, reading, shot) })
        }
      })
    }

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      tick?.cancel()
      tick = undefined
      shot = undefined // He holsters when the turn ends; isWorking turning false redraws the band.
    }

    return next(e)
  })

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
        <Raster key={KEY} columns={columns} rows={rows} cells={frame(columns, rows, t, e.props.isWorking, reading, shot)} />
      </Box>
    )
  })
}
