// Token Radar: one snapshot in, one ranked board out (Node 22, standard library only).
//
// Reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// pre-token protocol with the fitted model in lib/model.ts, writes the ranked board to
// /output/board.json, and copies this repository's dashboard/ and screenshots/ to /output.
// Last, it writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which this program writes
// from the same board.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardChecksum, boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

/**
 * Economics self-check: the dashboard recomputes every verdict live from the row's
 * stored slice, fees, hours and T-bill return, so those fields must reproduce the
 * model's net and verdict to the cent — otherwise the page would show a different net
 * from the farm plan. This is the check that catches a rounding drift between the two
 * (it once hid $0.18). The verdict rule is the model's own: FARM beats the T-bill
 * return on the deposit AND pays more than $25/hour; MARGINAL covers fees and time.
 */
for (const row of board) {
  const m = row.model;
  const recomputed = Math.round((m.slice_usd - m.fees_usd - m.hours * 25) * 100) / 100;
  if (Math.abs(recomputed - m.net_usd) > 0.001) {
    process.stderr.write(`token radar: ${row.slug}: the page would show net $${recomputed} but the model says $${m.net_usd}\n`);
    process.exit(1);
  }
  const nph = m.hours > 0 ? recomputed / m.hours : recomputed;
  const verdict = recomputed > m.tbill_usd && nph > 25 ? 'FARM' : recomputed > 0 ? 'MARGINAL' : 'SKIP';
  if (verdict !== m.verdict) {
    process.stderr.write(`token radar: ${row.slug}: the page would show ${verdict} but the model says ${m.verdict}\n`);
    process.exit(1);
  }
}

/**
 * Integrity self-check: the checksum the dashboard recomputes live in the browser must
 * match the board this run wrote — otherwise the page's integrity strip would show a
 * mismatch on its first load. A mismatch here means the board changed after the model
 * built it, which must never happen silently.
 */
if (boardChecksum(board) !== radar.integrity.checksum) {
  process.stderr.write(`token radar: the integrity checksum does not match the board just built\n`);
  process.exit(1);
}
if (radar.integrity.total_implied_usd !== board.reduce((a, r) => a + r.implied_value_usd, 0)) {
  process.stderr.write(`token radar: the integrity total does not match the board just built\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.off_list_size} off-list, ${radar.live_size} live)\n` +
    `token radar: ledger ${radar.ledger.ranked} ranked + ${radar.ledger.token_trades} token-trades + ${radar.ledger.token_no_cap} token-no-cap + ${radar.ledger.set_aside} set aside = ${radar.ledger.total}\n` +
    `token radar: fit log(mcap) = ${radar.fit.intercept} + ${radar.fit.slope}·log(TVL), R² ${radar.fit.r2}; held-out miss ×${Math.exp(radar.fit.loo_miss).toFixed(2)} vs flat ×${Math.exp(radar.fit.loo_flat).toFixed(2)}; walk-forward ×${Math.exp(radar.fit.wf_miss).toFixed(2)} vs flat ×${Math.exp(radar.fit.wf_flat).toFixed(2)}\n` +
    `token radar: odds Brier ${radar.odds.brier} vs base ${radar.odds.brier_base} (CV ${radar.odds.brier_cv}); ${radar.kpi.farm_count} FARM, ${radar.kpi.marginal_count} MARGINAL, ${radar.kpi.skip_count} SKIP\n` +
    `token radar: parent discount ×${radar.parent_discount} from ${radar.parent_pairs} kin pair(s) (median ratio ${radar.parent_ratio}); integrity ${radar.integrity.checksum} over ${radar.integrity.rows} rows\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
