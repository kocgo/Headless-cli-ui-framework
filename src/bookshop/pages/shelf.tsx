/**
 * Nested routes with real TanStack <Outlet />s:
 *
 *   /books/science                           shelf
 *   /books/science/the-time-machine          shelf → book → details (index tab)
 *   /books/science/the-time-machine/reviews  shelf → book → reviews (tab)
 *
 * Each level fetches its own data once; children inherit the parent's params
 * (`genre`, `slug`) and see its state as `parent`.
 */
import { Type } from '@sinclair/typebox'
import { Badge, Button, KeyValue, Outlet, Page, Row, Section, Stack, Table, Tabs, Text, col, type Href } from '../../framework/index.js'
import { cart } from '../actions.js'
import type { Book, Review } from '../api.js'
import { gbp } from '../domain/cart.js'
import { page } from '../kit.js'

export const shelf = page('shelf', {
  path: '/books/$genre',
  description: 'All books in one genre',
  params: Type.Object({ genre: Type.String({ description: 'genre, e.g. science' }) }),
  positional: ['genre'],
  data: async ({ genre }, { api }) => {
    const books = await api.getShelf(genre)
    return books.length ? books : null // an unknown genre is "not found"
  },
  title: ({ params }) => `Shelf: ${params.genre}`,
  summary: ({ data, params }) => `${data.length} books in ${params.genre}`,
  intents: {
    open: {
      description: 'open the nth book on this shelf',
      args: Type.Object({ row: Type.Integer({ minimum: 1 }) }),
      to: ({ data, params, args }): Href => {
        const b = data[args.row - 1]
        if (!b) throw new Error(`there is no row ${args.row}`)
        return book.link({ genre: params.genre, slug: b.slug })
      },
    },
  },
  view: ({ data, params }) => (
    <Page title={`Shelf: ${params.genre}`} subtitle={`${data.length} books`}>
      <Table
        rows={data}
        rowIntent="open"
        columns={[col<Book, 'title'>('title'), col<Book, 'author'>('author'), col<Book, 'price'>('price', { align: 'right', format: gbp })]}
      />
      {/* The selected book renders here: TanStack's own <Outlet />. */}
      <Outlet />
    </Page>
  ),
})

export const book = shelf.child('book', {
  path: '$slug',
  description: 'One book, in its shelf',
  params: Type.Object({ slug: Type.String({ description: 'book slug, e.g. the-time-machine' }) }),
  positional: ['genre', 'slug'],
  data: ({ genre, slug }, { api }) => api.getBookBySlug(genre, slug),
  model: ({ data }) => ({ inStock: data.stock > 0, lowStock: data.stock > 0 && data.stock <= 3 }),
  title: ({ data }) => data.title,
  summary: ({ data }) => `${data.title}, ${gbp(data.price)}`,
  intents: {
    add: {
      description: 'add this book to the cart',
      args: Type.Object({ qty: Type.Integer({ minimum: 1, default: 1 }) }),
      when: ({ model }) => model.inStock || 'sold out',
      do: cart.add,
      input: ({ data, args }) => ({ bookId: data.id, qty: args.qty }),
    },
    close: {
      description: 'back to the shelf',
      to: ({ params }) => shelf.link({ genre: params.genre }),
    },
  },
  view: ({ data, model }) => (
    <Section title={data.title}>
      <Row>
        <Text tone="dim">by {data.author} · {gbp(data.price)}</Text>
        {model.lowStock && <Badge tone="warning">only {data.stock} left</Badge>}
      </Row>
      <Row>
        <Button intent="add" label="Add to cart" hotkey="a" />
        <Button intent="close" label="Close" hotkey="x" />
      </Row>
      {/* Tab bar + the active tab (an <Outlet /> under the hood). */}
      <Tabs />
    </Section>
  ),
})

export const details = book.tab('details', {
  index: true,
  description: "A book's details",
  view: ({ parent }) => (
    <KeyValue items={{ Genre: parent.data.genre, Price: gbp(parent.data.price), Stock: parent.model.inStock ? String(parent.data.stock) : 'sold out' }} />
  ),
})

export const reviews = book.tab('reviews', {
  description: "A book's reviews",
  params: Type.Object({ sort: Type.Union([Type.Literal('top'), Type.Literal('new')], { default: 'top' }) }),
  data: ({ slug, sort }, { api }) => api.getReviews(slug, sort),
  summary: ({ data, params }) => `${data.length} review(s), ${params.sort} first`,
  intents: {
    sort: {
      description: 'sort reviews: top or new',
      args: Type.Object({ by: Type.Union([Type.Literal('top'), Type.Literal('new')]) }),
      to: ({ params, args, link }) => link({ ...params, sort: args.by }),
    },
  },
  view: ({ data, params }) => (
    <Stack>
      <Text tone="dim">sorted: {params.sort} first</Text>
      <Table
        rows={data}
        empty="No reviews yet."
        columns={[
          col<Review, 'stars'>('stars', { label: '', format: (n) => '★'.repeat(n) }),
          col<Review, 'text'>('text', { label: 'review' }),
          col<Review, 'at'>('at', { label: 'date' }),
        ]}
      />
    </Stack>
  ),
})
