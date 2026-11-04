import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import { BLAST_TICKS, beat, frame, MIN_ROWS, STILL_AGE, STILL_RIDDLE, tripOf } from './scene'
import type { Reading, Riddling, World } from './scene'

const KEY = 'waste-lands'
const HIDDEN = 'isHidden' // Kept across sessions in $.store.
const ROWS = 9
const MIN_COLUMNS = 40
const MAX_COLUMNS = 512 // A Raster's own limit.
const TICK_MS = 66 // Fifteen frames a second is plenty for 8-bit, and cheap.

let reading: Reading | undefined
let world: World = {} // The cost and the 5 hour limit, kept beside the reading.

// Topeka is the end of the window: the model's, or a smaller one the settings ask for. The engine's
// compaction figures won't do: a running session keeps the window it started with, and the threshold
// it reports leaves out CLAUDE_AUTOCOMPACT_PCT_OVERRIDE.
async function measure($: CoreEngineInterface) {
  const { context, rateLimits, cost } = await $.session.usage()
  const limit = (rateLimits ?? []).find(window => window.kind === 'five_hour')
  const resets = limit?.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)
  world = {
    cost: cost?.usd,
    limit: limit?.percentUsed,
    resetMin: Number.isNaN(resets) ? undefined : (resets - (await $.clock.now().catch(() => NaN))) / 60000,
  }
  const window = await $.settings.read({ key: 'autoCompactWindow' })

  if (context.tokens !== undefined) {
    reading = { tokens: context.tokens, topeka: Math.min(context.window, typeof window === 'number' ? window : Infinity) }
    $.ui.invalidate('ui.render')
  }
}

let site: { requestId: string; columns: number; rows: number } | undefined
let t = 0
let tick: Timer | undefined
let isHidden = false
let isTurning = false
let wasAtTopeka = false
let blast: { start: number; trip: number; isStill: boolean } | undefined
let riddling: Riddling | undefined

// The world stops for a blast, and its age counts on from the ticks. A riddling runs on its own clock.
function draw(columns: number, rows: number, isMoving: boolean) {
  if (riddling !== undefined) return frame(columns, rows, t, isMoving, reading, undefined, riddling, world)

  return frame(
    columns,
    rows,
    blast?.start ?? t,
    isMoving && blast === undefined,
    reading,
    blast && { age: blast.isStill ? STILL_AGE : t - blast.start, trip: blast.trip },
    undefined,
    world,
  )
}

function run($: CoreEngineInterface) {
  tick ??= $.clock.every(TICK_MS, () => {
    t += 1
    const isOver = riddling !== undefined && beat(t, riddling) === undefined
    if (isOver) riddling = undefined

    if (site !== undefined) {
      const { requestId, columns, rows } = site
      void $.ui.blit({ requestId, key: KEY, cells: draw(columns, rows, true) })
    }
    if (isOver) rest()
  })
}

function rest() {
  if (!isTurning && blast === undefined && riddling === undefined) {
    tick?.cancel()
    tick = undefined
  }
}

async function explode($: CoreEngineInterface, trip: number) {
  const isStill = Boolean(await $.settings.read({ key: 'prefersReducedMotion' }))

  if (blast !== undefined || riddling !== undefined) return

  blast = { start: t, trip, isStill }
  $.clock.after(BLAST_TICKS * TICK_MS, () => {
    blast = undefined
    rest()
    $.ui.invalidate('ui.render')
  })

  if (!isStill) run($)
  $.ui.invalidate('ui.render')
}

async function stillness($: CoreEngineInterface) {
  return Boolean(await $.settings.read({ key: 'prefersReducedMotion' }).catch(() => false))
}

async function watch($: CoreEngineInterface) {
  await measure($).catch(() => undefined)
  const trip = tripOf(reading)
  const isAtTopeka = trip >= 1

  if (isAtTopeka && !wasAtTopeka) await explode($, trip).catch(() => undefined)
  wasAtTopeka = isAtTopeka
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'blaine', description: 'Show or hide the Blaine train above the prompt' })
    isHidden = (await $.store.get(HIDDEN)) === true
    await watch($) // A reload or a resumed session has a reading already.

    return next(e)
  })

  on('command.run', { command: 'blaine' }, async $ => {
    isHidden = !isHidden
    await $.store.set(HIDDEN, isHidden)
    $.ui.invalidate('ui.render')

    return { text: isHidden ? 'Blaine is parked. /blaine brings him back.' : 'Blaine is back on the rails.' }
  })

  on('session.measure', async ($, e, next) => {
    await watch($)

    return next(e)
  })

  // Each step of a turn may have grown the context, so Blaine moves on as it works.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await watch($)
    }

    return next(e)
  })

  // Every compaction of the conversation, asked for or automatic, is the riddling: riddles while the
  // summary is written, then Eddie's joke, the crash at Topeka, and the next train out of Lud. One a
  // PreCompact hook holds back, or one that fails, just stops; a precompute or a subagent's is not his.
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)

    const isStill = await stillness($)
    const trip = tripOf(reading)
    const at = isStill ? t - STILL_RIDDLE : t
    riddling = { at, trip }
    if (!isStill) run($)
    $.ui.invalidate('ui.render')

    try {
      const result = await next(e)
      if (result.messages !== undefined) {
        reading = reading && { ...reading, tokens: result.tokensAfter ?? 0 }
        riddling = isStill ? undefined : { at, trip, doneAt: t, before: result.tokensBefore, after: result.tokensAfter }
        if (isStill) await explode($, 1).catch(() => undefined) // The blast's one frame in place of the ride.
      }

      return result
    } finally {
      if (riddling?.doneAt === undefined) riddling = undefined
      rest()
      $.ui.invalidate('ui.render')
    }
  }).catch(($, e, next) => next(e)) // Replays the compaction's own outcome; it never runs twice.

  on('turn.start', async ($, e, next) => {
    const isStill = await $.settings.read({ key: 'prefersReducedMotion' })

    if (e.agentId === undefined) {
      isTurning = true

      if (!isStill) run($)
    }

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      isTurning = false
      rest()
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
        <Raster key={KEY} columns={columns} rows={rows} cells={draw(columns, rows, e.props.isWorking)} />
      </Box>
    )
  })
}
