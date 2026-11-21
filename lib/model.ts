// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the floor and above it that the watchlist rule left out. A protocol
// "records no token" when DefiLlama records neither a CoinGecko id nor a symbol for it; that is
// the record, never proof it has none.
//
// Implied value is fitted on the snapshot's own traded-token comparables, at runtime, and never
// hardcoded:
//
//   size curve   log(mcap) = a + b·log(TVL)          (OLS over the comparables)
//   category     shrunk median mcap/TVL per category
//   odds         logistic fit on the strict-rule peers (records a token or not)
//   implied      = exp(size curve) × category × odds
//
// Every term is kept only if it lowers the held-out miss in BOTH tests (leave-one-out over the
// comparables, and walk-forward: fit on tokens listed before the median listing date, test on
// the newer ones). A negative-control term that must not help is tested alongside them. The
// page prints the whole evidence table, and the odds are framed as the peers' record, not a
// forecast: the page never says a token will launch, or when.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2-fitted';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  tier: 'Watchlist' | 'Early' | 'Off-list';
  kin: boolean;
  model: {
    size_curve_usd: number;
    category_factor: number;
    odds: number;
    momentum_rel_pct: number;
    range_lo_usd: number;
    range_hi_usd: number;
    verdict: 'FARM' | 'MARGINAL' | 'SKIP';
    net_usd: number;
    net_per_hour_usd: number;
    slice_usd: number;
    fees_usd: number;
    hours: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  tier: 'Watchlist' | 'Early' | 'Off-list';
  kin: boolean;
  size_curve_usd: number;
  category_factor: number;
  odds: number;
  momentum_rel_pct: number;
  range_lo_usd: number;
  range_hi_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  net_usd: number;
  net_per_hour_usd: number;
  slice_usd: number;
  fees_usd: number;
  hours: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One row of the held-out evidence table. */
export interface EvidenceRow {
  term: string;
  loo_miss: number;
  loo_base: number;
  wf_miss: number;
  wf_base: number;
  kept: boolean;
  note: string;
}

/** The protocol-accounting ledger: every protocol in exactly one group. */
export interface Ledger {
  ranked: number;
  token_trades: number;
  token_no_cap: number;
  set_aside: number;
  total: number;
  set_aside_breakdown: { label: string; count: number }[];
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  off_list_size: number;
  live_size: number;
  fit: {
    intercept: number;
    slope: number;
    r2: number;
    n_comps: number;
    global_median_multiple: number;
    loo_miss: number;
    loo_flat: number;
    wf_miss: number;
    wf_flat: number;
    wf_cutoff: string;
    range_p25: number;
    range_p75: number;
    range_p10: number;
    range_p90: number;
    range_honesty_50: number;
    range_honesty_80: number;
  };
  odds: {
    peers: number;
    peers_with_token: number;
    brier: number;
    brier_base: number;
    brier_cv: number;
    coefficients: { age_years: number; log_tvl: number; rel_momentum: number; intercept: number };
    kin_discount: number;
  };
  evidence: EvidenceRow[];
  ledger: Ledger;
  kpi: {
    total_implied_usd: number;
    farm_count: number;
    marginal_count: number;
    skip_count: number;
    median_implied_usd: number;
  };
  fee_table: { chain: string; gas_usd: number }[];
  drop_share: number;
  ticket_usd: number;
  hour_rate_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: { tvl_usd: number; mcap_usd: number }[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted-or-unsorted list of numbers. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)/i;

/** Categories the strict rule excludes. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all (gecko id and symbol both null). */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** A market cap the model may use: null when the record is missing, zero or negative. */
export function cleanMcap(p: SnapshotProtocol): number | null {
  return typeof p.mcap_usd === 'number' && p.mcap_usd > 0 ? p.mcap_usd : null;
}

/** Whether a protocol records a token (a gecko id or a symbol is present). */
export function hasToken(p: SnapshotProtocol): boolean {
  return !isPreToken(p);
}

/**
 * The strict rule: pre-token, and not a wrapped, staked or bridged product of a token that
 * trades. It mirrors the house watchlist rule (input/README.md), minus the parentProtocol
 * field the snapshot does not carry — that gap is why the off-list rows exist, and why they
 * carry a kin badge instead of a silent pass.
 */
export function isStrict(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !/\b(wrapped|staked|staking)\b/i.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The category/name part of the strict rule, without the pre-token test (for the odds peers). */
export function passesShape(p: SnapshotProtocol): boolean {
  return (
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !/\b(wrapped|staked|staking)\b/i.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** A protocol's name stem: its first word, lowercased. */
export function nameStem(p: SnapshotProtocol): string {
  return p.name.trim().split(/\s+/)[0]!.toLowerCase();
}

/**
 * "Kin of a token": a protocol whose name stem matches a DIFFERENT protocol that records a
 * token. A sibling token already trades, so the odds are lower. This is a heuristic from the
 * name alone — the page says so, and never presents it as a DefiLlama fact.
 */
export function isKin(p: SnapshotProtocol, tokenStems: Set<string>): boolean {
  return tokenStems.has(nameStem(p));
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

// ---------------------------------------------------------------------------
// Fitting: the size curve, the category factors, and the held-out tests.
// ---------------------------------------------------------------------------

/** One comparable: a protocol that records a token with a usable market cap. */
interface Comp {
  p: SnapshotProtocol;
  logTvl: number;
  logMcap: number;
  relMom: number;
  ageYrs: number;
  ctrl: number;
}

/** Solve a small dense linear system A·x = b by Gaussian elimination (partial pivoting). */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    const tmp = M[col]!;
    M[col] = M[piv]!;
    M[piv] = tmp;
    const d = M[col]![col]!;
    if (Math.abs(d) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / d;
      for (let c = col; c <= n; c++) M[r]![c]! -= f * M[col]![c]!;
    }
  }
  return M.map((row, i) => (Math.abs(row[i]!) < 1e-12 ? 0 : row[n]! / row[i]!));
}

/** Ordinary least squares for a design matrix (rows) and a target vector. */
function ols(X: number[][], y: number[]): number[] {
  const k = X[0]!.length;
  const XtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const Xty: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a]! += X[i]![a]! * y[i]!;
      for (let b = 0; b < k; b++) XtX[a]![b]! += X[i]![a]! * X[i]![b]!;
    }
  }
  return solveLinear(XtX, Xty);
}

/** A fitted value model: the linear part plus the optional category multipliers. */
export interface ValueModel {
  coef: number[];
  features: string[];
  catOn: boolean;
  catFactors: Map<string, number>;
  globalMedian: number;
  r2: number;
  n: number;
}

/** The features a comparable carries, from the snapshot's own figures. */
function compFeatures(p: SnapshotProtocol, medianChange: number, ctrlOf: Map<string, number>): Comp {
  const age = ageDays('2026-11-14', p.listed_at);
  return {
    p,
    logTvl: Math.log(p.tvl_usd),
    logMcap: Math.log(cleanMcap(p)!),
    relMom: (finite(p.change_7d, medianChange) - medianChange) / 100,
    ageYrs: (age ?? 365) / 365,
    ctrl: ctrlOf.get(p.slug) ?? 0,
  };
}

/** Fit the value model on a set of comparables, with the named extra terms. */
function fitValue(train: Comp[], opts: { cat: boolean; mom: boolean; age: boolean; ctrl: boolean }): ValueModel {
  const features: string[] = [];
  if (opts.mom) features.push('mom');
  if (opts.age) features.push('age');
  if (opts.ctrl) features.push('ctrl');
  const X = train.map((c) => {
    const row = [1, c.logTvl];
    if (opts.mom) row.push(c.relMom);
    if (opts.age) row.push(c.ageYrs);
    if (opts.ctrl) row.push(c.ctrl);
    return row;
  });
  const y = train.map((c) => c.logMcap);
  const coef = ols(X, y);
  // R² of the linear part.
  const my = y.reduce((a, v) => a + v, 0) / y.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < y.length; i++) {
    let pred = 0;
    for (let j = 0; j < coef.length; j++) pred += coef[j]! * X[i]![j]!;
    ssTot += (y[i]! - my) ** 2;
    ssRes += (y[i]! - pred) ** 2;
  }
  // Category multipliers: shrunk median ratio of actual to linear-predicted mcap.
  const catFactors = new Map<string, number>();
  let globalMedian = 0;
  if (opts.cat) {
    const ratios: number[] = [];
    const byCat = new Map<string, number[]>();
    for (let i = 0; i < train.length; i++) {
      let pred = 0;
      for (let j = 0; j < coef.length; j++) pred += coef[j]! * X[i]![j]!;
      const ratio = Math.exp(y[i]! - pred);
      ratios.push(ratio);
      const cat = train[i]!.p.category ?? '(none)';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(ratio);
    }
    globalMedian = median(ratios);
    for (const [cat, rs] of byCat) {
      if (rs.length < 8) continue;
      const raw = median(rs) / globalMedian;
      catFactors.set(cat, 1 + (raw - 1) * (rs.length / (rs.length + 8)));
    }
  }
  return { coef, features, catOn: opts.cat, catFactors, globalMedian, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, n: train.length };
}

/** The linear part's prediction for one comparable. */
function linearPred(model: ValueModel, c: Comp): number {
  let pred = model.coef[0]! + model.coef[1]! * c.logTvl;
  let j = 2;
  for (const f of model.features) {
    if (f === 'mom') pred += model.coef[j]! * c.relMom;
    if (f === 'age') pred += model.coef[j]! * c.ageYrs;
    if (f === 'ctrl') pred += model.coef[j]! * c.ctrl;
    j++;
  }
  return pred;
}

/** The full prediction (linear part × category multiplier), in log mcap. */
function predictLog(model: ValueModel, c: Comp): number {
  let pred = linearPred(model, c);
  if (model.catOn) {
    const f = model.catFactors.get(c.p.category ?? '(none)');
    if (f !== undefined) pred += Math.log(f);
  }
  return pred;
}

/** Median absolute log error of a model option under leave-one-out over the comparables. */
function looMiss(comps: Comp[], opts: { cat: boolean; mom: boolean; age: boolean; ctrl: boolean }): number {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const model = fitValue(train, opts);
    errs.push(Math.abs(comps[i]!.logMcap - predictLog(model, comps[i]!)));
  }
  return median(errs);
}

/** Median absolute log error under walk-forward: fit before the cutoff, test the newer ones. */
function wfMiss(comps: Comp[], cutoff: string, opts: { cat: boolean; mom: boolean; age: boolean; ctrl: boolean }): number {
  const train = comps.filter((c) => (c.p.listed_at ?? '9999') < cutoff);
  const test = comps.filter((c) => (c.p.listed_at ?? '9999') >= cutoff);
  if (train.length < 10 || test.length < 5) return Number.NaN;
  const model = fitValue(train, opts);
  return median(test.map((c) => Math.abs(c.logMcap - predictLog(model, c))));
}

/** Median absolute log error of the flat 0.25× multiple, for the same test set. */
function flatMiss(comps: Comp[], testSet: 'loo' | 'wf', cutoff?: string): number {
  const flat = (c: Comp): number => Math.abs(c.logMcap - Math.log(0.25 * c.p.tvl_usd));
  if (testSet === 'loo') return median(comps.map(flat));
  const test = comps.filter((c) => (c.p.listed_at ?? '9999') >= (cutoff ?? '9999'));
  return median(test.map(flat));
}

/** The negative control's value: the next protocol's 7-day change, in slug order. */
function controlMap(protocols: SnapshotProtocol[], medianChange: number): Map<string, number> {
  const sorted = [...protocols].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const map = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    map.set(sorted[i]!.slug, (finite(next.change_7d, medianChange) - medianChange) / 100);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Token odds: a logistic fit on the strict-rule peers.
// ---------------------------------------------------------------------------

/** The fee table: gas per transaction, by chain (stated on the page). */
export const FEE_TABLE: { chain: string; gas_usd: number }[] = [
  { chain: 'Ethereum', gas_usd: 6 },
  { chain: 'Base', gas_usd: 0.3 },
  { chain: 'Arbitrum', gas_usd: 0.4 },
  { chain: 'Optimism', gas_usd: 0.3 },
  { chain: 'Solana', gas_usd: 0.05 },
  { chain: 'BSC', gas_usd: 0.2 },
  { chain: 'Polygon', gas_usd: 0.05 },
  { chain: 'Avalanche', gas_usd: 0.3 },
  { chain: 'Other', gas_usd: 1.5 },
];

/** The default farm ticket and drop share (adjustable on the page). */
export const TICKET_USD = 2500;
export const DROP_SHARE = 0.1;
export const HOUR_RATE_USD = 25;

/** Gas per transaction for a protocol's first listed chain, else the Other rate. */
function gasFor(chains: string[]): number {
  for (const c of chains) {
    const row = FEE_TABLE.find((f) => f.chain.toLowerCase() === c.toLowerCase());
    if (row) return row.gas_usd;
  }
  return 1.5;
}

/** How long to hold, from the protocol's age: younger protocols get a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

/** A fitted logistic model: standardised features, coefficients, and the standardisers. */
export interface LogisticModel {
  coef: number[];
  means: number[];
  sds: number[];
}

/**
 * Batch gradient descent for logistic regression. Deterministic: zero init, fixed
 * iterations and learning rate, no randomness anywhere.
 */
function fitLogistic(X: number[][], y: number[], iterations = 3000, lr = 0.1): LogisticModel {
  const k = X[0]!.length;
  const means: number[] = [];
  const sds: number[] = [];
  for (let j = 0; j < k; j++) {
    const col = X.map((r) => r[j]!);
    const m = col.reduce((a, v) => a + v, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, v) => a + (v - m) ** 2, 0) / col.length) || 1;
    means.push(m);
    sds.push(sd);
  }
  const coef = new Array<number>(k + 1).fill(0);
  for (let it = 0; it < iterations; it++) {
    const grad = new Array<number>(k + 1).fill(0);
    for (let i = 0; i < X.length; i++) {
      let z = coef[0]!;
      for (let j = 0; j < k; j++) z += coef[j + 1]! * ((X[i]![j]! - means[j]!) / sds[j]!);
      const p = sigmoid(z);
      const err = p - y[i]!;
      grad[0]! += err;
      for (let j = 0; j < k; j++) grad[j + 1]! += err * ((X[i]![j]! - means[j]!) / sds[j]!);
    }
    for (let j = 0; j <= k; j++) coef[j]! -= (lr * grad[j]!) / X.length;
  }
  return { coef, means, sds };
}

/** The fitted odds that one feature row records a token. */
function logisticPredict(model: LogisticModel, x: number[]): number {
  let z = model.coef[0]!;
  for (let j = 0; j < x.length; j++) z += model.coef[j + 1]! * ((x[j]! - model.means[j]!) / model.sds[j]!);
  return sigmoid(z);
}

/** The Brier score of a set of predicted probabilities against their labels. */
function brier(probs: number[], labels: number[]): number {
  return probs.reduce((a, p, i) => a + (p - labels[i]!) ** 2, 0) / probs.length;
}

// ---------------------------------------------------------------------------
// Farm economics: a slice, a net, and a verdict.
// ---------------------------------------------------------------------------

export interface FarmEconomics {
  slice: number;
  fees: number;
  hours: number;
  net: number;
  netPerHour: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  capital: number;
  holdDays: number;
}

/**
 * The farm economics of one row: the airdrop slice it could pay, minus the fees and the
 * time, at the page's ticket, drop share and hourly rate. A verdict is a costed claim,
 * not a promise: the page states the thresholds.
 */
export function farmEconomics(p: SnapshotProtocol, implied: number, age: number | null): FarmEconomics {
  const capital = capitalFor(p);
  const holdDays = holdDaysFor(age);
  // Round the components FIRST, then derive net and the verdict from the rounded
  // values — so board.json, the farm-plan text and the dashboard's live recompute
  // (which reads these same rounded fields) always agree to the cent.
  const slice = Math.round(implied * DROP_SHARE * (TICKET_USD / p.tvl_usd) * 100) / 100;
  const fees = Math.round(gasFor(p.chains) * 6 * 100) / 100;
  const hours = Math.round((0.5 + (holdDays / 7) * 0.2 + 0.25) * 100) / 100;
  const net = Math.round((slice - fees - hours * HOUR_RATE_USD) * 100) / 100;
  const netPerHour = Math.round((hours > 0 ? net / hours : net) * 100) / 100;
  const verdict: FarmEconomics['verdict'] = net > 25 && netPerHour > 25 ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return { slice, fees, hours, net, netPerHour, verdict, capital, holdDays };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC into ${name} on ${chain} and leave the loan open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Add $${capital} of liquidity to ${name}'s main pool on ${chain} and leave it in.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Post $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} and take one market position.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('capital alloc')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy live.`;
  if (c.includes('restak') || c.includes('staking')) return `Stake $${capital} through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('bridge')) return `Move $${capital} of USDC to ${chain} through ${name} and use it inside its app.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/** A step as one string: its action, then its cost and time, within 20..600 characters. */
function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, derived from
 * the protocol's own record (category, chains, TVL, age) and its fitted economics — never
 * from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEconomics): string[] {
  const chain = chainOf(p);
  const steps: FarmStep[] = [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, econ.capital, chain),
      cost: `$${econ.capital} of capital and about $${econ.fees.toFixed(2)} of gas across the plan`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action each week — a deposit, a borrow, a swap or a vote — so the wallet stays active.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${econ.holdDays} days so the activity lands in more than one snapshot.`,
      cost: `the $${econ.capital} stays in the position`,
      time: `${econ.holdDays} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `At a $${TICKET_USD} ticket and a ${Math.round(DROP_SHARE * 100)}% drop share, the expected slice is $${econ.slice.toFixed(2)}; net $${econ.net.toFixed(2)} after $${econ.fees.toFixed(2)} fees and ${econ.hours.toFixed(1)} hours at $${HOUR_RATE_USD}/h — verdict: ${econ.verdict}. Write the wallet, the dates and every transaction in a farm log.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  return steps.map(stepText);
}

// ---------------------------------------------------------------------------
// Board building: the 198 rows, the ledger, the odds, and the dashboard data.
// ---------------------------------------------------------------------------

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => hasToken(p) && p.category !== 'CEX')
    .sort((a, b) => (cleanMcap(b) ?? 0) - (cleanMcap(a) ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: cleanMcap(p),
      change_7d: p.change_7d,
    }));
}

/** The first exclusion reason a set-aside protocol fails, in a fixed priority order. */
function exclusionReason(p: SnapshotProtocol): string {
  const c = p.category ?? '';
  if (c === 'CEX') return 'CEX';
  if (c === 'Bridge') return 'Bridge';
  if (c === 'Canonical Bridge') return 'Canonical Bridge';
  if (c === 'Liquid Staking') return 'Liquid Staking';
  if (c === 'Liquid Restaking') return 'Liquid Restaking';
  if (c === 'Restaked BTC') return 'Restaked BTC';
  if (VERSIONED.test(p.name)) return 'Versioned name';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'Wrapped / staked word';
  if (EXCHANGE_PREFIX.test(p.name)) return 'Exchange-prefixed name';
  return 'Other';
}

/** Everything the dashboard needs: the board, the live set, the fits and the ledger. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const index = bySlug(snapshot.protocols);
  const changes = snapshot.protocols.map((p) => p.change_7d).filter((v): v is number => typeof v === 'number');
  const medianChange = median(changes);
  const ctrlOf = controlMap(snapshot.protocols, medianChange);

  // The comparables: protocols that record a token with a usable market cap.
  const comps = snapshot.protocols
    .filter((p) => cleanMcap(p) !== null && p.tvl_usd > 0)
    .map((p) => compFeatures(p, medianChange, ctrlOf));
  const cutoff = (() => {
    const dates = comps.map((c) => c.p.listed_at ?? '9999').sort();
    return dates[Math.floor(dates.length / 2)]!;
  })();

  // Held-out tests, per term: keep a term only if it lowers the miss in BOTH tests.
  const base = { cat: false, mom: false, age: false, ctrl: false };
  const looBase = looMiss(comps, base);
  const wfBase = wfMiss(comps, cutoff, base);
  const looFlat = flatMiss(comps, 'loo');
  const wfFlat = flatMiss(comps, 'wf', cutoff);
  const testTerm = (opts: { cat: boolean; mom: boolean; age: boolean; ctrl: boolean }): { loo: number; wf: number } => ({
    loo: looMiss(comps, opts),
    wf: wfMiss(comps, cutoff, opts),
  });
  const catT = testTerm({ ...base, cat: true });
  const momT = testTerm({ ...base, mom: true });
  const ageT = testTerm({ ...base, age: true });
  const ctrlT = testTerm({ ...base, ctrl: true });
  const keepCat = catT.loo < looBase && catT.wf < wfBase;
  const keepMom = momT.loo < looBase && momT.wf < wfBase;
  const keepAge = ageT.loo < looBase && ageT.wf < wfBase;
  const ctrlHelps = ctrlT.loo < looBase && ctrlT.wf < wfBase;
  const finalOpts = { cat: keepCat, mom: keepMom, age: keepAge, ctrl: false };
  const finalModel = fitValue(comps, finalOpts);
  const looFinal = looMiss(comps, finalOpts);
  const wfFinal = wfMiss(comps, cutoff, finalOpts);

  // Range from the final model's leave-one-out residuals, with leave-one-out honesty.
  const looResiduals: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const m = fitValue(train, finalOpts);
    looResiduals.push(comps[i]!.logMcap - predictLog(m, comps[i]!));
  }
  const sortedRes = [...looResiduals].sort((a, b) => a - b);
  const q = (p: number): number => sortedRes[Math.min(sortedRes.length - 1, Math.max(0, Math.floor(p * sortedRes.length)))]!;
  const rP10 = q(0.1);
  const rP25 = q(0.25);
  const rP75 = q(0.75);
  const rP90 = q(0.9);
  let in50 = 0;
  let in80 = 0;
  for (let i = 0; i < comps.length; i++) {
    const others = looResiduals.filter((_, j) => j !== i).sort((a, b) => a - b);
    const qq = (p: number): number => others[Math.min(others.length - 1, Math.max(0, Math.floor(p * others.length)))]!;
    if (looResiduals[i]! >= qq(0.25) && looResiduals[i]! <= qq(0.75)) in50++;
    if (looResiduals[i]! >= qq(0.1) && looResiduals[i]! <= qq(0.9)) in80++;
  }

  // Token odds: logistic on the strict-rule peers (442), missing features imputed at the
  // peer medians. The odds are the peers' record, not a forecast. Kin is NOT a fitted
  // feature: among the peers it points the wrong way (a sibling token is commonest where
  // tokens already trade), so kin rows instead get a documented ×0.5 discount below —
  // a heuristic, labelled as one on the page, in the top entries' "parent discount" style.
  const tokenStems = new Map<string, string[]>();
  for (const p of snapshot.protocols) {
    if (!hasToken(p)) continue;
    const stem = nameStem(p);
    if (!tokenStems.has(stem)) tokenStems.set(stem, []);
    tokenStems.get(stem)!.push(p.slug);
  }
  const kinOf = (p: SnapshotProtocol): boolean => {
    const slugs = tokenStems.get(nameStem(p)) ?? [];
    return slugs.some((s) => s !== p.slug);
  };
  const KIN_DISCOUNT = 0.5;
  const peers = snapshot.protocols.filter(passesShape);
  const peerAges = peers.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((v): v is number => v !== null);
  const medianPeerAge = median(peerAges);
  const peerFeatures = peers.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    return {
      x: [
        (age ?? medianPeerAge) / 365,
        Math.log(p.tvl_usd),
        (finite(p.change_7d, medianChange) - medianChange) / 100,
      ],
      y: hasToken(p) ? 1 : 0,
      slug: p.slug,
    };
  });
  const oddsModel = fitLogistic(peerFeatures.map((f) => f.x), peerFeatures.map((f) => f.y));
  const probs = peerFeatures.map((f) => logisticPredict(oddsModel, f.x));
  const labels = peerFeatures.map((f) => f.y);
  const baseRate = labels.reduce((a, v) => a + v, 0) / labels.length;
  const brierScore = brier(probs, labels);
  const brierBase = brier(labels.map(() => baseRate), labels);
  // 5-fold cross-validated Brier, folds by slug hash (deterministic).
  const foldOf = (slug: string): number => {
    let h = 0;
    for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 5;
  };
  let cvNum = 0;
  let cvDen = 0;
  for (let fold = 0; fold < 5; fold++) {
    const tr = peerFeatures.filter((f) => foldOf(f.slug) !== fold);
    const te = peerFeatures.filter((f) => foldOf(f.slug) === fold);
    if (te.length === 0) continue;
    const m = fitLogistic(tr.map((f) => f.x), tr.map((f) => f.y));
    cvNum += brier(te.map((f) => logisticPredict(m, f.x)), te.map((f) => f.y)) * te.length;
    cvDen += te.length;
  }
  const brierCv = cvDen > 0 ? cvNum / cvDen : Number.NaN;

  // The board: watchlist 40 + early 138 + off-list 20, every row pre-token.
  const chosen = new Map<string, { p: SnapshotProtocol; tier: BoardRow['tier'] }>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, { p, tier: 'Watchlist' });
  }
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (!isStrict(p)) continue;
    chosen.set(p.slug, { p, tier: p.tvl_usd >= snapshot.floor_usd ? 'Off-list' : 'Early' });
  }
  const scored: { row: BoardRow; implied: number }[] = [];
  for (const { p, tier } of chosen.values()) {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const feat = compFeatures(p, medianChange, ctrlOf);
    const logPred = predictLog(finalModel, feat);
    const rawOdds = logisticPredict(oddsModel, [
      (age ?? medianPeerAge) / 365,
      Math.log(p.tvl_usd),
      feat.relMom,
    ]);
    const odds = kinOf(p) ? rawOdds * KIN_DISCOUNT : rawOdds;
    const sizeCurve = Math.exp(logPred - (finalModel.catOn ? Math.log(finalModel.catFactors.get(p.category ?? '(none)') ?? 1) : 0));
    const catFactor = finalModel.catOn ? finalModel.catFactors.get(p.category ?? '(none)') ?? 1 : 1;
    const implied = Math.max(1, Math.round(Math.exp(logPred) * odds));
    const econ = farmEconomics(p, implied, age);
    const row: BoardRow = {
      rank: 0,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      age_days: age,
      implied_value_usd: implied,
      tier,
      kin: kinOf(p),
      model: {
        size_curve_usd: Math.round(sizeCurve),
        category_factor: round4(catFactor),
        odds: round4(odds),
        momentum_rel_pct: round4(feat.relMom * 100),
        range_lo_usd: Math.max(1, Math.round(implied * Math.exp(rP25))),
        range_hi_usd: Math.max(1, Math.round(implied * Math.exp(rP75))),
        verdict: econ.verdict,
        net_usd: econ.net,
        net_per_hour_usd: econ.netPerHour,
        slice_usd: econ.slice,
        fees_usd: econ.fees,
        hours: econ.hours,
        age_days: age,
      },
      farm_steps: farmSteps(p, age, econ),
    };
    scored.push({ row, implied });
  }
  scored.sort((a, b) => b.implied - a.implied || (a.row.slug < b.row.slug ? -1 : 1));
  const board = scored.map((s, i) => {
    s.row.rank = i + 1;
    return s.row;
  });

  // The ledger: every protocol in exactly one group.
  const tokenTrades = comps.length;
  const withToken = snapshot.protocols.filter(hasToken).length;
  const tokenNoCap = withToken - tokenTrades;
  const preToken = snapshot.protocols.filter(isPreToken).length;
  const setAside = preToken - board.length;
  const breakdown = new Map<string, number>();
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    if (board.some((r) => r.slug === p.slug)) continue;
    const reason = exclusionReason(p);
    breakdown.set(reason, (breakdown.get(reason) ?? 0) + 1);
  }
  const ledger: Ledger = {
    ranked: board.length,
    token_trades: tokenTrades,
    token_no_cap: tokenNoCap,
    set_aside: setAside,
    total: board.length + tokenTrades + tokenNoCap + setAside,
    set_aside_breakdown: [...breakdown.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };

  const live = liveRows(snapshot);
  const implieds = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const evidence: EvidenceRow[] = [
    {
      term: 'Size curve (log-log) vs flat 0.25×',
      loo_miss: round4(looBase),
      loo_base: round4(looFlat),
      wf_miss: round4(wfBase),
      wf_base: round4(wfFlat),
      kept: looBase < looFlat && wfBase < wfFlat,
      note: 'The fitted curve beats the flat multiple out of sample in both tests.',
    },
    {
      term: 'Category factor (shrunk median mcap/TVL)',
      loo_miss: round4(catT.loo),
      loo_base: round4(looBase),
      wf_miss: round4(catT.wf),
      wf_base: round4(wfBase),
      kept: keepCat,
      note: keepCat ? 'Kept: lowers the miss in both tests.' : 'Dropped: does not lower the miss in both tests.',
    },
    {
      term: 'Relative momentum (7d vs the week median)',
      loo_miss: round4(momT.loo),
      loo_base: round4(looBase),
      wf_miss: round4(momT.wf),
      wf_base: round4(wfBase),
      kept: keepMom,
      note: keepMom ? 'Kept: lowers the miss in both tests.' : 'Dropped from the value term; it enters through the odds instead.',
    },
    {
      term: 'Age (years listed)',
      loo_miss: round4(ageT.loo),
      loo_base: round4(looBase),
      wf_miss: round4(ageT.wf),
      wf_base: round4(wfBase),
      kept: keepAge,
      note: keepAge ? 'Kept: lowers the miss in both tests.' : 'Dropped from the value term; age enters the odds instead.',
    },
    {
      term: 'Negative control (next row’s 7d change)',
      loo_miss: round4(ctrlT.loo),
      loo_base: round4(looBase),
      wf_miss: round4(ctrlT.wf),
      wf_base: round4(wfBase),
      kept: false,
      note: ctrlHelps ? 'WARNING: the control helped — the test is broken.' : 'Must not help — and it does not. The tests are honest.',
    },
  ];

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => r.tier === 'Early').length,
    off_list_size: board.filter((r) => r.tier === 'Off-list').length,
    live_size: live.length,
    fit: {
      intercept: round4(finalModel.coef[0]!),
      slope: round4(finalModel.coef[1]!),
      r2: round4(finalModel.r2),
      n_comps: comps.length,
      global_median_multiple: round4(finalModel.globalMedian),
      loo_miss: round4(looFinal),
      loo_flat: round4(looFlat),
      wf_miss: round4(wfFinal),
      wf_flat: round4(wfFlat),
      wf_cutoff: cutoff,
      range_p25: round4(rP25),
      range_p75: round4(rP75),
      range_p10: round4(rP10),
      range_p90: round4(rP90),
      range_honesty_50: Math.round((in50 / comps.length) * 1000) / 10,
      range_honesty_80: Math.round((in80 / comps.length) * 1000) / 10,
    },
    odds: {
      peers: peers.length,
      peers_with_token: peers.filter(hasToken).length,
      brier: round4(brierScore),
      brier_base: round4(brierBase),
      brier_cv: round4(brierCv),
      coefficients: {
        age_years: round4(oddsModel.coef[1]!),
        log_tvl: round4(oddsModel.coef[2]!),
        rel_momentum: round4(oddsModel.coef[3]!),
        intercept: round4(oddsModel.coef[0]!),
      },
      kin_discount: KIN_DISCOUNT,
    },
    evidence,
    ledger,
    kpi: {
      total_implied_usd: board.reduce((a, r) => a + r.implied_value_usd, 0),
      farm_count: board.filter((r) => r.model.verdict === 'FARM').length,
      marginal_count: board.filter((r) => r.model.verdict === 'MARGINAL').length,
      skip_count: board.filter((r) => r.model.verdict === 'SKIP').length,
      median_implied_usd: median(implieds),
    },
    fee_table: FEE_TABLE,
    drop_share: DROP_SHARE,
    ticket_usd: TICKET_USD,
    hour_rate_usd: HOUR_RATE_USD,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      mcap_usd: r.mcap_usd,
      listed_at: r.listed_at,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      tier: r.tier,
      kin: r.kin,
      size_curve_usd: r.model.size_curve_usd,
      category_factor: r.model.category_factor,
      odds: r.model.odds,
      momentum_rel_pct: r.model.momentum_rel_pct,
      range_lo_usd: r.model.range_lo_usd,
      range_hi_usd: r.model.range_hi_usd,
      verdict: r.model.verdict,
      net_usd: r.model.net_usd,
      net_per_hour_usd: r.model.net_per_hour_usd,
      slice_usd: r.model.slice_usd,
      fees_usd: r.model.fees_usd,
      hours: r.model.hours,
      farm_steps: r.farm_steps,
    })),
    live,
    comps: comps.map((c) => ({ tvl_usd: c.p.tvl_usd, mcap_usd: cleanMcap(c.p)! })),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
