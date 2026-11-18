// btc-race-24h-20261118-1444 — dip-buy mean-reversion cbBTC bot.
//
// The dev window falls 2.80% (open $65,083 -> close $63,261), so buy-and-hold
// loses $31.63 and fails the dev gate. This bot instead buys only sharp dips
// that have started turning, and exits on a small take-profit, a tight
// stop-loss, or a max hold.
//
// Rules (all integer math on closes; no clock, no randomness, no network):
//   Entry: close 0.4% below its 60-minute mean AND up 0.2% over the last
//   5 bars. Full cash, one position at a time.
//   Exit: take-profit +0.6% on cost, stop-loss -0.8% on cost, or 300 bars
//   max hold; 60-bar cooldown after a stop-loss exit.
//
// Evidence (offline replay of the kit's fill model — fee 4 bps, slippage
// 2 bps, constant-product impact; see btc-race-research/r4_*.py):
//   Dev window:  net PnL +$11.10, 4 trades (2 roundtrips, 2W/0L), max DD -0.65%
//   2x-fee stress (dev): +$8.40 — the margin is not fee-fragile.
//   Out-of-sample 24h windows (prior kits): +$4.41 (0603), -$1.95 (1113).
//   Dev plateau: every neighbour of the chosen parameters is also positive
//   on dev (+$2.50 to +$11.30), so the gate pass is not a narrow spike.
//   Honest caveat: no 1-minute timing edge was found anywhere — RSI,
//   Bollinger and volatility-scaled dip families score 0% positive on dev,
//   and no tested config is positive on all three windows. This bot is a
//   disciplined, risk-capped entry (observed max DD ~1% vs the 25% limit),
//   not a proven edge. Simulation only: paper money, no real funds.
//
// Deliberate differences from the house baselines (RULES.txt: an entry whose
// action log matches an earlier entry's takes no prize): the entry/exit rules
// above, and max_slippage_bps 500 instead of the baseline's 10000 (a 1-minute
// move over 5% is far outside the data; the largest observed is 0.64%).

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const SMA_N = 60; // bars in the mean
const DEEP_BPS = 40; // entry: 0.4% below the mean
const JUMP_BPS = 20; // entry: 0.2% up over the last 5 bars
const TP_BPS = 60; // exit: +0.6% take-profit on cost
const SL_BPS = 80; // exit: -0.8% stop-loss on cost
const MAX_HOLD = 300; // bars
const COOLDOWN = 60; // bars after a stop-loss exit
const MAX_SLIPPAGE_BPS = 500;
const BPS = 10000n; // basis-point scale: 10000 bps = 100%
const TURN_LOOKBACK = 5; // bars back for the turn check

const closes: bigint[] = [];
let entryBar = -1;
let coolUntil = -1;

function sma(): bigint | null {
  if (closes.length < SMA_N) return null;
  let sum = 0n;
  for (const c of closes.slice(-SMA_N)) sum += c;
  return sum / BigInt(SMA_N);
}

await runBars({
  onBatch(state) {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    if (state.warmingUp) return [];

    const pos = state.positions.get(SYMBOL);
    const qty = pos?.qty ?? 0n;

    if (qty > 0n) {
      const cost = pos?.cost ?? 0n;
      const val = state.value(SYMBOL, qty);
      const sell = { side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
      // Take-profit.
      if (val * BPS >= cost * (BPS + BigInt(TP_BPS))) return [sell];
      // Stop-loss (+ cooldown).
      if (val * BPS <= cost * (BPS - BigInt(SL_BPS))) {
        coolUntil = state.seq + COOLDOWN;
        return [sell];
      }
      // Max hold.
      if (entryBar >= 0 && state.seq - entryBar >= MAX_HOLD) return [sell];
      return [];
    }

    // Flat: entry needs 61 closes (seq >= 60), past any cooldown.
    if (closes.length < SMA_N + 1) return [];
    if (state.seq < coolUntil) return [];
    const mean = sma();
    if (mean === null) return [];
    const fiveBack = closes[closes.length - (TURN_LOOKBACK + 1)] as bigint;
    const dipped = close * BPS < mean * (BPS - BigInt(DEEP_BPS));
    const turning = close * BPS > fiveBack * (BPS + BigInt(JUMP_BPS));
    if (!dipped || !turning) return [];
    entryBar = state.seq;
    const notional = state.cash;
    const floor = BigInt(state.hello.fees.min_notional_quote_units);
    if (notional < floor) return [];
    return [
      { side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS },
    ];
  },
});
