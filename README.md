[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ryukein19/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ryukein19/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — the pre-token protocol board

A token launch radar: it reads a sealed snapshot of every protocol DefiLlama
tracks (758 protocols, as of 2026-11-14), works out which ones still record no
token and are not a wrapped or staked product of one that trades, ranks them by
an implied value fitted on the snapshot's own traded-token comparables, and
gives each one a costed farm plan.

## The model (fitted at runtime, never hardcoded)

- **Size curve** — a log-log regression of market cap on TVL over the 128
  protocols in the snapshot that record a token with a usable market cap:
  `log(mcap) = a + b·log(TVL)`. Refit on every run from the sealed snapshot.
- **Category factor** — per-category median mcap/TVL among the comparables,
  shrunk toward 1 by sample size. Dexs pay ~8× Liquid Staking per TVL dollar.
- **Token odds** — a logistic fit on the peers that record a token or do not,
  from no-token age, log TVL, relative 7-day momentum and a kin flag. The odds
  are the peers' record, not a forecast: the page never says a token will
  launch, or when.
- **Implied value** = size curve × category factor × token odds.
- **Evidence** — every term is kept only if it lowers the held-out miss in
  BOTH tests (leave-one-out over the comparables, and walk-forward: fit on
  tokens listed before a cutoff, test on the newer ones), with a negative
  control term that must not help. The page prints the table.
- **Farm economics** — airdrop slice = implied × drop share × (ticket / TVL);
  net = slice − fees − time at $25/h. FARM if net > $25 and net/hour > $25,
  MARGINAL if net > 0, else SKIP. Thresholds are stated on the page.

## The board

198 rows: the 40-protocol watchlist (the floor), 138 early rows below the
$50M floor that pass the strict rule, and 20 off-list finds above the floor
that the watchlist rule left out (Sentora Curator $2.76B, Polymarket
International $320M, …). The ledger accounts for all 758 protocols:
198 ranked + 128 token-trades + 288 token-on-record-no-cap + 144 set aside.

A protocol "records no token" when DefiLlama records neither a CoinGecko id
nor a symbol for it. That is the record, not proof it has none.

## Run it

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22, standard library only. Writes `board.json`, `data.js`,
`dashboard/`, `screenshots/` and `dossier.json` to the output directory.
Run it twice: the output is byte-identical.

## Layout

- `main.ts` — entrypoint: reads the snapshot, builds the board, writes output.
- `lib/model.ts` — the fitted model, the ledger, the farm economics.
- `dashboard/` — the static page (`index.html`, `app.css`, `app.js`).
- `screenshots/` — three renders of the dashboard (board, detail, filtered).
- `vendor/makefun-board.ts` — the make.fun dossier library, as shipped.
