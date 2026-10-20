import { defineApp } from '../framework/index.js'
import { cart as cartActions, order, user } from './actions.js'
import { createContext } from './kit.js'
import { book } from './pages/book.js'
import { cart } from './pages/cart.js'
import { account, activity, home, shell } from './pages/other.js'
import { search } from './pages/search.js'

export const app = defineApp({
  name: 'bookshop',
  description: 'A bookshop you and Claude use together',
  context: createContext,
  shell,
  pages: [home, search, book, cart, account, activity],
  actions: [cartActions, user, order],
})
