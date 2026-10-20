import { Type } from '@sinclair/typebox'
import { Badge, Divider, Input, KeyValue, Link, Page, Row, Stack, Table, Text, col, describeEntry, type LogEntry } from '../../framework/index.js'
import { user } from '../actions.js'
import type { Order } from '../api.js'
import { gbp, priceCart } from '../domain/cart.js'
import { layout, page } from '../kit.js'
import { search } from './search.js'

/** Wraps every page: title bar, cart badge, a search box, then the page (`outlet`). */
export const shell = layout('shell', {
  data: (_p, { api }) => api.getCart(),
  model: ({ data }) => ({ items: priceCart(data).items }),
  view: ({ model, outlet }) => (
    <Stack gap={1}>
      <Row>
        <Text tone="bold">Bookshop</Text>
        <Badge>{model.items ? `cart: ${model.items}` : 'cart empty'}</Badge>
      </Row>
      <Input page={search} param="query" label="Search" placeholder="title, author or genre" />
      <Divider />
      {outlet}
    </Stack>
  ),
})

export const home = page('home', {
  path: '/',
  description: 'Start page',
  data: (_p, { api }) => api.genres(),
  title: 'Bookshop',
  view: ({ data }) => (
    <Page title="Welcome" subtitle="Browse by genre, or search above.">
      <Row>{data.map((g) => <Link to={search.link({ genre: g })}>{g}</Link>)}</Row>
    </Page>
  ),
})

export const account = page('account', {
  path: '/account',
  description: 'Account details and orders',
  data: async (_p, { api }) => ({ account: await api.getAccount(), orders: await api.listOrders() }),
  title: 'Account',
  summary: ({ data }) => `${data.orders.length} order(s)`,
  intents: {
    email: {
      description: 'change the email address (needs approval when the agent asks)',
      args: Type.Object({ address: Type.String() }),
      do: user.updateEmail,
      input: ({ args }) => ({ email: args.address }),
    },
  },
  view: ({ data }) => (
    <Page title="Account">
      <KeyValue items={{ Name: data.account.name, Email: data.account.email }} />
      <Text tone="dim">Change it with: email &lt;address&gt;</Text>
      <Table
        rows={data.orders}
        empty="No orders yet."
        columns={[
          col<Order, 'id'>('id', { label: 'order', format: (id) => `#${id}` }),
          col<Order, 'at'>('at', { label: 'placed', format: (at) => at.slice(0, 16).replace('T', ' ') }),
          col<Order, 'items'>('items', { format: (i) => String(i.length) }),
          col<Order, 'total'>('total', { align: 'right', format: gbp }),
        ]}
      />
    </Page>
  ),
})

export const activity = page('activity', {
  path: '/activity',
  description: 'What you and the agent have done',
  params: Type.Object({ n: Type.Integer({ minimum: 1, maximum: 200, default: 15 }) }),
  data: ({ n }, { log }) => log.tail(n).reverse(),
  refreshOnActivity: true,
  title: 'Activity',
  view: ({ data }) => (
    <Page title="Activity" subtitle="Newest first">
      <Table
        rows={data}
        empty="Nothing yet."
        columns={[col<LogEntry, 'id'>('id', { label: 'what', format: (_id, e) => describeEntry(e).replace(/^#\d+ /, '') })]}
      />
    </Page>
  ),
})
