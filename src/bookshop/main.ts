#!/usr/bin/env node
import { runCli } from '../framework/index.js'
import { app } from './app.js'

await runCli(app)
