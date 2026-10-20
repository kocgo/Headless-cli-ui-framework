/**
 * A declarative framework for apps that a person and an agent use together:
 * declare pages, intents, views and actions once; get a CLI, a terminal UI,
 * a JSON contract for agents, a shared activity log, and a pane in Claude Code.
 */
export { declare } from './declare.js'
export type { AnyAction, AnyPage, ActionDef, IntentDef, Page as PageObject, PageDef, PageState } from './declare.js'
export { defineApp, FRAMEWORK_COMMANDS } from './app.js'
export type { App, AppDef, Services } from './app.js'
export { runCli } from './cli/main.js'
export {
  Badge, Button, Divider, Input, KeyValue, Link, Outlet, Page, Row, Section, Stack, Table, Tabs, Text, col,
} from './view.js'
export type { Href, ViewNode, ViewElement, Tone } from './view.js'
export type { LogEntry } from './engine/log.js'
export { describeEntry } from './engine/log.js'
export type { Db } from './engine/db.js'
