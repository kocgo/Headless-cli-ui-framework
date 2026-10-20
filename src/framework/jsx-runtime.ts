/**
 * JSX runtime: compiles JSX to the framework's plain view tree. No React.
 * Wired up with `"jsxImportSource": "#cui"` and the `#cui/jsx-runtime`
 * entry in package.json `imports`.
 */
import { Fragment as FragmentComponent, el, type Child, type ViewElement } from './view.js'

type Component = (props: any) => ViewElement // eslint-disable-line @typescript-eslint/no-explicit-any

export const Fragment = FragmentComponent

export function jsx(type: Component | string, props: Record<string, unknown>): ViewElement {
  if (typeof type === 'function') return type(props)
  const { children, ...rest } = props
  return el(type, rest, children as Child)
}
export const jsxs = jsx
export const jsxDEV = jsx

export declare namespace JSX {
  type Element = ViewElement
  interface ElementChildrenAttribute {
    children: object
  }
  // No intrinsic elements: only the framework's (and your) components.
  type IntrinsicElements = Record<never, never>
}
