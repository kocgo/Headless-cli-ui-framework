// Fake async backend so loaders behave like real fetches.
export interface Dataset {
  id: string
  name: string
  owner: string
  domain: string
  columns: Array<{ name: string; type: string }>
  upstream: string[]
}

const names = [
  ['trades', 'markets'], ['positions', 'markets'], ['fx-rates', 'markets'],
  ['counterparties', 'reference'], ['instruments', 'reference'], ['calendars', 'reference'],
  ['pnl-daily', 'finance'], ['risk-var', 'risk'], ['risk-limits', 'risk'],
  ['model-features', 'ml'], ['model-scores', 'ml'], ['client-accounts', 'reference'],
] as const

const datasets: Dataset[] = names.map(([name, domain], i) => ({
  id: String(101 + i),
  name,
  domain,
  owner: ['ana', 'raj', 'li', 'sam'][i % 4]!,
  columns: [
    { name: 'id', type: 'string' },
    { name: 'as_of', type: 'date' },
    { name: `${name.replace('-', '_')}_value`, type: 'decimal(18,6)' },
  ],
  upstream: i > 2 ? [...new Set([101 + (i % 3), 101 + 3 + (i % 2)])].filter((u) => u !== 101 + i).map(String) : [],
}))

const delay = (ms = 40) => new Promise((r) => setTimeout(r, ms))

export async function listDatasets(q: string, page: number, size = 5) {
  await delay()
  const hits = datasets.filter((d) => !q || d.name.includes(q) || d.domain.includes(q))
  return {
    total: hits.length,
    pages: Math.max(1, Math.ceil(hits.length / size)),
    items: hits.slice((page - 1) * size, page * size),
  }
}

export async function getDataset(id: string) {
  await delay()
  return datasets.find((d) => d.id === id) ?? null // Query disallows undefined
}

export async function renameDataset(id: string, name: string) {
  await delay(60)
  const ds = datasets.find((d) => d.id === id)
  if (ds) ds.name = name
  return ds
}

export const nameOf = (id: string) => datasets.find((d) => d.id === id)?.name ?? id
