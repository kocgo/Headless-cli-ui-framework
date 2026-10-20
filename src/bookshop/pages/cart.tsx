import { Type } from '@sinclair/typebox'
import { Button, KeyValue, Page, Table, Text, col } from '../../framework/index.js'
import { cart as cartActions, order } from '../actions.js'
import type { CartLine } from '../api.js'
import { checkoutBlockers, gbp, priceCart } from '../domain/cart.js'
import { page } from '../kit.js'
import { book } from './shelf.js'

export const cart = page('cart', {
  path: '/cart',
  description: 'Your cart',
  data: (_p, { api }) => api.getCart(),
  // Business logic lives here (and in domain/), not in the view.
  model: ({ data }) => ({ ...priceCart(data), blockers: checkoutBlockers(data) }),
  title: 'Cart',
  summary: ({ model }) => (model.items ? `${model.items} item(s), ${gbp(model.total)}` : 'empty'),

  intents: {
    checkout: {
      description: 'place the order (needs approval when the agent asks)',
      when: ({ model }) => model.blockers[0] ?? true,
      do: order.place,
      input: () => ({}),
    },
    remove: {
      description: 'remove the nth line',
      args: Type.Object({ row: Type.Integer({ minimum: 1 }) }),
      when: ({ data }) => data.length > 0 || 'the cart is empty',
      do: cartActions.remove,
      input: ({ data, args }) => {
        const line = data[args.row - 1]
        if (!line) throw new Error(`there is no row ${args.row}`)
        return { bookId: line.bookId }
      },
    },
  },

  view: ({ data, model }) => (
    <Page title="Cart" subtitle={model.items ? `${model.items} item(s)` : undefined}>
      <Table
        rows={data}
        rowLink={(l) => book.link({ genre: l.genre, slug: l.slug })}
        empty="Your cart is empty."
        columns={[
          col<CartLine, 'title'>('title'),
          col<CartLine, 'qty'>('qty', { align: 'right' }),
          col<CartLine, 'price'>('price', { label: 'line', align: 'right', format: (p, l) => gbp(p * l.qty) }),
        ]}
      />
      {data.length > 0 && (
        <KeyValue items={{ Subtotal: gbp(model.subtotal), Shipping: model.shipping ? gbp(model.shipping) : 'free', Total: gbp(model.total) }} />
      )}
      {model.toFreeShipping > 0 && <Text tone="dim">Add {gbp(model.toFreeShipping)} more for free shipping.</Text>}
      {model.blockers.map((b) => (
        <Text key={b} tone="warning">{b}</Text>
      ))}
      <Button intent="checkout" label="Checkout" hotkey="c" />
    </Page>
  ),
})
