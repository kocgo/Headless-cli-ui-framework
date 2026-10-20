import { expect, test } from 'claude-code/testing'
import * as fx from './fixtures'

const PANE = {
  plugin: 'bookshop',
  component: 'Pane',
  requestId: 'bookshop',
  props: {
    title: 'Bookshop',
    isFocused: true,
    bodyColumns: 72,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

/** Stand in for the engine, and for bin/bookshop: answer each CLI call with a real envelope. */
function setup(on: Parameters<Parameters<typeof test>[1]>[1], screens: { show: unknown }) {
  const calls: string[][] = []
  on('command.register', () => ({ value: { command: 'shop' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('process.run', (_$, e) => {
    const argv = (e.argv as string[]).slice((e.argv as string[]).indexOf('--json') + 1)
    calls.push(argv)
    const env =
      argv[0] === 'show' ? screens.show
      : argv[0] === 'open' ? fx.open
      : argv[0] === 'approve' ? fx.search
      : argv[0] === 'log' && argv.includes('--actor') ? fx.logUser
      : argv[0] === 'log' && argv.includes('--since') ? fx.logSince
      : argv[0] === 'log' ? fx.logTail
      : fx.search
    return { value: { exitCode: 0, stdout: JSON.stringify(env), stderr: '' } }
  })
  return calls
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`/shop draws the user's screen and a row press runs its command (${surface})`, async ($, on) => {
    const calls = setup(on, { show: fx.search })
    await $.session.start({ cwd: '/', surface, isInteractive: true })
    await $.command.run({ command: 'shop', args: '' })
    expect(calls[0]).toEqual(['show'])

    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Results for "gothic"/ }))?.text).toBeDefined()
    const row = await ui.find({ type: 'Button', text: /Dracula/ })
    expect(row).toBeDefined()

    await ui.press({ key: row!.key! })
    expect(calls).toContainEqual(['open', '1'])
    // The pane now shows the screen that command returned.
    expect(await ui.find({ type: 'Text', text: /Frankenstein/ })).toBeDefined()
    await ui.unmount()
  })
}

test("a proposal from Claude shows Approve, which runs `approve <id>` as the user", async ($, on) => {
  const calls = setup(on, { show: fx.withProposal })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'shop', args: '' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /wants order\.place/ })).toBeDefined()
  const id = fx.withProposal.pending[0]!.id
  await ui.press({ key: `approve-${id}` })
  expect(calls).toContainEqual(['approve', String(id)])
  await ui.unmount()
})

test('/shop with arguments runs that command as the user', async ($, on) => {
  const calls = setup(on, { show: fx.search })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'shop', args: 'search --query gothic' })
  expect(calls[0]).toEqual(['search', '--query', 'gothic'])
})

test("Claude's next prompt carries what the user did in the pane", async ($, on) => {
  setup(on, { show: fx.search })
  let seen: readonly string[] | undefined
  on('prompt.submit', (_$, e) => {
    seen = e.context
    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'shop', args: '' })
  await $.prompt.submit({ text: 'what am I looking at?' })
  expect(seen?.[0]).toContain('In the bookshop pane since your last turn, the user:')
  expect(seen?.[0]).toContain('opened search')
})
