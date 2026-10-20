import { DatabaseSync } from 'node:sqlite'

/** One SQLite file shared by every process (the user's terminal UI, agent calls). */
export function openDb(path: string) {
  const db = new DatabaseSync(path)
  // WAL lets readers tail the log while another process writes.
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  return db
}

export type Db = DatabaseSync
