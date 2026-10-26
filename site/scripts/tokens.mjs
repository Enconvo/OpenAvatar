#!/usr/bin/env node
// The API's tokens, for the gallery's owners: lists them with their calls this month, makes one (a token for an app of
// the project's own can have no monthly limit), and revokes one. Writes are dry runs until --yes. Without --remote it
// works on the local database that `wrangler dev` uses. A new token is shown once: with --out it goes only into that
// file (readable by you alone), so it stays out of the terminal and its logs.
//
//   node scripts/tokens.mjs list [--remote]
//   node scripts/tokens.mjs create --name "<what it's for>" [--unlimited | --limit <calls a month>] [--out <file>] [--remote] [--yes]
//   node scripts/tokens.mjs revoke <id or shown_as> [--remote] [--yes]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { FREE_MONTHLY_CALLS, monthOf, newToken, sha256, shownAs } from '../src/api.js';
import { sql, wranglerRunner } from './review.mjs';

const USAGE = `node scripts/tokens.mjs list [--remote]
node scripts/tokens.mjs create --name "<what it's for>" [--unlimited | --limit <calls a month>] [--out <file>] [--remote] [--yes]
node scripts/tokens.mjs revoke <id or shown_as> [--remote] [--yes]`;

const usageError = message => Object.assign(new Error(message), { usage: true });
const limitText = limit => (limit == null ? 'no limit' : `${Number(limit).toLocaleString('en')} a month`);

const COMMANDS = {
  async list(o, { run, say }) {
    const rows = await run(`SELECT t.id, t.prefix, t.name, t.monthly_limit, t.created_at, t.revoked_at, COALESCE(u.calls, 0) AS calls
      FROM api_tokens t LEFT JOIN api_usage u ON u.token_id = t.id AND u.month = ${sql(monthOf())} ORDER BY t.created_at`);
    if (!rows.length) { say('No tokens.'); return; }
    for (const r of rows) {
      say(`${r.id.slice(0, 8)}  ${r.prefix}  ${r.revoked_at ? 'revoked' : `${r.calls} calls this month, ${limitText(r.monthly_limit)}`}  ${r.name ?? ''}`.trimEnd());
    }
  },

  async create(o, { run, say, write }) {
    const name = o.name?.trim();
    if (!name || name.length > 60) throw usageError('Give the token a --name of at most 60 characters.');
    if (o.unlimited && o.limit) throw usageError('Choose --unlimited or --limit, not both.');
    const limit = o.unlimited ? null : o.limit ? Number(o.limit) : FREE_MONTHLY_CALLS;
    if (limit !== null && !(Number.isInteger(limit) && limit > 0)) throw usageError('--limit is a whole number of calls a month.');
    if (!o.yes) { say(`Would make a token named "${name}" with ${limitText(limit)}${o.out ? `, written to ${o.out}` : ''}. Add --yes to make it.`); return; }
    const token = newToken();
    await run(`INSERT INTO api_tokens (id, hash, prefix, name, monthly_limit, created_at) VALUES (${sql(crypto.randomUUID())},
      ${sql(await sha256(token))}, ${sql(shownAs(token))}, ${sql(name)}, ${limit ?? 'NULL'}, ${sql(new Date().toISOString())})`);
    if (o.out) {
      write(o.out, `${token}\n`);
      say(`Made ${shownAs(token)} ("${name}", ${limitText(limit)}). The token is in ${o.out}.`);
    } else {
      say(`Made "${name}" (${limitText(limit)}). It is shown this once:\n${token}`);
    }
  },

  async revoke(o, { run, say, positionals }) {
    const [which] = positionals;
    if (!which) throw usageError('Name the token to revoke: its id (or the start of it), or how it is shown (oa_…).');
    const rows = await run(`SELECT id, prefix, name FROM api_tokens WHERE revoked_at IS NULL AND (id LIKE ${sql(`${which.replace(/[%_]/g, '')}%`)} OR prefix = ${sql(which)})`);
    if (rows.length !== 1) throw new Error(rows.length ? `${rows.length} tokens match ${which}; give more of the id.` : `No token matches ${which}.`);
    const [row] = rows;
    if (!o.yes) { say(`Would revoke ${row.prefix} ("${row.name ?? ''}"). Apps using it would stop working at once. Add --yes to revoke it.`); return; }
    await run(`UPDATE api_tokens SET revoked_at = ${sql(new Date().toISOString())} WHERE id = ${sql(row.id)} AND revoked_at IS NULL`);
    say(`Revoked ${row.prefix}.`);
  },
};

/** deps: { run(sql) → rows, out(text), write(file, text) } */
export async function tokens(argv, deps = {}) {
  const say = deps.out ?? (t => process.stdout.write(`${t}\n`));
  const [name, ...rest] = argv;
  const command = COMMANDS[name];
  if (!command) { say(USAGE); return name ? 2 : 0; }
  let args;
  try {
    args = parseArgs({ args: rest, allowPositionals: true, options: {
      remote: { type: 'boolean' }, yes: { type: 'boolean' }, unlimited: { type: 'boolean' },
      name: { type: 'string' }, limit: { type: 'string' }, out: { type: 'string' },
    } });
  } catch (e) { say(`${e.message}\n\n${USAGE}`); return 2; }
  try {
    await command(args.values, {
      run: deps.run ?? wranglerRunner({ remote: args.values.remote }), say, positionals: args.positionals,
      write: deps.write ?? ((file, text) => fs.writeFileSync(file, text, { mode: 0o600, flag: 'wx' })),
    });
    return 0;
  } catch (e) {
    say(e.usage ? `${e.message}\n\n${USAGE}` : e.message);
    return e.usage ? 2 : 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await tokens(process.argv.slice(2));
