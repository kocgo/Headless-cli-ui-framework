import { Type } from '@sinclair/typebox'
import { Button, Page, Row, Table, Text, col, type Href } from '../../framework/index.js'
import type { Book } from '../api.js'
import { gbp } from '../domain/cart.js'
import { page } from '../kit.js'
import { book } from './book.js'

/**
 * `bookshop search --query 1984`
 *   → navigates to /search?query=1984
 *   → fetches searchBooks({ query: '1984', … }) through the query cache
 *   → logs: visit search {"query":"1984"} · 1 result for "1984"
 */
export const search = page('search', {
  path: '/search',
  description: 'Search books by title, author or genre',
  params: Type.Object({
    query: Type.Optional(Type.String({ description: 'title, author or genre contains' })),
    genre: Type.Optional(Type.String()),
    sort: Type.Union([Type.Literal('title'), Type.Literal('price'), Type.Literal('author')], { default: 'title' }),
    page: Type.Integer({ minimum: 1, default: 1 }),
  }),
  positional: ['query'],
  data: async (p, { api }) => ({ ...(await api.searchBooks(p)), genres: await api.genres() }),
  title: ({ params }) => (params.query ? `Search: ${params.query}` : 'All books'),
  summary: ({ data, params }) =>
    `${data.total} result${data.total === 1 ? '' : 's'}${params.query ? ` for "${params.query}"` : ''}${params.genre ? ` in ${params.genre}` : ''}`,

  intents: {
    open: {
      description: 'open the nth book on this page',
      args: Type.Object({ row: Type.Integer({ minimum: 1 }) }),
      when: ({ data }) => data.items.length > 0 || 'no results',
      to: ({ data, args }): Href => {
        const b = data.items[args.row - 1]
        if (!b) throw new Error(`there is no row ${args.row}`)
        return book.link({ id: b.id })
      },
    },
    next: {
      description: 'next page of results',
      when: ({ data, params }) => params.page < data.pages || 'already on the last page',
      to: ({ params, link }) => link({ ...params, page: params.page + 1 }),
    },
    prev: {
      description: 'previous page of results',
      when: ({ params }) => params.page > 1 || 'already on the first page',
      to: ({ params, link }) => link({ ...params, page: params.page - 1 }),
    },
    sort: {
      description: 'sort by title, price or author',
      args: Type.Object({ by: Type.Union([Type.Literal('title'), Type.Literal('price'), Type.Literal('author')]) }),
      to: ({ params, args, link }) => link({ ...params, sort: args.by, page: 1 }),
    },
    genre: {
      description: 'filter by genre ("all" clears it)',
      args: Type.Object({ name: Type.String() }),
      to: ({ params, args, link }) => link({ ...params, genre: args.name === 'all' ? undefined : args.name, page: 1 }),
    },
  },

  view: ({ data, params }) => (
    <Page
      title={params.query ? `Results for "${params.query}"` : 'All books'}
      subtitle={`${data.total} book(s) · sorted by ${params.sort} · genre: ${params.genre ?? 'all'} (${data.genres.join(', ')})`}
    >
      <Table
        rows={data.items}
        rowIntent="open"
        empty="No books match."
        columns={[
          col<Book, 'title'>('title'),
          col<Book, 'author'>('author'),
          col<Book, 'price'>('price', { align: 'right', format: gbp }),
          col<Book, 'stock'>('stock', { label: '', format: (s) => (s > 0 ? '' : 'sold out') }),
        ]}
      />
      <Row>
        <Button intent="prev" label="Previous" hotkey="p" />
        <Text tone="dim">page {params.page} of {data.pages}</Text>
        <Button intent="next" label="Next" hotkey="n" />
      </Row>
    </Page>
  ),
})
