import { expect, mock, test } from 'claude-code/testing'

import { isStale, note, ownerWords, projectName, reminder, SECRETISH, staleness } from './facts'
import type { Facts } from './facts'

type On = Parameters<Parameters<typeof test>[1]>[1]

// The input of a system prompt's composition, whole as a test's call must have it.
const COMPOSE = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const

const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 4, 12)
const FOLDER = 'C:\\Users\\bob\\.claude\\handoffs'
const SUMMARY = [{ role: 'user' as const, text: 'the story so far', toolUses: [] }]
const SAID = [
  { role: 'user' as const, text: 'push it', toolUses: [] },
  { role: 'assistant' as const, text: 'Pushed.', toolUses: [] },
  { role: 'user' as const, text: 'do both', toolUses: [] },
]

type World = { repo?: boolean; noteAgeDays?: number; fail?: string[]; writeFails?: boolean }

// The machine beneath the mod: git answers by its arguments, and files land in a map.
function machine(on: On, { repo = true, noteAgeDays = 5, fail = [], writeFails = false }: World = {}) {
  const files = new Map<string, string>()
  const order: string[] = []
  const git: Record<string, string> = {
    'rev-parse --show-toplevel': 'C:/work/proj',
    'rev-parse --abbrev-ref HEAD': 'main',
    'rev-parse --short HEAD': 'abc1234',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/main',
    'rev-list --left-right --count HEAD...@{u}': '2\t1',
    'status --porcelain=v1 -uall': ' M a.ts\n?? new.ts\n?? .env\n?? .claude/x.json',
    'diff HEAD -- . :(exclude).claude': 'DIFF-A\n',
    'diff --no-index -- /dev/null new.ts': 'DIFF-NEW\n',
    'diff --no-index -- /dev/null .env': 'DIFF-SECRET\n',
  }

  on('env.get', (_, e) => ({ value: e.name === 'USERPROFILE' ? 'C:\\Users\\bob' : undefined }))
  on('session.cwd', () => ({ value: 'C:\\work\\proj' }))
  on('session.id', () => ({ value: 'sid1' }))
  on('session.messages', () => ({ value: SAID }))
  on('process.run', (_, e) => {
    const key = e.argv.slice(1).join(' ')
    if (!repo || fail.includes(key)) return { value: { exitCode: 128, stdout: '', stderr: 'fatal' } }
    if (key.startsWith('rev-list --count --since=')) return { value: { exitCode: 0, stdout: '4\n', stderr: '' } }

    return { value: { exitCode: key.startsWith('diff --no-index') ? 1 : 0, stdout: git[key] ?? '', stderr: '' } }
  })
  on('fs.stat', (_, e) => {
    if (!e.path.endsWith('proj.md')) throw new Error('no such file')

    return { value: { kind: 'file' as const, size: 9, mtimeMs: NOW - noteAgeDays * DAY, isLink: false } }
  })
  on('fs.write', (_, e) => {
    order.push(`write ${e.path}`)
    if (writeFails) throw new Error('disk full')
    files.set(e.path, e.text)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'touchstone' } }))
  on('prompt.compose', () => ({ sections: [] }))
  on('session.measure', () => ({ changed: ['context' as const] }))

  return { files, order, file: `${FOLDER}\\touchstone\\proj__sid1.md`, patch: `${FOLDER}\\touchstone\\proj__sid1.patch` }
}

const FACTS: Facts = {
  at: new Date(NOW).toISOString(),
  trigger: 'auto',
  session: 's',
  cwd: 'C:\\w',
  root: 'C:/w',
  branch: 'main',
  head: 'abc1234',
  dirty: [' M a.ts'],
  skipped: [],
  words: ['push it'],
}

test('a project is named as the context guard names it, so both find the same note', () => {
  expect(projectName('F:\\RogueEQ')).toBe('RogueEQ')
  expect(projectName('F:\\RoGuEdEx\\Clean_App\\.claude\\worktrees\\visual-spike')).toBe('Clean_App-visual-spike')
  expect(projectName('C:/Users/Bkakk/BLAINE_PROTOCOL')).toBe('BLAINE_PROTOCOL')
  expect(projectName('C:\\')).toBe('session')
})

test('his last words are what he typed: not tool results, engine notices, or more than eight', () => {
  const user = (text: string, toolResults?: unknown[]) => ({ role: 'user', text, toolResults })
  const long = 'x'.repeat(700)
  const said = ownerWords([
    user('one'),
    user('ls output', [{}]),
    user('<system-reminder>nag</system-reminder>'),
    { role: 'assistant', text: 'sure' },
    user('   '),
    ...Array.from({ length: 9 }, (_, i) => user(`m${i}`)),
    user(long),
  ])

  expect(said).toHaveLength(8)
  expect(said.slice(0, 7)).toEqual(['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'].slice(0, 7))
  expect(said.at(-1)).toBe(`${'x'.repeat(600)} [+100 chars]`)
  expect(said).not.toContain('one')
  expect(said).not.toContain('ls output')
})

test('a note is stale after three days, or a day with commits since', () => {
  const at = (days: number, commitsSince?: number) => ({ path: 'p.md', at: new Date(NOW - days * DAY).toISOString(), commitsSince })
  const now = new Date(NOW).toISOString()

  expect(isStale(at(0, 9), now)).toBe(false)
  expect(isStale(at(1, 0), now)).toBe(false)
  expect(isStale(at(1, 1), now)).toBe(true)
  expect(isStale(at(2, undefined), now)).toBe(false)
  expect(isStale(at(3), now)).toBe(true)
  expect(staleness(at(5, 4), now)).toBe('5 days old, 4 commits since')
  expect(staleness(at(1, 1), now)).toBe('1 day old, 1 commit since')
  expect(staleness(at(0), now)).toBe('written today')
})

test('keys, tokens and passwords by name stay out of a patch', () => {
  for (const name of ['.env', '.env.local', 'cfg/.env', 'id.pem', 'a\\b\\cert.pfx', 'my_api_key.txt', 'token.json', 'src/secrets.ts', 'Password.md'])
    expect(SECRETISH.test(name)).toBe(true)
  for (const name of ['src/environment.ts', 'envy.txt', 'README.md', 'keyboard.cs', 'monkey.ts'])
    expect(SECRETISH.test(name)).toBe(false)
})

test('the record says where, what is uncommitted and what he said; the reminder points at it', () => {
  const text = note({ ...FACTS, upstream: 'origin/main', ahead: 2, behind: 1, skipped: ['.env: the name looks like a secret'], words: ['push it', 'two\nlines'] }, 'p.patch')

  expect(text).toContain('- branch main at abc1234 (origin/main, 2 ahead, 1 behind)')
  expect(text).toContain('## Uncommitted (1)')
  expect(text).toContain('-  M a.ts')
  expect(text).toContain('Patch of all of it, secrets-looking names left out: p.patch')
  expect(text).toContain('- .env: the name looks like a secret')
  expect(text).toContain('> push it')
  expect(text).toContain('> two\n> lines')
  expect(note({ ...FACTS, root: undefined })).toContain('not inside a git repository')
  expect(reminder(FACTS, 'f.md', 'p.patch')).toContain('branch main at abc1234, 1 uncommitted file')
  expect(reminder(FACTS, 'f.md')).not.toContain('patch of the uncommitted')
  expect(reminder(FACTS, 'f.md')).not.toContain('WARNING')
})

test('the command writes the facts and the patch, keeping secret-looking files out of it', async ($, on) => {
  mock.clock(on, { now: NOW })
  const m = machine(on)

  const { text } = await $.command.run({ command: 'touchstone', args: '' })
  const record = m.files.get(m.file) ?? ''

  expect(text).toContain(m.file)
  expect(text).toContain(m.patch)
  expect(record).toContain('- repo: C:/work/proj')
  expect(record).toContain('- branch main at abc1234 (origin/main, 2 ahead, 1 behind)')
  expect(record).toContain('## Uncommitted (3)') // The .claude file does not count.
  expect(record).toContain('?? .env')
  expect(record).toContain('- .env: the name looks like a secret')
  expect(record).toContain('> push it\n> do both') // His words, in order, without Claude's.
  expect(record).not.toContain('Pushed.')
  expect(m.files.get(m.patch)).toBe('DIFF-A\nDIFF-NEW\n') // No secret in it.
  expect(record).toContain('5 days old, 4 commits since')
})

test('a compaction saves the facts before it runs, and afterwards the model hears of them and of a stale note', async ($, on) => {
  mock.clock(on, { now: NOW })
  const m = machine(on)
  on('session.compact', () => {
    m.order.push('compaction')

    return { messages: SUMMARY, tokensAfter: 4000 }
  })

  expect((await $.prompt.compose(COMPOSE)).sections).toEqual([]) // Nothing to say yet.
  const result = await $.session.compact({ trigger: 'auto', messages: SAID })

  expect(result.tokensAfter).toBe(4000) // The compaction comes through untouched.
  expect(m.order.indexOf(`write ${m.file}`)).toBeLessThan(m.order.indexOf('compaction'))
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections).toHaveLength(1)
  expect(sections[0].id).toBe('touchstone')
  expect(sections[0].scope).toBe('session')
  expect(sections[0].text).toContain(m.file)
  expect(sections[0].text).toContain('WARNING: the preserve note')
  expect(sections[0].text).toContain('5 days old, 4 commits since')
  expect(sections[0].text).toContain('> do both')
})

test('a fresh note draws no warning, and a missing one none either', async ($, on) => {
  mock.clock(on, { now: NOW })
  machine(on, { noteAgeDays: 0 })
  on('session.compact', () => ({ messages: SUMMARY }))

  await $.session.compact({ trigger: 'manual', messages: SAID })
  expect((await $.prompt.compose(COMPOSE)).sections[0].text).not.toContain('WARNING')
})

test('outside a repository he still saves what he can, and a failing disk never stops the compaction', async ($, on) => {
  mock.clock(on, { now: NOW })
  const m = machine(on, { repo: false })
  on('session.compact', () => ({ messages: SUMMARY, tokensAfter: 7 }))

  await $.session.compact({ trigger: 'auto', messages: SAID })
  expect(m.files.get(m.file)).toContain('not inside a git repository')
  expect(m.files.get(m.file)).toContain('> push it')
})

test('a disk that fails does not stop the compaction, and the command says so', async ($, on) => {
  mock.clock(on, { now: NOW })
  machine(on, { writeFails: true })
  on('session.compact', () => ({ messages: SUMMARY, tokensAfter: 7 }))

  expect((await $.session.compact({ trigger: 'auto', messages: SUMMARY })).tokensAfter).toBe(7)
  expect((await $.command.run({ command: 'touchstone', args: '' })).text).toBe('Touchstone could not write its facts.')
})

test('a precompute, a subagent, or no home folder leaves him quiet', async ($, on) => {
  mock.clock(on, { now: NOW })
  const m = machine(on)
  on('session.compact', () => ({ messages: SUMMARY }))

  await $.session.compact({ trigger: 'precompute', messages: SUMMARY })
  await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: SUMMARY })
  expect(m.files.size).toBe(0)
  expect((await $.prompt.compose(COMPOSE)).sections).toEqual([])
})

test('past 70 percent the facts are written once, and again only after a compaction brought the context down', async ($, on) => {
  mock.clock(on, { now: NOW })
  const m = machine(on)
  const measure = (percent: number) =>
    $.session.measure({ context: { window: 1000000, tokens: percent * 10000, percent }, rateLimits: [], changed: ['context'] })

  await measure(50)
  expect(m.order).toHaveLength(0)
  await measure(71)
  expect(m.files.get(m.file)).toContain('Facts the harness read at measure')
  expect(m.files.get(m.file)).toContain('about 710k tokens')
  const written = m.order.length
  await measure(80)
  await measure(66) // Not down far enough to count as a compaction.
  await measure(75)
  expect(m.order).toHaveLength(written)
  await measure(20)
  await measure(72)
  expect(m.order.length).toBeGreaterThan(written)
  expect((await $.prompt.compose(COMPOSE)).sections).toEqual([]) // A mark alone says nothing to the model.
})
