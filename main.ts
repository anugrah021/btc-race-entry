// Mean-reversion dip bot: buy dips below the 240-bar EMA, sell on recovery
// above it, hard stop below entry. Long only, one position.
import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BUY_DIP = 0.007;
const SELL_UP = 0.005;
const STOP = 0.01;
const MAX_SLIPPAGE_BPS = 500;

const closes: bigint[] = [];
let ema240: number | null = null;
let entryClose: number | null = null;

function ema(prev: number | null, price: number, n: number): number {
  const k = 2 / (n + 1);
  return prev === null ? price : price * k + prev * (1 - k);
}

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const c = Number(close);
    closes.push(close);
    ema240 = ema(ema240, c, 240);
    if (closes.length < 241) return [];
    const holding = state.positions.has(SYMBOL);
    if (holding) {
      const sellAll = (): OrderInput[] => {
        entryClose = null;
        return [{ side: 'sell', symbol: SYMBOL, qty: state.positions.get(SYMBOL)!.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      };
      if (c > ema240! * (1 + SELL_UP)) return sellAll();
      if (entryClose !== null && c < entryClose * (1 - STOP)) return sellAll();
      return [];
    }
    if (c < ema240! * (1 - BUY_DIP)) {
      entryClose = c;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
