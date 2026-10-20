import { Type } from '@sinclair/typebox'
import { defineAction, type ActionRegistry } from '../core/actions.js'
import type { Backend } from './backend.js'

const Email = Type.String({ pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', description: 'email address' })

export const createActions = (api: Backend) =>
  ({
    'cart.add': defineAction({
      description: 'Add a book to the cart',
      input: Type.Object({
        bookId: Type.String(),
        qty: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
      }),
      invalidates: () => [['cart']],
      precheck: ({ bookId }) => (api.getBook(bookId) ? undefined : `no book ${bookId}`),
      run: ({ bookId, qty }) => api.addToCart(bookId, qty ?? 1),
    }),
    'cart.remove': defineAction({
      description: 'Remove a book from the cart',
      input: Type.Object({ bookId: Type.String() }),
      invalidates: () => [['cart']],
      run: ({ bookId }) => api.removeFromCart(bookId),
    }),
    'user.updateEmail': defineAction({
      description: "Change the account's email address",
      input: Type.Object({ email: Email }),
      requiresApproval: true,
      invalidates: () => [['account']],
      run: ({ email }) => api.updateEmail(email),
    }),
    'order.place': defineAction({
      description: 'Place an order for everything in the cart',
      input: Type.Object({}),
      requiresApproval: true,
      invalidates: () => [['cart'], ['orders'], ['books']],
      precheck: () => (api.getCart().lines.length ? undefined : 'cart is empty'),
      run: () => api.placeOrder(),
    }),
  }) satisfies ActionRegistry
