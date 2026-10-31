import type { Register, Timer } from 'claude-code'

import { frame, MIN_ROWS } from './scene'

const KEY = 'waste-lands'
const HIDDEN = 'isHidden' // Kept across sessions in $.store.
const ROWS = 9
const MIN_COLUMNS = 40
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 66 // Fifteen frames a second is plenty for 8-bit, and cheap.

export const register: Register = on => {
  let site: { requestId: string; columns: number; rows: number } | undefined
  let t = 0
  let tick: Timer | undefined
  let isHidden = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'blaine', description: 'Show or hide the Blaine train above the prompt' })
    isHidden = (await $.store.get(HIDDEN)) === true

    return next(e)
  })

  on('command.run', { command: 'blaine' }, async $ => {
    isHidden = !isHidden
    await $.store.set(HIDDEN, isHidden)
    $.ui.invalidate('ui.render')

    return { text: isHidden ? 'Blaine is parked. /blaine brings him back.' : 'Blaine is back on the rails.' }
  })

  on('turn.start', async ($, e, next) => {
    const isStill = await $.settings.read({ key: 'prefersReducedMotion' })

    if (e.agentId === undefined && tick === undefined && !isStill) {
      tick = $.clock.every(TICK_MS, () => {
        t += 1

        if (site !== undefined) {
          const { requestId, columns, rows } = site
          void $.ui.blit({ requestId, key: KEY, cells: frame(columns, rows, t, true) })
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
        <Raster key={KEY} columns={columns} rows={rows} cells={frame(columns, rows, t, e.props.isWorking)} />
      </Box>
    )
  })
}
