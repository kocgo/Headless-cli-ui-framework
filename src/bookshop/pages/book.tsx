import { Type } from '@sinclair/typebox'
import { Badge, Button, KeyValue, Link, Page, Row, type Href } from '../../framework/index.js'
import { cart } from '../actions.js'
import { gbp } from '../domain/cart.js'
import { page } from '../kit.js'
import { search } from './search.js'

/** `bookshop book 3` → /books/3 */
export const book = page('book', {
  path: '/books/$id',
  description: 'One book',
  params: Type.Object({ id: Type.String({ description: 'book id' }) }),
  positional: ['id'],
  data: ({ id }, { api }) => api.getBook(id), // null → "not found"
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
    more: {
      description: 'more books in this genre',
      to: ({ data }): Href => search.link({ genre: data.genre }),
    },
  },

  view: ({ data, model }) => (
    <Page title={data.title} subtitle={`by ${data.author}`}>
      <KeyValue items={{ Genre: data.genre, Price: gbp(data.price), Stock: model.inStock ? String(data.stock) : 'sold out' }} />
      {model.lowStock && <Badge tone="warning">only {data.stock} left</Badge>}
      <Row>
        <Button intent="add" label="Add to cart" hotkey="a" />
        <Button intent="more" label={`More ${data.genre}`} hotkey="m" />
        <Link to={search.link()}>All books</Link>
      </Row>
    </Page>
  ),
})
