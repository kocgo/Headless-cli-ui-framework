import { defineApp } from '../framework/index.js'
import { cart as cartActions, order, user } from './actions.js'
import { createContext } from './kit.js'
import { cart } from './pages/cart.js'
import { account, activity, home, shell } from './pages/other.js'
import { search } from './pages/search.js'
import { shelf } from './pages/shelf.js'

export const app = defineApp({
  name: 'bookshop',
  description: 'A bookshop you and Claude use together',
  context: createContext,
  shell,
  // Children and tabs (book, details, reviews) come along with their parent.
  pages: [home, search, shelf, cart, account, activity],
  actions: [cartActions, user, order],
})
