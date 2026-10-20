/**
 * The shared, append-only activity log: the only state actors share.
 * Entries record meaning, not just URLs: which page with which params and
 * what it found; which intent ran which action and what came of it.
 *
 * Folds over it give: each actor's cursor (history), pending proposals,
 * the activity feed, and the context Claude gets about the user.
 */
import type { Db } from './db.js'

export type NavType = 'PUSH' | 'REPLACE' | 'BACK' | 'FORWARD'
export type EntryKind = 'visit' | 'propose' | 'apply' | 'reject' | 'fail'

export interface LogEntry {
  id: number
  at: string
  actor: string
  /** Process id, so a process can tell its own entries from others'. */
  sid: string
  kind: EntryKind
  /** The page visited, or the page an intent ran on. */
  page?: string
  params?: Record<string, unknown>
  href?: string
  nav?: NavType
  /** The intent that caused this entry, if any (`open`, `add`, `checkout`). */
  intent?: string
  action?: string
  input?: unknown
  result?: unknown
  /** For apply/reject/fail of a proposal: the proposal's id. */
  ref?: number
  /** Summary (visit, apply), reason (reject, propose refused) or error (fail). */
  note?: string
}

export type NewEntry = Omit<LogEntry, 'id' | 'at'>

const COLUMNS = ['actor', 'sid', 'kind', 'page', 'params', 'href', 'nav', 'intent', 'action', 'input', 'result', 'ref', 'note'] as const
const JSON_COLUMNS = new Set(['params', 'input', 'result'])
type Row = Record<string, string | number | null>

function fromRow(r: Row): LogEntry {
  const e: Record<string, unknown> = { id: r.id, at: r.at }
  for (const c of COLUMNS) {
    const v = r[c]
    if (v !== null && v !== undefined) e[c] = JSON_COLUMNS.has(c) ? JSON.parse(String(v)) : v
  }
  return e as unknown as LogEntry
}

export function createActionLog(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
      actor TEXT NOT NULL, sid TEXT NOT NULL, kind TEXT NOT NULL,
      page TEXT, params TEXT, href TEXT, nav TEXT, intent TEXT,
      action TEXT, input TEXT, result TEXT, ref INTEGER, note TEXT
    );
    CREATE INDEX IF NOT EXISTS activity_actor_kind ON activity (actor, kind);
    CREATE INDEX IF NOT EXISTS activity_ref ON activity (ref);
  `)
  const insert = db.prepare(
    `INSERT INTO activity (at, ${COLUMNS.join(', ')}) VALUES (?, ${COLUMNS.map(() => '?').join(', ')}) RETURNING *`,
  )
  const q = {
    since: db.prepare('SELECT * FROM activity WHERE id > ? ORDER BY id'),
    sinceBy: db.prepare('SELECT * FROM activity WHERE id > ? AND actor = ? ORDER BY id'),
    tail: db.prepare('SELECT * FROM (SELECT * FROM activity ORDER BY id DESC LIMIT ?) ORDER BY id'),
    get: db.prepare('SELECT * FROM activity WHERE id = ?'),
    last: db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM activity'),
    visits: db.prepare("SELECT * FROM activity WHERE actor = ? AND kind = 'visit' ORDER BY id"),
    resolution: db.prepare("SELECT * FROM activity WHERE ref = ? AND kind IN ('apply', 'reject', 'fail') LIMIT 1"),
    pending: db.prepare(`SELECT p.* FROM activity p WHERE p.kind = 'propose'
      AND NOT EXISTS (SELECT 1 FROM activity r WHERE r.ref = p.id AND r.kind IN ('apply', 'reject', 'fail')) ORDER BY p.id`),
  }
  const many = (rows: unknown) => (rows as Row[]).map(fromRow)
  const one = (row: unknown) => (row ? fromRow(row as Row) : undefined)

  return {
    append(e: NewEntry): LogEntry {
      const values = COLUMNS.map((c) => {
        const v = e[c]
        if (v === undefined) return null
        return JSON_COLUMNS.has(c) ? JSON.stringify(v) : (v as string | number)
      })
      return fromRow(insert.get(new Date().toISOString(), ...values) as Row)
    },
    since: (id: number, actor?: string) => many(actor ? q.sinceBy.all(id, actor) : q.since.all(id)),
    tail: (n: number) => many(q.tail.all(n)),
    get: (id: number) => one(q.get.get(id)),
    lastId: () => Number((q.last.get() as Row).id),
    pending: () => many(q.pending.all()),
    resolution: (proposalId: number) => one(q.resolution.get(proposalId)),

    /** An actor's history stack, rebuilt from their visits. */
    cursor(actor: string): { entries: string[]; index: number } {
      const entries: string[] = []
      let index = -1
      for (const e of many(q.visits.all(actor))) {
        const href = e.href!
        if (e.nav === 'BACK') index = Math.max(0, index - 1)
        else if (e.nav === 'FORWARD') index = Math.min(entries.length - 1, index + 1)
        else if (e.nav === 'REPLACE' && index >= 0) entries[index] = href
        else {
          entries.splice(index + 1, Infinity, href)
          index = entries.length - 1
        }
        if (entries[index] !== href) entries[index] = href // trust the log over arithmetic
      }
      return entries.length ? { entries, index } : { entries: ['/'], index: 0 }
    },
  }
}

export type ActionLog = ReturnType<typeof createActionLog>

const compact = (v: unknown) => (v && typeof v === 'object' && Object.keys(v).length ? ' ' + JSON.stringify(v) : '')

/** One readable line per entry, for the activity feed, `log`, and Claude's context. */
export function describeEntry(e: LogEntry): string {
  const head = `#${e.id} ${e.at.slice(11, 19)} ${e.actor.padEnd(6)}`
  const note = e.note ? ` · ${e.note}` : ''
  const via = e.intent ? ` (${e.intent})` : ''
  switch (e.kind) {
    case 'visit': {
      const arrow = e.nav === 'BACK' ? '←' : e.nav === 'FORWARD' ? '⇢' : '→'
      return `${head} ${arrow} ${e.page ?? e.href}${compact(e.params)}${via}${note}`
    }
    case 'propose':
      return `${head} ⚑ proposes ${e.action}${compact(e.input)}${via}`
    case 'apply':
      return e.ref ? `${head} ✓ approved #${e.ref} ${e.action}${note}` : `${head} ✓ ${e.action}${compact(e.input)}${via}${note}`
    case 'reject':
      return `${head} ✗ rejected #${e.ref}${note}`
    case 'fail':
      return `${head} ! ${e.action} failed${note}`
  }
}
