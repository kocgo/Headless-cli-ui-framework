/** Writes. Each is typed, validated, logged, and (for an agent) maybe approval-gated. */
import { Type } from '@sinclair/typebox'
import { action, actions } from './kit.js'
import { checkoutBlockers, gbp, priceCart } from './domain/cart.js'

export const cart = actions('cart', {
  add: action({
    description: 'Add a book to the cart',
    input: Type.Object({
      bookId: Type.String({ description: 'book id' }),
      qty: Type.Integer({ minimum: 1, default: 1 }),
    }),
    precheck: async ({ bookId, qty }, { api }) => {
      const book = await api.getBook(bookId)
      if (!book) return `there is no book ${bookId}`
      const inCart = (await api.getCart()).find((l) => l.bookId === bookId)?.qty ?? 0
      if (inCart + qty > book.stock) return `only ${book.stock} of "${book.title}" in stock`
    },
    run: ({ bookId, qty }, { api }) => api.addToCart(bookId, qty),
    invalidates: ['cart', 'shell'],
    summary: ({ qty }, r) => `added ${qty} × ${r.title}`,
  }),
  remove: action({
    description: 'Remove a book from the cart',
    input: Type.Object({ bookId: Type.String() }),
    run: ({ bookId }, { api }) => api.removeFromCart(bookId),
    invalidates: ['cart', 'shell'],
    summary: (_i, r) => `removed ${r.title}`,
  }),
})

export const user = actions('user', {
  updateEmail: action({
    description: "Change the account's email address",
    input: Type.Object({ email: Type.String({ pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', description: 'email address' }) }),
    requiresApproval: true,
    run: ({ email }, { api }) => api.updateEmail(email),
    invalidates: ['account'],
    summary: (_i, r) => `email changed from ${r.before} to ${r.after}`,
  }),
})

export const order = actions('order', {
  place: action({
    description: 'Place an order for everything in the cart',
    input: Type.Object({}),
    requiresApproval: true,
    // Same rule the cart page shows and the checkout intent checks.
    precheck: async (_i, { api }) => checkoutBlockers(await api.getCart())[0],
    run: async (_i, { api }) => api.placeOrder(priceCart(await api.getCart()).total),
    invalidates: ['cart', 'account', 'search', 'book', 'shell'],
    summary: (_i, r) => `order #${r.orderId} placed, ${r.items} line(s), ${gbp(r.total)}`,
  }),
})
