// Touchstone's facts: what is true of a session at the moment it is compacted, as plain data, and the
// text made of them. Nothing here reads a clock, a file or git: register.ts does, and hands it over.

export type Facts = {
  at: string // ISO time of capture
  trigger: string // auto, manual, or measure (the context passed its mark)
  session: string
  cwd: string
  root?: string // The git root; absent outside a repository.
  branch?: string
  head?: string
  upstream?: string
  ahead?: number
  behind?: number
  dirty: string[] // `git status --porcelain` lines
  skipped: string[] // Untracked files left out of the patch, with why
  words: string[] // The owner's last messages, verbatim
  note?: { path: string; at: string; commitsSince?: number } // The preserve note a compaction will hand back
  tokens?: number
}

export const WORDS_KEPT = 8
const WORD_CAP = 600
export const PATCH_FILE_CAP = 300_000 // Bytes of one untracked file's diff; bigger is listed, not copied.

// Names that look like keys, tokens or passwords stay out of the patch; they are listed instead.
export const SECRETISH = /(^|[\\/])(\.env(\..*)?|[^\\/]*\.(pem|pfx|key|p12|keystore)|[^\\/]*(secret|token|credential|password|apikey|api_key)[^\\/]*)$/i

// The same name the context guard gives a project, so both find the same preserve note.
export function projectName(root: string) {
  const worktree = root.match(/^(.*)[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)$/i)
  const base = worktree ? `${worktree[1].split(/[\\/]/).pop()}-${worktree[2]}` : (root.split(/[\\/]/).filter(Boolean).pop() ?? '')

  return (/^[A-Za-z]:$/.test(base) ? '' : base).replace(/[^\w.-]+/g, '_') || 'session' // A drive root has no name.
}

// His own last words: user messages that are text he typed, not a tool's result or an engine notice.
export function ownerWords(messages: readonly { role: string; text: string; toolResults?: readonly unknown[] }[]) {
  return messages
    .filter(m => m.role === 'user' && (m.toolResults?.length ?? 0) === 0 && m.text.trim() !== '' && !m.text.trimStart().startsWith('<'))
    .slice(-WORDS_KEPT)
    .map(m => (m.text.length > WORD_CAP ? `${m.text.slice(0, WORD_CAP)} [+${m.text.length - WORD_CAP} chars]` : m.text))
}

// How old the preserve note is against the work since: "3 days old, 12 commits since".
export function staleness(note: NonNullable<Facts['note']>, now: string) {
  const days = Math.floor((Date.parse(now) - Date.parse(note.at)) / 86_400_000)
  const age = days >= 1 ? `${days} day${days === 1 ? '' : 's'} old` : 'written today'
  const work = note.commitsSince === undefined ? '' : `, ${note.commitsSince} commit${note.commitsSince === 1 ? '' : 's'} since`

  return `${age}${work}`
}

// A note is stale once a day has passed and commits have landed since, or after three days whatever.
export function isStale(note: NonNullable<Facts['note']>, now: string) {
  const days = (Date.parse(now) - Date.parse(note.at)) / 86_400_000

  return days >= 3 || (days >= 1 && (note.commitsSince ?? 0) > 0)
}

const bullets = (items: readonly string[], none: string) => (items.length === 0 ? [`- ${none}`] : items.map(item => `- ${item}`))

// The file on disk: everything, for a person or a fresh session to read.
export function note(f: Facts, patch?: string) {
  const track = f.upstream === undefined ? 'no upstream' : `${f.upstream}, ${f.ahead ?? 0} ahead, ${f.behind ?? 0} behind`

  return [
    `# Touchstone, ${f.at}`,
    `Facts the harness read at ${f.trigger}; the model wrote none of them. Session ${f.session}. Recheck git before acting.`,
    '',
    '## Where',
    `- cwd: ${f.cwd}`,
    ...(f.root === undefined ? ['- not inside a git repository'] : [`- repo: ${f.root}`, `- branch ${f.branch ?? '?'} at ${f.head ?? '?'} (${track})`]),
    ...(f.tokens === undefined ? [] : [`- context: about ${Math.round(f.tokens / 1000)}k tokens`]),
    '',
    `## Uncommitted (${f.dirty.length})`,
    ...bullets(f.dirty, 'nothing'),
    ...(patch === undefined ? [] : ['', `Patch of all of it, secrets-looking names left out: ${patch}`]),
    ...(f.skipped.length === 0 ? [] : ['', '## Left out of the patch', ...bullets(f.skipped, '')]),
    '',
    `## Bobby's last words, verbatim (${f.words.length})`,
    ...(f.words.length === 0 ? ['- none read'] : f.words.map(w => `> ${w.replace(/\n/g, '\n> ')}`)),
    ...(f.note === undefined ? [] : ['', '## The preserve note', `- ${f.note.path}: ${staleness(f.note, f.at)}`]),
    '',
  ].join('\n')
}

// What the model reads after a compaction: short, and pointing at the file.
export function reminder(f: Facts, file: string, patch?: string) {
  const where = f.root === undefined ? `outside a git repository (${f.cwd})` : `branch ${f.branch ?? '?'} at ${f.head ?? '?'}, ${f.dirty.length} uncommitted file${f.dirty.length === 1 ? '' : 's'}`
  const stale = f.note !== undefined && isStale(f.note, f.at)

  return [
    `TOUCHSTONE: facts the harness read just before this session's context was compacted, not written by the model. ${where}.`,
    `Full record: ${file}${patch === undefined ? '' : `; patch of the uncommitted work: ${patch}`}.`,
    stale && f.note
      ? `WARNING: the preserve note (${f.note.path}) is ${staleness(f.note, f.at)}. Treat what it says as old and check it against git and the files before acting.`
      : '',
    f.words.length === 0 ? '' : `Bobby's last words, verbatim:\n${f.words.map(w => `> ${w.replace(/\n/g, '\n> ')}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n')
}
