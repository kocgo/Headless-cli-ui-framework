/**
 * Business rules for the cart: plain TypeScript, no framework, unit-testable.
 * The cart page's model, the checkout intent's `when`, and the order action's
 * precheck all call these, so the screen and the write can never disagree.
 */
import type { CartLine } from '../api.js'

export const FREE_SHIPPING_FROM = 25
export const SHIPPING = 3.99

const round = (n: number) => Math.round(n * 100) / 100

export function priceCart(lines: CartLine[]) {
  const subtotal = round(lines.reduce((s, l) => s + l.price * l.qty, 0))
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING
  return {
    items: lines.reduce((s, l) => s + l.qty, 0),
    subtotal,
    shipping,
    total: round(subtotal + shipping),
    toFreeShipping: subtotal === 0 ? 0 : round(Math.max(0, FREE_SHIPPING_FROM - subtotal)),
  }
}

export function checkoutBlockers(lines: CartLine[]): string[] {
  return [
    ...(lines.length ? [] : ['the cart is empty']),
    ...lines.filter((l) => l.qty > l.stock).map((l) => `only ${l.stock} of "${l.title}" left`),
  ]
}

export const gbp = (n: number) => `£${n.toFixed(2)}`
