import type { CoreEngineInterface, Register } from 'claude-code'

import { context, MODEL, prompt, SYSTEM, tidy, USAGE } from './oy'

// His rough thought in, the cleaned-up prompt in the box: for him to read, change and send. Oy never sends.
async function polish($: CoreEngineInterface, draft: string) {
  const said = await $.session.messages().catch(() => [])
  const reply = await $.model.complete({
    model: MODEL,
    system: SYSTEM,
    prompt: prompt(draft, context(Array.isArray(said) ? said : [])),
    maxTokens: 2000,
    effort: 'low',
  })

  if (!reply.isAnswered) return { text: `Oy could not read that (${reply.reason}). Your words are untouched; send them as they are or try again.` }

  const text = tidy(reply.text)
  const filled = await $.prompt.fill({ text, mode: 'replace' })

  return {
    text: filled.isFilled ? 'Oy put the cleaned-up prompt in the box. Read the check line, change what is wrong, then send it.' : `The box would not take it, so here it is:\n\n${text}`,
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'oy', description: 'Oy cleans up a rough thought into a clear prompt and puts it in the box: /oy your thought' })

    return next(e)
  })

  on('command.run', { command: 'oy' }, async ($, e) => {
    const draft = e.args.trim()

    return draft === '' ? { text: USAGE } : polish($, draft)
  })
}
