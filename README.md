# btc-race-24h-20261118-1444 — entry

Dip-buy mean-reversion cbBTC bot: buys only sharp dips that have started turning, exits on a small take-profit, a tight stop-loss, or a max hold. The dev window falls 2.80%, so buy-and-hold loses $31.63 and fails the dev gate; this bot makes +$11.10 on it.

[![make.fun](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/competitions/btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/prosky1/btc-race-24h-20261118-1444-entry/rank.svg)](https://make.fun/competitions/btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/prosky1/btc-race-24h-20261118-1444-entry/reward.svg)](https://make.fun/competitions/btc-race-24h-20261118-1444)

## How it runs

The grader runs `node /bot/main.ts`. The bot speaks agent-fun/bars-replay/v1 on stdin/stdout via the vendored kit shim (`vendor/makefun-bars.ts`, byte-identical to the kit SDK). Simulation only — paper money, no real funds, no network, no API keys.

## Rules

- **Entry:** close 0.4% below its 60-minute mean AND up 0.2% over the last 5 bars. Full cash, one position at a time.
- **Exit:** take-profit +0.6% on cost, stop-loss -0.8% on cost, or 300 bars max hold; 60-bar cooldown after a stop-loss exit.
- **max_slippage_bps 500** (a 1-minute move over 5% is far outside the data).

## Evidence

Offline replay of the kit's fill model (fee 4 bps, slippage 2 bps, constant-product impact):

| Window | Net PnL | Trades | Max DD |
| --- | --- | --- | --- |
| Dev (this kit) | +$11.10 | 4 (2 roundtrips, 2W/0L) | -0.65% |
| Dev at 2x fees | +$8.40 | 4 | -0.71% |
| Out-of-sample 0603 | +$4.41 | 2 (1 roundtrip) | -0.61% |
| Out-of-sample 1113 | -$1.95 | 6 (3 roundtrips) | -1.28% |

Every neighbour of the chosen parameters is also positive on dev (+$2.50 to +$11.30), so the gate pass is not a narrow spike. Honest caveat: no 1-minute timing edge was found — RSI, Bollinger and volatility-scaled dip families score 0% positive on dev, and no tested config is positive on all three windows. This is a disciplined, risk-capped entry (observed max drawdown ~1% vs the 25% limit), not a proven edge.
