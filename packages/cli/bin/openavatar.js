#!/usr/bin/env node
import { main } from '../src/cli.js';

// A closed pipe (openavatar vocabulary motions | head) ends the command quietly.
for (const s of [process.stdout, process.stderr]) s.on('error', e => { if (e.code === 'EPIPE') process.exit(process.exitCode ?? 0); throw e; });
process.exitCode = await main(process.argv.slice(2));
