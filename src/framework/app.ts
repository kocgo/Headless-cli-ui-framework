import type { AnyAction, AnyPage } from './declare.js'
import type { Db } from './engine/db.js'
import type { ActionLog } from './engine/log.js'

/** Commands every app gets. App pages and intents may not reuse these names. */
export const FRAMEWORK_COMMANDS: Array<{ name: string; usage: string; help: string }> = [
  { name: 'go', usage: 'go <href>', help: 'navigate to any URL' },
  { name: 'back', usage: 'back', help: 'history back' },
  { name: 'forward', usage: 'forward', help: 'history forward' },
  { name: 'set', usage: 'set k=v …', help: "change the current page's params" },
  { name: 'unset', usage: 'unset k …', help: "remove the current page's params" },
  { name: 'reload', usage: 'reload', help: 'refetch the current page' },
  { name: 'show', usage: 'show', help: 'print the current screen' },
  { name: 'do', usage: 'do <action> [json | --k v …] [--check]', help: 'run an action directly' },
  { name: 'pending', usage: 'pending', help: 'open proposals' },
  { name: 'approve', usage: 'approve <id>', help: 'approve a proposal (user only)' },
  { name: 'reject', usage: 'reject <id> [reason]', help: 'reject a proposal (user only)' },
  { name: 'wait', usage: 'wait <id> [--timeout s]', help: 'block until a proposal is decided' },
  { name: 'peek', usage: 'peek <actor>', help: "another actor's screen" },
  { name: 'follow', usage: 'follow <actor>', help: "move with another actor (interactive)" },
  { name: 'unfollow', usage: 'unfollow', help: 'stop following' },
  { name: 'log', usage: 'log [n] [--since id] [--actor a] [--follow]', help: 'the shared activity log' },
  { name: 'tools', usage: 'tools', help: 'manifest of pages, intents and actions (for agents)' },
  { name: 'help', usage: 'help', help: 'commands available here' },
  { name: 'whoami', usage: 'whoami', help: 'actor, database and location' },
  { name: 'state', usage: 'state', help: 'router and query state (debugging)' },
]
const RESERVED = new Set([...FRAMEWORK_COMMANDS.map((c) => c.name), 'quit', 'exit'])

export interface Services {
  db: Db
  log: ActionLog
}

export interface AppDef<Ctx> {
  name: string
  description?: string
  /** Build the context every data, model and action function receives. */
  context: (services: Services) => Ctx
  /** Optional layout wrapping every page. */
  shell?: AnyPage
  pages: AnyPage[]
  /** Action groups made with `actions(namespace, …)`. */
  actions: Array<Record<string, AnyAction>>
}

export interface App<Ctx = unknown> extends AppDef<Ctx> {
  page(name: string): AnyPage | undefined
  action(name: string): AnyAction | undefined
  allActions: AnyAction[]
}

const NAME = /^[a-z][a-z0-9-]*$/

export function defineApp<Ctx>(def: AppDef<Ctx>): App<Ctx> {
  const problems: string[] = []
  const pages = new Map<string, AnyPage>()
  for (const p of def.pages) {
    if (p.kind !== 'page') problems.push(`"${p.name}" is a layout; pass it as shell`)
    if (!NAME.test(p.name)) problems.push(`page name "${p.name}" must be lowercase letters, digits and dashes`)
    if (RESERVED.has(p.name)) problems.push(`page name "${p.name}" is a framework command`)
    if (pages.has(p.name)) problems.push(`two pages are named "${p.name}"`)
    pages.set(p.name, p)
  }
  for (const p of [...def.pages, ...(def.shell ? [def.shell] : [])]) {
    for (const i of Object.keys(p.def.intents ?? {})) {
      if (RESERVED.has(i)) problems.push(`intent "${p.name}.${i}" reuses the framework command "${i}"`)
      if (pages.has(i)) problems.push(`intent "${p.name}.${i}" has the same name as a page`)
      const intent = p.def.intents![i]!
      if (!intent.to === !intent.do) problems.push(`intent "${p.name}.${i}" needs exactly one of to / do`)
    }
  }
  const actions = new Map<string, AnyAction>()
  for (const group of def.actions)
    for (const a of Object.values(group)) {
      if (!a.name) problems.push('an action was not grouped with actions(namespace, …)')
      if (actions.has(a.name)) problems.push(`two actions are named "${a.name}"`)
      if (Array.isArray(a.invalidates))
        for (const n of a.invalidates as string[])
          if (!pages.has(n) && def.shell?.name !== n) problems.push(`action "${a.name}" invalidates unknown page "${n}"`)
      actions.set(a.name, a)
    }
  if (problems.length) throw new Error(`Invalid app "${def.name}":\n  - ${problems.join('\n  - ')}`)
  return { ...def, page: (n) => pages.get(n), action: (n) => actions.get(n), allActions: [...actions.values()] }
}
