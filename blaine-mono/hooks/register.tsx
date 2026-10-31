import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import { frame, MIN_ROWS } from './scene'
import type { Reading } from './scene'

const KEY = 'waste-lands'
const HIDDEN = 'isHidden' // Kept across sessions in $.store.
const ROWS = 9
const MIN_COLUMNS = 40
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 66 // Fifteen frames a second is plenty for 8-bit, and cheap.

let reading: Reading | undefined
let topeka: { window: number; tokens: number } | undefined

// The plain reading is free; the compaction point is estimated locally, once per window size.
async function measure($: CoreEngineInterface) {
  const { context } = await $.session.usage()

  if (topeka?.window !== context.window) {
    const { breakdown } = (await $.session.usage({ breakdown: 'summary' })).context
    // No breakdown comes back before a session is bound: ask again next time.
    topeka = breakdown && { window: context.window, tokens: breakdown.autoCompactThreshold ?? context.window }
  }

  if (context.tokens !== undefined) {
    reading = { tokens: context.tokens, topeka: topeka?.tokens ?? context.window }
    $.ui.invalidate('ui.render')
  }
}

export const register: Register = on => {
  let site: { requestId: string; columns: number; rows: number } | undefined
  let t = 0
  let tick: Timer | undefined
  let isHidden = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'blaine', description: 'Show or hide the Blaine train above the prompt' })
    isHidden = (await $.store.get(HIDDEN)) === true
    await measure($).catch(() => undefined) // A reload or a resumed session has a reading already.

    return next(e)
  })

  on('command.run', { command: 'blaine' }, async $ => {
    isHidden = !isHidden
    await $.store.set(HIDDEN, isHidden)
    $.ui.invalidate('ui.render')

    return { text: isHidden ? 'Blaine is parked. /blaine brings him back.' : 'Blaine is back on the rails.' }
  })

  on('session.measure', async ($, e, next) => {
    await measure($).catch(() => undefined)

    return next(e)
  })

  // Each step of a turn may have grown the context, so Blaine moves on as it works.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await measure($).catch(() => undefined)
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const isStill = await $.settings.read({ key: 'prefersReducedMotion' })

    if (e.agentId === undefined && tick === undefined && !isStill) {
      tick = $.clock.every(TICK_MS, () => {
        t += 1

        if (site !== undefined) {
          const { requestId, columns, rows } = site
          void $.ui.blit({ requestId, key: KEY, cells: frame(columns, rows, t, true, reading) })
        }
      })
    }

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      tick?.cancel()
      tick = undefined
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
        <Raster key={KEY} columns={columns} rows={rows} cells={frame(columns, rows, t, e.props.isWorking, reading)} />
      </Box>
    )
  })
}
