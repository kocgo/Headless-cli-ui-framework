/**
 * The bookshop's backend. In a real app this is your HTTP client (for example
 * kubb-generated hooks' fetchers); here it's SQLite so the demo is self-contained.
 */
import type { Db } from '../framework/index.js'

export interface Book { id: string; slug: string; title: string; author: string; genre: string; price: number; stock: number }
export interface Review { stars: number; text: string; at: string }
export interface CartLine { bookId: string; slug: string; genre: string; title: string; price: number; qty: number; stock: number }
export interface Account { name: string; email: string }
export interface Order { id: number; at: string; total: number; items: CartLine[] }
export type Sort = 'title' | 'price' | 'author'

const SEED: Array<[string, string, string, number, number]> = [
  ['1984', 'George Orwell', 'dystopia', 8.99, 7],
  ['Brave New World', 'Aldous Huxley', 'dystopia', 8.5, 5],
  ['Pride and Prejudice', 'Jane Austen', 'romance', 7.99, 12],
  ['Jane Eyre', 'Charlotte Brontë', 'romance', 7.5, 8],
  ['Frankenstein', 'Mary Shelley', 'gothic', 6.99, 9],
  ['Dracula', 'Bram Stoker', 'gothic', 8.25, 6],
  ['Wuthering Heights', 'Emily Brontë', 'gothic', 7.25, 5],
  ['Moby-Dick', 'Herman Melville', 'adventure', 9.5, 4],
  ['The Count of Monte Cristo', 'Alexandre Dumas', 'adventure', 11.99, 4],
  ['The Odyssey', 'Homer', 'adventure', 8.99, 7],
  ['Middlemarch', 'George Eliot', 'classic', 10.99, 3],
  ['War and Peace', 'Leo Tolstoy', 'classic', 12.5, 2],
  ['Crime and Punishment', 'Fyodor Dostoevsky', 'classic', 9.99, 6],
  ['The Time Machine', 'H. G. Wells', 'science', 5.99, 11],
  ['The War of the Worlds', 'H. G. Wells', 'science', 6.5, 9],
  ['Twenty Thousand Leagues Under the Seas', 'Jules Verne', 'science', 7.99, 5],
  ['Animal Farm', 'George Orwell', 'dystopia', 5.99, 0],
]

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const REVIEWS: Array<[string, number, string, string]> = [
  ['the-time-machine', 5, 'Still the template for every time-travel story.', '2026-03-02'],
  ['the-time-machine', 3, 'Short, and the Eloi are a bit flat.', '2026-09-14'],
  ['the-time-machine', 4, 'Read it in one sitting.', '2026-06-21'],
  ['1984', 5, 'More relevant every year.', '2026-08-30'],
  ['1984', 4, 'Bleak, brilliant, exhausting.', '2026-01-11'],
  ['dracula', 4, 'The letters format still works.', '2026-07-07'],
  ['frankenstein', 5, 'Nothing like the films.', '2026-05-19'],
]

export function createApi(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, slug TEXT, title TEXT, author TEXT, genre TEXT, price REAL, stock INTEGER);
    CREATE TABLE IF NOT EXISTS reviews (slug TEXT, stars INTEGER, text TEXT, at TEXT);
    CREATE TABLE IF NOT EXISTS cart (book_id TEXT PRIMARY KEY, qty INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT, email TEXT);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, total REAL, items TEXT);
  `)
  // Databases from before slugs existed: add the column and fill it.
  const cols = (db.prepare('PRAGMA table_info(books)').all() as Array<{ name: string }>).map((c) => c.name)
  if (!cols.includes('slug')) {
    db.exec('ALTER TABLE books ADD COLUMN slug TEXT')
    for (const b of db.prepare('SELECT id, title FROM books').all() as Array<{ id: string; title: string }>)
      db.prepare('UPDATE books SET slug = ? WHERE id = ?').run(slugify(b.title), b.id)
  }
  if (!(db.prepare('SELECT COUNT(*) AS n FROM books').get() as { n: number }).n) {
    const ins = db.prepare('INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?)')
    SEED.forEach(([title, author, genre, price, stock], i) => ins.run(String(i + 1), slugify(title), title, author, genre, price, stock))
    const rev = db.prepare('INSERT INTO reviews VALUES (?, ?, ?, ?)')
    REVIEWS.forEach((r) => rev.run(...r))
    db.prepare("INSERT INTO account VALUES (1, 'Reader', 'reader@example.com')").run()
  }
  const tx = <T>(fn: () => T): T => {
    db.exec('BEGIN IMMEDIATE')
    try {
      const r = fn()
      db.exec('COMMIT')
      return r
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
  const getBook = (id: string) => (db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined) ?? null
  const getCart = () =>
    db
      .prepare('SELECT c.book_id AS bookId, b.slug, b.genre, b.title, b.price, c.qty, b.stock FROM cart c JOIN books b ON b.id = c.book_id ORDER BY b.title')
      .all() as unknown as CartLine[]

  return {
    async searchBooks(p: { query?: string; genre?: string; sort: Sort; page: number }, size = 6) {
      const where: string[] = []
      const args: string[] = []
      if (p.query) {
        where.push('(title LIKE ? OR author LIKE ? OR genre LIKE ?)')
        args.push(`%${p.query}%`, `%${p.query}%`, `%${p.query}%`)
      }
      if (p.genre) {
        where.push('genre = ?')
        args.push(p.genre)
      }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const order = p.sort === 'price' ? 'price, title' : p.sort === 'author' ? 'author, title' : 'title'
      const total = (db.prepare(`SELECT COUNT(*) AS n FROM books ${w}`).get(...args) as { n: number }).n
      const items = db.prepare(`SELECT * FROM books ${w} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, size, (p.page - 1) * size) as unknown as Book[]
      return { total, pages: Math.max(1, Math.ceil(total / size)), items }
    },
    async genres() {
      return (db.prepare('SELECT DISTINCT genre FROM books ORDER BY genre').all() as Array<{ genre: string }>).map((r) => r.genre)
    },
    async getBook(id: string) {
      return getBook(id)
    },
    async getShelf(genre: string) {
      return db.prepare('SELECT * FROM books WHERE genre = ? ORDER BY title').all(genre) as unknown as Book[]
    },
    async getBookBySlug(genre: string, slug: string) {
      return (db.prepare('SELECT * FROM books WHERE genre = ? AND slug = ?').get(genre, slug) as Book | undefined) ?? null
    },
    async getReviews(slug: string, sort: 'top' | 'new') {
      const order = sort === 'new' ? 'at DESC' : 'stars DESC, at DESC'
      return db.prepare(`SELECT stars, text, at FROM reviews WHERE slug = ? ORDER BY ${order}`).all(slug) as unknown as Review[]
    },
    async getCart() {
      return getCart()
    },
    async getAccount() {
      return db.prepare('SELECT name, email FROM account WHERE id = 1').get() as unknown as Account
    },
    async listOrders() {
      return (db.prepare('SELECT * FROM orders ORDER BY id DESC').all() as Array<Omit<Order, 'items'> & { items: string }>).map(
        (o) => ({ ...o, items: JSON.parse(o.items) as CartLine[] }),
      )
    },

    async addToCart(bookId: string, qty: number) {
      return tx(() => {
        const b = getBook(bookId)
        if (!b) throw new Error(`no book ${bookId}`)
        const inCart = (db.prepare('SELECT qty FROM cart WHERE book_id = ?').get(bookId) as { qty: number } | undefined)?.qty ?? 0
        if (inCart + qty > b.stock) throw new Error(`only ${b.stock} of "${b.title}" in stock`)
        db.prepare('INSERT INTO cart VALUES (?, ?) ON CONFLICT(book_id) DO UPDATE SET qty = qty + excluded.qty').run(bookId, qty)
        return { bookId, title: b.title, qty: inCart + qty }
      })
    },
    async removeFromCart(bookId: string) {
      const title = getBook(bookId)?.title ?? bookId
      if (!db.prepare('DELETE FROM cart WHERE book_id = ?').run(bookId).changes) throw new Error(`book ${bookId} is not in the cart`)
      return { bookId, title }
    },
    async updateEmail(email: string) {
      const before = (db.prepare('SELECT email FROM account WHERE id = 1').get() as { email: string }).email
      db.prepare('UPDATE account SET email = ? WHERE id = 1').run(email)
      return { before, after: email }
    },
    async placeOrder(total: number) {
      return tx(() => {
        const lines = getCart()
        if (!lines.length) throw new Error('cart is empty')
        for (const l of lines) db.prepare('UPDATE books SET stock = stock - ? WHERE id = ?').run(l.qty, l.bookId)
        db.prepare('DELETE FROM cart').run()
        const r = db.prepare('INSERT INTO orders (at, total, items) VALUES (?, ?, ?) RETURNING id').get(new Date().toISOString(), total, JSON.stringify(lines)) as { id: number }
        return { orderId: r.id, total, items: lines.length }
      })
    },
  }
}

export type Api = ReturnType<typeof createApi>
