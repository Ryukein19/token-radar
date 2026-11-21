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
//   category     tested two ways — a shrunk median mcap/TVL and a ridge on category
//                dummies — and DROPPED both times: neither lowers the held-out miss in
//                both tests, so the value model stays the size curve alone
//   odds         logistic fit on the strict-rule peers (records a token or not)
//   implied      = exp(size curve) × category × odds × parent discount (off-list kin only)
//
// Every term is kept only if it lowers the held-out miss in BOTH tests (leave-one-out over the
// comparables, and walk-forward: fit on tokens listed before the median listing date, test on
// the newer ones). A negative-control term that must not help is tested alongside them. The
// page prints the whole evidence table, and the odds are framed as the peers' record, not a
// forecast: the page never says a token will launch, or when.
//
// v2 (radar-3-fitted): the farm economics are deposit-based (a small share of the protocol's
// own TVL, capped) and judged against a T-bill return plus $25/hour; the odds get their own
// term-by-term evidence table; the fitted coefficients carry bootstrap standard errors; and
// off-list kin rows carry a parent discount derived from the snapshot's own kin pairs.

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
export const MODEL_VERSION = 'radar-3-fitted';

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
    deposit_usd: number;
    tbill_usd: number;
    parent_discount: number;
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
  deposit_usd: number;
  tbill_usd: number;
  parent_discount: number;
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

/** One row of the held-out evidence table (value model). */
export interface EvidenceRow {
  term: string;
  loo_miss: number;
  loo_base: number;
  wf_miss: number;
  wf_base: number;
  kept: boolean;
  note: string;
}

/** One row of the held-out evidence table (token-odds model). */
export interface OddsEvidenceRow {
  term: string;
  loo_brier: number;
  loo_base: number;
  wf_brier: number;
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

/** The integrity strip's numbers: the board recomputing itself, live in the browser. */
export interface Integrity {
  checksum: string;
  rows: number;
  watchlist_covered: number;
  watchlist_size: number;
  ledger_total: number;
  total_implied_usd: number;
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
    slope_se: number;
    intercept_se: number;
    category_effect_min: number;
    category_effect_max: number;
  };
  odds: {
    peers: number;
    peers_with_token: number;
    brier: number;
    brier_base: number;
    brier_cv: number;
    coefficients: { age_years: number; log_tvl: number; rel_momentum: number; kin: number; intercept: number };
    coefficients_se: { age_years: number; log_tvl: number; rel_momentum: number; kin: number; intercept: number };
    kin_discount: number;
    kin_fitted: boolean;
  };
  evidence: EvidenceRow[];
  odds_evidence: OddsEvidenceRow[];
  ledger: Ledger;
  integrity: Integrity;
  kpi: {
    total_implied_usd: number;
    farm_count: number;
    marginal_count: number;
    skip_count: number;
    median_implied_usd: number;
  };
  fee_table: { chain: string; gas_usd: number }[];
  deposit_rate: number;
  deposit_cap_usd: number;
  drop_share: number;
  horizon_days: number;
  tbill_rate: number;
  hour_rate_usd: number;
  parent_discount: number;
  parent_pairs: number;
  parent_ratio: number;
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
  logChains: number;
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

/** Least squares with a per-coefficient ridge penalty (0 = unpenalised). */
function olsRidge(X: number[][], y: number[], penalties: number[]): number[] {
  const k = X[0]!.length;
  const XtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const Xty: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a]! += X[i]![a]! * y[i]!;
      for (let b = 0; b < k; b++) XtX[a]![b]! += X[i]![a]! * X[i]![b]!;
    }
  }
  for (let a = 0; a < k; a++) XtX[a]![a]! += penalties[a] || 0;
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
    logChains: Math.log(Math.max(1, p.chains.length)),
  };
}

/** The categories with at least `minN` comparables, in a fixed order. */
function catList(train: Comp[], minN: number): string[] {
  const counts = new Map<string, number>();
  for (const c of train) {
    const cat = c.p.category ?? '(none)';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= minN).map(([cat]) => cat).sort();
}

/**
 * Fit the value model on a set of comparables. `opts.cat` is the shrunk-median category
 * factor (prior `catPrior`); `opts.ridge` is the ridge on category dummies (penalty `lam`,
 * categories with at least `minN` comparables). The two category methods are alternatives:
 * only one runs at a time, and the evidence table tests each on its own.
 */
function fitValue(
  train: Comp[],
  opts: { cat: boolean; catPrior: number; ridge: { lam: number; minN: number } | null; mom: boolean; age: boolean; ctrl: boolean },
): ValueModel {
  const features: string[] = [];
  if (opts.mom) features.push('mom');
  if (opts.age) features.push('age');
  if (opts.ctrl) features.push('ctrl');
  const cats = opts.ridge ? catList(train, opts.ridge.minN) : [];
  const X = train.map((c) => {
    const row = [1, c.logTvl];
    if (opts.mom) row.push(c.relMom);
    if (opts.age) row.push(c.ageYrs);
    if (opts.ctrl) row.push(c.ctrl);
    for (const cat of cats) row.push((c.p.category ?? '(none)') === cat ? 1 : 0);
    return row;
  });
  const y = train.map((c) => c.logMcap);
  const penalties = [0, 0, ...features.map(() => 0), ...cats.map(() => opts.ridge!.lam)];
  const coef = olsRidge(X, y, penalties);
  const my = y.reduce((a, v) => a + v, 0) / y.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < y.length; i++) {
    let pred = 0;
    for (let j = 0; j < coef.length; j++) pred += coef[j]! * X[i]![j]!;
    ssTot += (y[i]! - my) ** 2;
    ssRes += (y[i]! - pred) ** 2;
  }
  // Category multipliers: either the ridge dummies (exp of the dummy coefficient) or the
  // shrunk median ratio of actual to linear-predicted mcap.
  const catFactors = new Map<string, number>();
  let globalMedian = 0;
  if (opts.ridge) {
    for (let j = 0; j < cats.length; j++) catFactors.set(cats[j]!, Math.exp(coef[2 + features.length + j]!));
  } else if (opts.cat) {
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
      catFactors.set(cat, 1 + (raw - 1) * (rs.length / (rs.length + opts.catPrior)));
    }
  }
  return { coef, features, catOn: opts.cat || opts.ridge !== null, catFactors, globalMedian, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, n: train.length };
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

/** Median absolute log error of a fit function under leave-one-out over the comparables. */
function looMiss(comps: Comp[], fitFn: (train: Comp[]) => ValueModel): number {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const model = fitFn(train);
    errs.push(Math.abs(comps[i]!.logMcap - predictLog(model, comps[i]!)));
  }
  return median(errs);
}

/** Median absolute log error under walk-forward: fit before the cutoff, test the newer ones. */
function wfMiss(comps: Comp[], cutoff: string, fitFn: (train: Comp[]) => ValueModel): number {
  const train = comps.filter((c) => (c.p.listed_at ?? '9999') < cutoff);
  const test = comps.filter((c) => (c.p.listed_at ?? '9999') >= cutoff);
  if (train.length < 10 || test.length < 5) return Number.NaN;
  const model = fitFn(train);
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

/**
 * The farm plan's economics, derived from the protocol's own TVL and stated on the page:
 * the deposit is 0.20% of the protocol's TVL, capped at $50,000 — a small share of a big
 * protocol, a real position in a small one. The drop share is 7% of the implied value,
 * over a 12-week (84-day) horizon. Net is judged against the T-bill return on the deposit
 * (4.5%/yr) and against $25/hour of the farmer's time.
 */
export const DEPOSIT_RATE = 0.002;
export const DEPOSIT_CAP_USD = 50000;
export const DROP_SHARE = 0.07;
export const HORIZON_DAYS = 84;
export const TBILL_RATE = 0.045;
export const HOUR_RATE_USD = 25;

/** Gas per transaction for a protocol's first listed chain, else the Other rate. */
function gasFor(chains: string[]): number {
  for (const c of chains) {
    const row = FEE_TABLE.find((f) => f.chain.toLowerCase() === c.toLowerCase());
    if (row) return row.gas_usd;
  }
  return 1.5;
}

/** How much capital one farm position needs: 0.20% of the protocol's TVL, capped at $50,000. */
export function depositFor(p: SnapshotProtocol): number {
  return Math.round(Math.min(DEPOSIT_RATE * p.tvl_usd, DEPOSIT_CAP_USD));
}

/** How long the farm runs: the 12-week horizon, for every row. */
function hoursFor(): number {
  return 0.5 + (HORIZON_DAYS / 7) * 0.2 + 0.25;
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
 * Logistic regression by iteratively reweighted least squares (Newton-Raphson): a tiny
 * ridge (1e-6) on the non-intercept coefficients keeps the Hessian invertible when a
 * feature barely varies. Deterministic: zero init, fixed iterations, no randomness.
 * It converges to the same maximum likelihood as gradient descent, in ~10 steps instead
 * of ~3,000 — which is what makes the leave-one-out Brier table affordable.
 */
function fitLogistic(X: number[][], y: number[]): LogisticModel {
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
  for (let iter = 0; iter < 25; iter++) {
    const grad = new Array<number>(k + 1).fill(0);
    const H: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(k + 1).fill(0));
    for (let i = 0; i < X.length; i++) {
      const xs = new Array<number>(k + 1);
      xs[0] = 1;
      for (let j = 0; j < k; j++) xs[j + 1] = (X[i]![j]! - means[j]!) / sds[j]!;
      let z = 0;
      for (let a = 0; a <= k; a++) z += coef[a]! * xs[a]!;
      const p = sigmoid(z);
      const w = Math.max(p * (1 - p), 1e-9);
      const err = p - y[i]!;
      for (let a = 0; a <= k; a++) {
        grad[a]! += err * xs[a]!;
        for (let b = 0; b <= k; b++) H[a]![b]! += w * xs[a]! * xs[b]!;
      }
    }
    for (let a = 1; a <= k; a++) H[a]![a]! += 1e-6;
    const step = solveLinear(H, grad);
    let maxStep = 0;
    for (let a = 0; a <= k; a++) {
      coef[a]! -= step[a]!;
      maxStep = Math.max(maxStep, Math.abs(step[a]!));
    }
    if (maxStep < 1e-8) break;
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
  deposit: number;
  tbill: number;
  net: number;
  netPerHour: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  holdDays: number;
}

/**
 * The farm economics of one row: the airdrop slice it could pay, minus the fees and the
 * time, at the page's deposit, drop share, horizon, T-bill rate and hourly rate. The slice
 * is the implied value × the drop share × the farmer's share of the protocol (deposit /
 * TVL). A verdict is a costed claim, not a promise: FARM beats the T-bill return on the
 * deposit AND pays more than $25/hour; MARGINAL covers fees and time; the rest is SKIP.
 * The components are rounded FIRST, then net and the verdict derive from the rounded
 * values — so board.json, the farm-plan text and the dashboard's live recompute (which
 * reads these same rounded fields) always agree to the cent.
 */
export function farmEconomics(p: SnapshotProtocol, implied: number): FarmEconomics {
  const deposit = depositFor(p);
  const holdDays = HORIZON_DAYS;
  const hours = Math.round(hoursFor() * 100) / 100;
  const slice = Math.round(implied * DROP_SHARE * (deposit / p.tvl_usd) * 100) / 100;
  const fees = Math.round(gasFor(p.chains) * 6 * 100) / 100;
  const tbill = Math.round(deposit * TBILL_RATE * (HORIZON_DAYS / 365) * 100) / 100;
  const net = Math.round((slice - fees - hours * HOUR_RATE_USD) * 100) / 100;
  const netPerHour = Math.round((hours > 0 ? net / hours : net) * 100) / 100;
  const verdict: FarmEconomics['verdict'] = net > tbill && netPerHour > 25 ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return { slice, fees, hours, deposit, tbill, net, netPerHour, verdict, holdDays };
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
export function farmSteps(p: SnapshotProtocol, econ: FarmEconomics): string[] {
  const chain = chainOf(p);
  const steps: FarmStep[] = [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, econ.deposit, chain),
      cost: `$${econ.deposit} of capital and about $${econ.fees.toFixed(2)} of gas across the plan`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action each week — a deposit, a borrow, a swap or a vote — so the wallet stays active.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${econ.holdDays} days so the activity lands in more than one snapshot.`,
      cost: `the $${econ.deposit} stays in the position`,
      time: `${econ.holdDays} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `At a $${econ.deposit} deposit (0.20% of TVL, capped at $50,000) and a 7% drop share over ${econ.holdDays} days, the expected slice is $${econ.slice.toFixed(2)}; net $${econ.net.toFixed(2)} after $${econ.fees.toFixed(2)} fees and ${econ.hours.toFixed(2)} hours at $${HOUR_RATE_USD}/h, against a $${econ.tbill.toFixed(2)} T-bill return — verdict: ${econ.verdict}. Write the wallet, the dates and every transaction in a farm log.`,
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

/** A deterministic seeded PRNG (mulberry32): the bootstrap must replay byte-identically. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The FNV-1a 32-bit hash of an ASCII string, as a hex string — the integrity checksum. */
export function fnv1a(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The checksum string over a board: one `slug:implied;` pair per row, in rank order. */
export function boardChecksum(board: { slug: string; implied_value_usd: number }[]): string {
  return fnv1a(board.map((r) => `${r.slug}:${r.implied_value_usd};`).join(''));
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
  // The category term is tested TWO ways — a shrunk median (stronger prior, 16) and a
  // ridge on category dummies (lam 4, min 8 comparables, the strongest walk-forward case
  // in the grid) — and neither is kept unless it helps twice.
  const base = { cat: false, catPrior: 16, ridge: null as { lam: number; minN: number } | null, mom: false, age: false, ctrl: false };
  const fitBase = (train: Comp[]) => fitValue(train, base);
  const looBase = looMiss(comps, fitBase);
  const wfBase = wfMiss(comps, cutoff, fitBase);
  const looFlat = flatMiss(comps, 'loo');
  const wfFlat = flatMiss(comps, 'wf', cutoff);
  const testValue = (opts: typeof base): { loo: number; wf: number } => ({
    loo: looMiss(comps, (train) => fitValue(train, opts)),
    wf: wfMiss(comps, cutoff, (train) => fitValue(train, opts)),
  });
  const catT = testValue({ ...base, cat: true });
  const ridgeT = testValue({ ...base, ridge: { lam: 4, minN: 8 } });
  const momT = testValue({ ...base, mom: true });
  const ageT = testValue({ ...base, age: true });
  const ctrlT = testValue({ ...base, ctrl: true });
  const keepCat = catT.loo < looBase && catT.wf < wfBase;
  const keepRidge = ridgeT.loo < looBase && ridgeT.wf < wfBase;
  const keepMom = momT.loo < looBase && momT.wf < wfBase;
  const keepAge = ageT.loo < looBase && ageT.wf < wfBase;
  const ctrlHelps = ctrlT.loo < looBase && ctrlT.wf < wfBase;
  // The two category methods are alternatives: the ridge wins if both help, else the median.
  const finalOpts = {
    cat: keepCat && !keepRidge,
    catPrior: 16,
    ridge: keepRidge ? { lam: 4, minN: 8 } : null,
    mom: keepMom,
    age: keepAge,
    ctrl: false,
  };
  const finalModel = fitValue(comps, finalOpts);
  const looFinal = looMiss(comps, (train) => fitValue(train, finalOpts));
  const wfFinal = wfMiss(comps, cutoff, (train) => fitValue(train, finalOpts));

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

  // Parent discount, from the snapshot's own kin pairs: token-having protocols sharing a
  // name stem. The parent is the largest-TVL member; each other member's multiple over the
  // parent's is one pair. This snapshot has exactly ONE such pair (yield), ratio 0.18 — a
  // single pair cannot pin a discount, so we apply half its log effect (sqrt), and the page
  // says so. It applies to off-list kin rows only: those are the rows DefiLlama records a
  // parent protocol for, and a parent that already has a token has already captured part
  // of the value. Sentora Curator has no token-having parent in this snapshot (no shared
  // stem, no parentProtocol field), so no discount applies to it — a known gap, stated.
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
  const kinPairs: { child: string; parent: string; ratio: number }[] = [];
  const byStem = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    if (cleanMcap(p) === null) continue;
    const stem = nameStem(p);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem)!.push(p);
  }
  for (const [, ps] of byStem) {
    if (ps.length < 2) continue;
    const parent = ps.reduce((a, b) => (a.tvl_usd >= b.tvl_usd ? a : b));
    const parentMult = cleanMcap(parent)! / parent.tvl_usd;
    for (const ch of ps) {
      if (ch.slug === parent.slug) continue;
      kinPairs.push({ child: ch.slug, parent: parent.slug, ratio: cleanMcap(ch)! / ch.tvl_usd / parentMult });
    }
  }
  const parentRatio = kinPairs.length > 0 ? median(kinPairs.map((k) => k.ratio)) : 1;
  const parentDiscount = Math.exp(0.5 * Math.log(parentRatio));

  // Token odds: logistic on the strict-rule peers (442), missing features imputed at the
  // peer medians. The odds are the peers' record, not a forecast. Each candidate term is
  // tested held-out, in order, on top of the terms kept before it: a term is kept only if
  // it lowers the Brier score in BOTH the leave-one-out and the walk-forward test.
  const peers = snapshot.protocols.filter(passesShape);
  const peerAges = peers.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((v): v is number => v !== null);
  const medianPeerAge = median(peerAges);
  const peerCutoff = (() => {
    const dates = peers.map((p) => p.listed_at ?? '9999').sort();
    return dates[Math.floor(dates.length / 2)]!;
  })();
  // One feature row per peer, in a fixed order: age, log TVL, relative momentum, kin,
  // log chain count, negative control.
  const peerRows = peers.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    return {
      x: [
        (age ?? medianPeerAge) / 365,
        Math.log(p.tvl_usd),
        (finite(p.change_7d, medianChange) - medianChange) / 100,
        kinOf(p) ? 1 : 0,
        Math.log(Math.max(1, p.chains.length)),
        ctrlOf.get(p.slug) ?? 0,
      ],
      y: hasToken(p) ? 1 : 0,
      slug: p.slug,
      listed: p.listed_at ?? '9999',
    };
  });
  const oddsTerms = [
    { name: 'Age (years listed)', idx: 0 },
    { name: 'Size (log TVL)', idx: 1 },
    { name: '7-day TVL growth (vs the week median)', idx: 2 },
    { name: 'Family / kin (a sibling token trades)', idx: 3 },
    { name: 'Chain count (log)', idx: 4 },
    { name: 'Negative control (next row’s 7d change)', idx: 5 },
  ];
  const looBrier = (idxs: number[]): number => {
    if (idxs.length === 0) {
      // Intercept-only: the base rate of the other 441 peers, predicted for the held-out one.
      const errs: number[] = [];
      for (let i = 0; i < peerRows.length; i++) {
        const rest = peerRows.filter((_, j) => j !== i);
        const rate = rest.reduce((a, r) => a + r.y, 0) / rest.length;
        errs.push((rate - peerRows[i]!.y) ** 2);
      }
      return errs.reduce((a, v) => a + v, 0) / errs.length;
    }
    const errs: number[] = [];
    for (let i = 0; i < peerRows.length; i++) {
      const train = peerRows.filter((_, j) => j !== i);
      const m = fitLogistic(train.map((r) => idxs.map((k) => r.x[k]!)), train.map((r) => r.y));
      errs.push((logisticPredict(m, idxs.map((k) => peerRows[i]!.x[k]!)) - peerRows[i]!.y) ** 2);
    }
    return errs.reduce((a, v) => a + v, 0) / errs.length;
  };
  const wfBrier = (idxs: number[]): number => {
    const train = peerRows.filter((r) => r.listed < peerCutoff);
    const test = peerRows.filter((r) => r.listed >= peerCutoff);
    if (idxs.length === 0) {
      const rate = train.reduce((a, r) => a + r.y, 0) / train.length;
      return brier(test.map(() => rate), test.map((r) => r.y));
    }
    const m = fitLogistic(train.map((r) => idxs.map((k) => r.x[k]!)), train.map((r) => r.y));
    return brier(test.map((r) => logisticPredict(m, idxs.map((k) => r.x[k]!))), test.map((r) => r.y));
  };
  const oddsEvidence: OddsEvidenceRow[] = [];
  let keptIdxs: number[] = [];
  let prevLoo = looBrier([]);
  let prevWf = wfBrier([]);
  for (const term of oddsTerms) {
    const trial = [...keptIdxs, term.idx];
    const loo = looBrier(trial);
    const wf = wfBrier(trial);
    const kept = loo < prevLoo && wf < prevWf;
    oddsEvidence.push({
      term: term.name,
      loo_brier: round4(loo),
      loo_base: round4(prevLoo),
      wf_brier: round4(wf),
      wf_base: round4(prevWf),
      kept,
      note: kept ? 'Kept: lowers the Brier score in both tests.' : 'Tested, not kept: does not lower the Brier score in both tests.',
    });
    if (kept) {
      keptIdxs = trial;
      prevLoo = loo;
      prevWf = wf;
    }
  }
  // The negative control must not help; if it did, the table says so plainly.
  const ctrlOddsRow = oddsEvidence[oddsEvidence.length - 1]!;
  if (ctrlOddsRow.kept) ctrlOddsRow.note = 'WARNING: the control helped — the odds tests are broken.';
  const kinFitted = keptIdxs.includes(3);
  const oddsModel = fitLogistic(peerRows.map((r) => keptIdxs.map((k) => r.x[k]!)), peerRows.map((r) => r.y));
  const oddsCoefByIdx = new Map<number, number>();
  keptIdxs.forEach((k, j) => oddsCoefByIdx.set(k, oddsModel.coef[j + 1]!));
  const probs = peerRows.map((r) => logisticPredict(oddsModel, keptIdxs.map((k) => r.x[k]!)));
  const labels = peerRows.map((r) => r.y);
  const baseRate = labels.reduce((a, v) => a + v, 0) / labels.length;
  const brierScore = brier(probs, labels);
  const brierBase = brier(labels.map(() => baseRate), labels);
  const foldOf = (slug: string): number => {
    let h = 0;
    for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 5;
  };
  let cvNum = 0;
  let cvDen = 0;
  for (let fold = 0; fold < 5; fold++) {
    const tr = peerRows.filter((r) => foldOf(r.slug) !== fold);
    const te = peerRows.filter((r) => foldOf(r.slug) === fold);
    if (te.length === 0) continue;
    const m = fitLogistic(tr.map((r) => keptIdxs.map((k) => r.x[k]!)), tr.map((r) => r.y));
    cvNum += brier(te.map((r) => logisticPredict(m, keptIdxs.map((k) => r.x[k]!))), te.map((r) => r.y)) * te.length;
    cvDen += te.length;
  }
  const brierCv = cvDen > 0 ? cvNum / cvDen : Number.NaN;

  // Bootstrap standard errors (200 refits, seeded so two runs are byte-identical): the
  // size slope and intercept, the ridge category effects' range, and the odds coefficients.
  const rng = mulberry32(20261122);
  const bootSlopes: number[] = [];
  const bootIntercepts: number[] = [];
  const bootCatEffects: number[] = [];
  const bootOddsCoefs: number[][] = [];
  for (let b = 0; b < 200; b++) {
    const resample: Comp[] = [];
    for (let i = 0; i < comps.length; i++) resample.push(comps[Math.floor(rng() * comps.length)]!);
    const m = fitValue(resample, finalOpts);
    bootSlopes.push(m.coef[1]!);
    bootIntercepts.push(m.coef[0]!);
    const rm = fitValue(resample, { ...base, ridge: { lam: 4, minN: 8 } });
    for (const v of rm.catFactors.values()) bootCatEffects.push(v);
    const peerSample: typeof peerRows = [];
    for (let i = 0; i < peerRows.length; i++) peerSample.push(peerRows[Math.floor(rng() * peerRows.length)]!);
    const om = fitLogistic(peerSample.map((r) => keptIdxs.map((k) => r.x[k]!)), peerSample.map((r) => r.y));
    bootOddsCoefs.push(om.coef);
  }
  const sd = (vs: number[]): number => {
    if (vs.length < 2) return 0;
    const m = vs.reduce((a, v) => a + v, 0) / vs.length;
    return Math.sqrt(vs.reduce((a, v) => a + (v - m) ** 2, 0) / (vs.length - 1));
  };
  const slopeSe = sd(bootSlopes);
  const interceptSe = sd(bootIntercepts);
  const catEffectMin = bootCatEffects.length > 0 ? Math.min(...bootCatEffects) : 1;
  const catEffectMax = bootCatEffects.length > 0 ? Math.max(...bootCatEffects) : 1;
  const oddsSeByIdx = new Map<number, number>();
  keptIdxs.forEach((k, j) => oddsSeByIdx.set(k, sd(bootOddsCoefs.map((c) => c[j + 1]!))));
  const oddsInterceptSe = sd(bootOddsCoefs.map((c) => c[0]!));

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
    const rawOdds = logisticPredict(oddsModel, keptIdxs.map((k) => {
      if (k === 0) return (age ?? medianPeerAge) / 365;
      if (k === 1) return Math.log(p.tvl_usd);
      if (k === 2) return feat.relMom;
      if (k === 3) return kinOf(p) ? 1 : 0;
      if (k === 4) return Math.log(Math.max(1, p.chains.length));
      return ctrlOf.get(p.slug) ?? 0;
    }));
    // Kin is a fitted odds term only if the evidence table kept it; otherwise the
    // documented ×0.5 heuristic applies instead — never both.
    const odds = kinFitted ? rawOdds : kinOf(p) ? rawOdds * KIN_DISCOUNT : rawOdds;
    const sizeCurve = Math.exp(logPred - (finalModel.catOn ? Math.log(finalModel.catFactors.get(p.category ?? '(none)') ?? 1) : 0));
    const catFactor = finalModel.catOn ? finalModel.catFactors.get(p.category ?? '(none)') ?? 1 : 1;
    const isOffListKin = tier === 'Off-list' && kinOf(p);
    const pd = isOffListKin ? parentDiscount : 1;
    const implied = Math.max(1, Math.round(Math.exp(logPred) * odds * pd));
    const econ = farmEconomics(p, implied);
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
        deposit_usd: econ.deposit,
        tbill_usd: econ.tbill,
        parent_discount: round4(pd),
        age_days: age,
      },
      farm_steps: farmSteps(p, econ),
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
      term: 'Category factor (shrunk median mcap/TVL, prior 16)',
      loo_miss: round4(catT.loo),
      loo_base: round4(looBase),
      wf_miss: round4(catT.wf),
      wf_base: round4(wfBase),
      kept: keepCat,
      note: keepCat ? 'Kept: lowers the miss in both tests.' : 'Dropped: does not lower the miss in both tests.',
    },
    {
      term: 'Category effect (ridge on category dummies, λ=4, min 8)',
      loo_miss: round4(ridgeT.loo),
      loo_base: round4(looBase),
      wf_miss: round4(ridgeT.wf),
      wf_base: round4(wfBase),
      kept: keepRidge,
      note: keepRidge
        ? 'Kept: lowers the miss in both tests.'
        : 'Dropped: the best walk-forward case still wrecks leave-one-out — the category signal is not in this snapshot.',
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

  const totalImplied = board.reduce((a, r) => a + r.implied_value_usd, 0);
  const integrity: Integrity = {
    checksum: boardChecksum(board),
    rows: board.length,
    watchlist_covered: board.filter((r) => r.tier === 'Watchlist').length,
    watchlist_size: snapshot.watchlist.length,
    ledger_total: ledger.total,
    total_implied_usd: totalImplied,
  };

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
      slope_se: round4(slopeSe),
      intercept_se: round4(interceptSe),
      category_effect_min: round4(catEffectMin),
      category_effect_max: round4(catEffectMax),
    },
    odds: {
      peers: peers.length,
      peers_with_token: peers.filter(hasToken).length,
      brier: round4(brierScore),
      brier_base: round4(brierBase),
      brier_cv: round4(brierCv),
      coefficients: {
        age_years: round4(oddsCoefByIdx.get(0) ?? 0),
        log_tvl: round4(oddsCoefByIdx.get(1) ?? 0),
        rel_momentum: round4(oddsCoefByIdx.get(2) ?? 0),
        kin: round4(oddsCoefByIdx.get(3) ?? 0),
        intercept: round4(oddsModel.coef[0]!),
      },
      coefficients_se: {
        age_years: round4(oddsSeByIdx.get(0) ?? 0),
        log_tvl: round4(oddsSeByIdx.get(1) ?? 0),
        rel_momentum: round4(oddsSeByIdx.get(2) ?? 0),
        kin: round4(oddsSeByIdx.get(3) ?? 0),
        intercept: round4(oddsInterceptSe),
      },
      kin_discount: KIN_DISCOUNT,
      kin_fitted: kinFitted,
    },
    evidence,
    odds_evidence: oddsEvidence,
    ledger,
    integrity,
    kpi: {
      total_implied_usd: totalImplied,
      farm_count: board.filter((r) => r.model.verdict === 'FARM').length,
      marginal_count: board.filter((r) => r.model.verdict === 'MARGINAL').length,
      skip_count: board.filter((r) => r.model.verdict === 'SKIP').length,
      median_implied_usd: median(implieds),
    },
    fee_table: FEE_TABLE,
    deposit_rate: DEPOSIT_RATE,
    deposit_cap_usd: DEPOSIT_CAP_USD,
    drop_share: DROP_SHARE,
    horizon_days: HORIZON_DAYS,
    tbill_rate: TBILL_RATE,
    hour_rate_usd: HOUR_RATE_USD,
    parent_discount: round4(parentDiscount),
    parent_pairs: kinPairs.length,
    parent_ratio: round4(parentRatio),
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
      deposit_usd: r.model.deposit_usd,
      tbill_usd: r.model.tbill_usd,
      parent_discount: r.model.parent_discount,
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
