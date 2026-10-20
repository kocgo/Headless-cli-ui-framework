/**
 * A React renderer whose output is the framework's plain view tree.
 *
 * React is used only to run components (TanStack Router's <RouterProvider>,
 * <Outlet>, <Link>, hooks, and the app's views). Host elements are the
 * framework's primitives ('Page', 'Table', 'Button', …). TanStack's <Link>
 * renders an <a>, which becomes a 'Link' node. Function props never reach
 * the tree: the tree is data, so it can go to JSON, the terminal and the pane.
 */
import type { ReactNode } from 'react'
import Reconciler from 'react-reconciler'
import { DefaultEventPriority, LegacyRoot } from 'react-reconciler/constants.js'
import type { ViewElement, ViewNode } from '../view.js'

interface Instance {
  type: string
  props: Record<string, unknown>
  children: Array<Instance | TextInstance>
  hidden?: boolean
}
interface TextInstance {
  text: string
  hidden?: boolean
}
interface Container {
  children: Array<Instance | TextInstance>
  onCommit: () => void
}

const isText = (n: Instance | TextInstance): n is TextInstance => 'text' in n

/** Keep only plain-data props: no children, functions, refs, keys or DOM styling. */
function cleanProps(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (k === 'children' || k === 'style' || k === 'className' || k === 'ref' || typeof v === 'function' || v === undefined) continue
    out[k] = v
  }
  return out
}

const remove = <T>(list: T[], item: T) => {
  const i = list.indexOf(item)
  if (i >= 0) list.splice(i, 1)
}

const reconciler = Reconciler<string, Record<string, unknown>, Container, Instance, TextInstance, never, never, Instance | TextInstance, null, true, never, ReturnType<typeof setTimeout>, -1>({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  noTimeout: -1,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  getRootHostContext: () => null,
  getChildHostContext: (parent) => parent,
  createInstance: (type, props) => ({ type, props: cleanProps(props), children: [] }),
  createTextInstance: (text) => ({ text }),
  appendInitialChild: (parent, child) => void parent.children.push(child),
  appendChild: (parent, child) => {
    remove(parent.children, child)
    parent.children.push(child)
  },
  appendChildToContainer: (container, child) => {
    remove(container.children, child)
    container.children.push(child)
  },
  insertBefore: (parent, child, before) => {
    remove(parent.children, child)
    parent.children.splice(parent.children.indexOf(before), 0, child)
  },
  insertInContainerBefore: (container, child, before) => {
    remove(container.children, child)
    container.children.splice(container.children.indexOf(before), 0, child)
  },
  removeChild: (parent, child) => remove(parent.children, child),
  removeChildFromContainer: (container, child) => remove(container.children, child),
  clearContainer: (container) => void (container.children = []),
  finalizeInitialChildren: () => false,
  prepareUpdate: () => true,
  commitUpdate: (instance, _payload, _type, _old, next) => void (instance.props = cleanProps(next)),
  commitTextUpdate: (text, _old, next) => void (text.text = next),
  resetTextContent: () => {},
  shouldSetTextContent: () => false,
  getPublicInstance: (i) => i,
  prepareForCommit: () => null,
  resetAfterCommit: (container) => container.onCommit(),
  preparePortalMount: () => {},
  getCurrentEventPriority: () => DefaultEventPriority,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  detachDeletedInstance: () => {},
  hideInstance: (i) => void (i.hidden = true),
  unhideInstance: (i) => void (i.hidden = false),
  hideTextInstance: (t) => void (t.hidden = true),
  unhideTextInstance: (t) => void (t.hidden = false),
})

/** Host elements TanStack's own components (or stray JSX) might render, mapped onto primitives. */
function toNode(n: Instance | TextInstance): ViewNode | null {
  if (n.hidden) return null
  if (isText(n)) return n.text
  const children = n.children.map(toNode).filter((c): c is ViewNode => c !== null && c !== '')
  const el = (type: string, props: Record<string, unknown> = {}): ViewElement => ({ type, props, children })
  switch (n.type) {
    case 'a': // TanStack's <Link>
      return el('Link', { href: n.props.href, active: n.props['data-status'] === 'active' })
    case 'div':
    case 'p':
    case 'section':
      return el('Stack')
    case 'span':
    case 'strong':
    case 'em':
    case 'code':
    case 'pre':
      return el('Text', n.type === 'strong' ? { tone: 'bold' } : {})
    default:
      return { type: n.type, props: n.props, children }
  }
}

/** A root that renders React elements into a plain view tree. */
export function createRoot() {
  let version = 0
  const listeners = new Set<() => void>()
  const container: Container = {
    children: [],
    onCommit: () => {
      version++
      listeners.forEach((l) => l())
    },
  }
  const root = reconciler.createContainer(container, LegacyRoot, null, false, null, '', (e: unknown) => console.error(e), null)

  return {
    render(element: ReactNode) {
      reconciler.flushSync(() => reconciler.updateContainer(element, root, null, () => {}))
    },
    /** Let passive effects (useEffect) and scheduled updates run. */
    async flush() {
      for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r))
    },
    /** The current output as a plain tree. */
    snapshot(): ViewNode {
      const nodes = container.children.map(toNode).filter((c): c is ViewNode => c !== null)
      return nodes.length === 1 ? nodes[0]! : { type: 'Stack', props: {}, children: nodes }
    },
    get version() {
      return version
    },
    onCommit(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    unmount() {
      reconciler.flushSync(() => reconciler.updateContainer(null, root, null, () => {}))
    },
  }
}

export type Root = ReturnType<typeof createRoot>
