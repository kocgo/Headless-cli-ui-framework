/**
 * The shared, append-only action log. It is the sync surface between actors:
 * every navigation and every mutation (or proposal) is an entry, and every
 * process tails it. Nothing is ever updated in place — state is a fold:
 *   - an actor's cursor (history stack)   = replay of their `navigate` entries
 *   - pending proposals                   = `propose` entries without a resolution
 */
import type { Db } from './db.js'

export type NavType = 'PUSH' | 'REPLACE' | 'BACK' | 'FORWARD' | 'GO'
export type EntryKind = 'navigate' | 'propose' | 'apply' | 'reject' | 'fail'

export interface LogEntry {
  id: number
  at: string
  actor: string
  /** Process/session id, so a process can tell its own entries from others'. */
  sid: string
  kind: EntryKind
  href?: string
  nav?: NavType
  action?: string
  input?: unknown
  result?: unknown
  /** For apply/reject of a proposal: the proposal's id. */
  ref?: number
  note?: string
}

export type NewEntry = Omit<LogEntry, 'id' | 'at'>

const COLUMNS = ['actor', 'sid', 'kind', 'href', 'nav', 'action', 'input', 'result', 'ref', 'note'] as const

type Row = Record<string, string | number | null>

function fromRow(r: Row): LogEntry {
  const e: Record<string, unknown> = { id: r.id, at: r.at }
  for (const c of COLUMNS) {
    const v = r[c]
    if (v === null || v === undefined) continue
    e[c] = c === 'input' || c === 'result' ? JSON.parse(String(v)) : v
  }
  return e as unknown as LogEntry
}

export function createActionLog(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS log (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      at     TEXT NOT NULL,
      actor  TEXT NOT NULL,
      sid    TEXT NOT NULL,
      kind   TEXT NOT NULL,
      href   TEXT, nav TEXT, action TEXT, input TEXT, result TEXT,
      ref    INTEGER, note TEXT
    );
    CREATE INDEX IF NOT EXISTS log_actor_kind ON log (actor, kind);
    CREATE INDEX IF NOT EXISTS log_ref ON log (ref);
  `)

  const insert = db.prepare(
    `INSERT INTO log (at, ${COLUMNS.join(', ')}) VALUES (?, ${COLUMNS.map(() => '?').join(', ')}) RETURNING *`,
  )
  const sinceStmt = db.prepare('SELECT * FROM log WHERE id > ? ORDER BY id')
  const tailStmt = db.prepare('SELECT * FROM (SELECT * FROM log ORDER BY id DESC LIMIT ?) ORDER BY id')
  const getStmt = db.prepare('SELECT * FROM log WHERE id = ?')
  const lastStmt = db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM log')
  const navStmt = db.prepare("SELECT * FROM log WHERE actor = ? AND kind = 'navigate' ORDER BY id")
  const resolutionStmt = db.prepare("SELECT * FROM log WHERE ref = ? AND kind IN ('apply', 'reject', 'fail') LIMIT 1")
  const pendingStmt = db.prepare(`
    SELECT p.* FROM log p
    WHERE p.kind = 'propose'
      AND NOT EXISTS (SELECT 1 FROM log r WHERE r.ref = p.id AND r.kind IN ('apply', 'reject', 'fail'))
    ORDER BY p.id`)

  return {
    append(e: NewEntry): LogEntry {
      const values = COLUMNS.map((c) => {
        const v = e[c]
        if (v === undefined) return null
        return c === 'input' || c === 'result' ? JSON.stringify(v) : (v as string | number)
      })
      return fromRow(insert.get(new Date().toISOString(), ...values) as Row)
    },
    since: (id: number) => (sinceStmt.all(id) as Row[]).map(fromRow),
    tail: (n: number) => (tailStmt.all(n) as Row[]).map(fromRow),
    get: (id: number) => {
      const r = getStmt.get(id) as Row | undefined
      return r ? fromRow(r) : undefined
    },
    lastId: () => Number((lastStmt.get() as Row).id),
    pending: () => (pendingStmt.all() as Row[]).map(fromRow),
    resolution: (proposalId: number) => {
      const r = resolutionStmt.get(proposalId) as Row | undefined
      return r ? fromRow(r) : undefined
    },

    /** Rebuild an actor's history stack by replaying their navigations. */
    cursor(actor: string): { entries: string[]; index: number } {
      const entries: string[] = []
      let index = -1
      for (const e of (navStmt.all(actor) as Row[]).map(fromRow)) {
        const href = e.href!
        if (e.nav === 'PUSH' || index < 0) {
          entries.splice(index + 1, Infinity, href)
          index = entries.length - 1
        } else if (e.nav === 'REPLACE') entries[index] = href
        else if (e.nav === 'BACK') index = Math.max(0, index - 1)
        else if (e.nav === 'FORWARD') index = Math.min(entries.length - 1, index + 1)
        // Trust the logged location over arithmetic if they ever disagree.
        if (entries[index] !== href) entries[index] = href
      }
      return entries.length ? { entries, index } : { entries: ['/'], index: 0 }
    },
  }
}

export type ActionLog = ReturnType<typeof createActionLog>

/** One-line human summary of an entry, used by the activity feed and `log`. */
export function describeEntry(e: LogEntry): string {
  const time = e.at.slice(11, 19)
  const who = e.actor.padEnd(6)
  const input = e.input && Object.keys(e.input as object).length ? ' ' + JSON.stringify(e.input) : ''
  switch (e.kind) {
    case 'navigate':
      return `#${e.id} ${time} ${who} ${e.nav === 'PUSH' ? '→' : e.nav === 'REPLACE' ? '↪' : e.nav === 'BACK' ? '←' : '⇢'} ${e.href}`
    case 'propose':
      return `#${e.id} ${time} ${who} ⚑ proposes ${e.action}${input}`
    case 'apply':
      return e.ref
        ? `#${e.id} ${time} ${who} ✓ approved #${e.ref} ${e.action}${input}`
        : `#${e.id} ${time} ${who} ✓ ${e.action}${input}`
    case 'reject':
      return `#${e.id} ${time} ${who} ✗ rejected #${e.ref}${e.note ? ` (${e.note})` : ''}`
    case 'fail':
      return `#${e.id} ${time} ${who} ! ${e.action} failed: ${e.note}`
  }
}
