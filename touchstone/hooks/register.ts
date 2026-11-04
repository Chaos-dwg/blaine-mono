import type { CoreEngineInterface, Register } from 'claude-code'

import { note, ownerWords, PATCH_FILE_CAP, projectName, reminder, SECRETISH } from './facts'
import type { Facts } from './facts'

const MARK = 70 // Percent of the context window where the facts are written once, ahead of any compaction.
const MAX_UNTRACKED = 200

type Words = readonly { role: string; text: string; toolResults?: readonly unknown[] }[]

// What the next compaction's model should be reminded of; kept for the rest of the session.
let pending: { facts: Facts; file: string; patch?: string } | undefined
let isMarked = false

async function run($: CoreEngineInterface, cwd: string, argv: string[]) {
  try {
    return await $.process.run(['git', ...argv], { cwd })
  } catch {
    return { exitCode: 127, stdout: '', stderr: '' }
  }
}

async function git($: CoreEngineInterface, cwd: string, ...argv: string[]) {
  const { exitCode, stdout } = await run($, cwd, argv)

  return exitCode === 0 ? stdout.trim() : undefined
}

// The whole uncommitted work as a patch: tracked changes, then each untracked file as a new one.
async function patchOf($: CoreEngineInterface, root: string, dirty: string[]) {
  const skipped: string[] = []
  const parts: string[] = [(await run($, root, ['diff', 'HEAD', '--', '.', ':(exclude).claude'])).stdout]
  const untracked = dirty.filter(line => line.startsWith('?? ')).map(line => line.slice(3).replace(/^"|"$/g, ''))

  for (const [i, file] of untracked.entries()) {
    if (file.startsWith('.claude/')) continue
    if (i >= MAX_UNTRACKED) skipped.push(`${file}: past ${MAX_UNTRACKED} files`)
    else if (SECRETISH.test(file)) skipped.push(`${file}: the name looks like a secret`)
    else {
      const { stdout } = await run($, root, ['diff', '--no-index', '--', '/dev/null', file]) // Exit 1 means it differs.
      if (stdout.length > PATCH_FILE_CAP) skipped.push(`${file}: over ${PATCH_FILE_CAP / 1000} KB`)
      else parts.push(stdout)
    }
  }
  return { text: parts.join(''), skipped }
}

// Read what is true now, write it beside the other handoffs, and remember it if the model should hear of it.
async function keep($: CoreEngineInterface, trigger: string, said: Words | undefined, remember: boolean, tokens?: number) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (home === undefined) return undefined

  const cwd = await $.session.cwd()
  const session = await $.session.id()
  const at = new Date(await $.clock.now()).toISOString()
  const root = await git($, cwd, 'rev-parse', '--show-toplevel')
  const name = projectName(root ?? cwd)
  const messages = said ?? (await $.session.messages().catch(() => []))
  const facts: Facts = { at, trigger, session, cwd, root, dirty: [], skipped: [], words: ownerWords(Array.isArray(messages) ? messages : []), tokens }
  const dir = `${home}\\.claude\\handoffs\\touchstone`
  let patch: string | undefined

  if (root !== undefined) {
    facts.branch = await git($, root, 'rev-parse', '--abbrev-ref', 'HEAD')
    facts.head = await git($, root, 'rev-parse', '--short', 'HEAD')
    facts.upstream = await git($, root, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
    const counts = facts.upstream && (await git($, root, 'rev-list', '--left-right', '--count', 'HEAD...@{u}'))?.split(/\s+/)
    if (counts) [facts.ahead, facts.behind] = counts.map(Number)
    facts.dirty = ((await git($, root, 'status', '--porcelain=v1', '-uall')) ?? '').split('\n').filter(line => line !== '' && !line.slice(3).startsWith('.claude/'))

    if (facts.dirty.length > 0) {
      const made = await patchOf($, root, facts.dirty)
      patch = `${dir}\\${name}__${session}.patch`
      facts.skipped = made.skipped
      await $.fs.write(patch, made.text)
    }
  }

  const preserve = `${home}\\.claude\\handoffs\\preserve\\${name}.md`
  const stat = await $.fs.stat(preserve).catch(() => undefined)
  if (stat !== undefined) {
    const since = root === undefined ? undefined : await git($, root, 'rev-list', '--count', `--since=${new Date(stat.mtimeMs).toISOString()}`, 'HEAD')
    facts.note = { path: preserve, at: new Date(stat.mtimeMs).toISOString(), commitsSince: since === undefined ? undefined : Number(since) }
  }

  const file = `${dir}\\${name}__${session}.md`
  await $.fs.write(file, note(facts, patch))
  if (remember) pending = { facts, file, patch }
  $.ui.toast(`Touchstone: facts saved (${facts.dirty.length} uncommitted)`)

  return { facts, file, patch }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'touchstone', description: 'Save the facts of this session (git, patch, your last words) beside the handoffs' })

    return next(e)
  })

  on('command.run', { command: 'touchstone' }, async $ => {
    const kept = await keep($, 'manual', undefined, true).catch(() => undefined)

    return {
      text:
        kept === undefined
          ? 'Touchstone could not write its facts.'
          : `Touchstone wrote ${kept.file}${kept.patch === undefined ? '' : `\nand the patch ${kept.patch}`}\n${kept.facts.dirty.length} uncommitted, ${kept.facts.words.length} of your last words kept.`,
    }
  })

  // Past the mark the facts are written once, in case the compaction comes without warning.
  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent ?? 0
    if (percent >= MARK && !isMarked) {
      isMarked = true
      await keep($, 'measure', undefined, false, e.context.tokens).catch(() => undefined)
    } else if (percent < MARK - 10) {
      isMarked = false // A compaction brought it down; the next climb writes again.
    }

    return next(e)
  })

  // Every compaction of the main conversation: facts first, then the compaction as it would have run.
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)

    await keep($, e.trigger, e.messages, true).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e)) // Replays the compaction's own outcome; it never runs twice.

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (pending === undefined) return composed

    return { ...composed, sections: [...composed.sections, { id: 'touchstone', text: reminder(pending.facts, pending.file, pending.patch), scope: 'session' as const }] }
  })
}
