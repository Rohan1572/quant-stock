/**
 * Position-aware action guidance.
 *
 * The quant score is objective (stock fundamentals). This layer translates it
 * through the lens of *your* cost basis so the generic "Hold" label becomes
 * a concrete, contextual instruction.
 */

export type PositionAction =
  | "strong_buy_more"
  | "buy_more"
  | "average_down"
  | "hold_accumulate"
  | "hold"
  | "hold_cautious"
  | "take_partial_profits"
  | "trim"
  | "reduce"
  | "sell"
  | "sell_into_strength";

export interface PositionAdvice {
  action: PositionAction;
  label: string;
  rationale: string;
  sentiment: "buy" | "hold" | "sell";
}

/**
 * Profit band derived from the unrealised P&L percentage.
 *
 * The original branches did not share one banding scheme: the strong and
 * moderate rows keyed on pnlPct >= 5, while the weak and poor rows keyed on
 * pnlPct > 0, so a gain of 0.1% is "flat" to the former and "up" to the
 * latter. `minGain` below carries that per-row difference so the table
 * reproduces the original answers exactly.
 */
type ProfitBand = "bigUp" | "smallUp" | "flat" | "smallDown" | "bigDown";

function profitBand(pnlPct: number, minGain: number): ProfitBand {
  if (pnlPct >= 20) return "bigUp";
  if (pnlPct >= minGain) return "smallUp";
  if (pnlPct < -15) return "bigDown";
  if (pnlPct < 0) return "smallDown";
  return "flat";
}

/** Fundamental band derived from the 0-100 quant score. */
type ScoreBand = "strong" | "moderate" | "weak" | "poor";

function scoreBand(score: number): ScoreBand {
  if (score >= 65) return "strong";
  if (score >= 45) return "moderate";
  if (score >= 30) return "weak";
  return "poor";
}

function advice(
  action: PositionAction,
  label: string,
  sentiment: PositionAdvice["sentiment"],
  rationale: string,
): PositionAdvice {
  return { action, label, rationale, sentiment };
}

/**
 * One entry per score band. `minGain` is the P&L that counts as `smallUp` for
 * that band (5 for strong/moderate, any positive gain for weak/poor), and
 * `flat` is the fallback when no band matches. An entry may be a function so
 * rationales that quote the P&L are built per call rather than at module load.
 */
type AdviceRow = {
  minGain: number;
  rows: Record<
    ProfitBand,
    PositionAdvice | ((pnlPct: number) => PositionAdvice)
  >;
};

const exitWhileInProfit = advice(
  "sell",
  "Sell",
  "sell",
  `The quant model sees poor fundamentals. You're in the black — take the profit and exit.`,
);

const exitAtALoss = advice(
  "sell",
  "Exit Position",
  "sell",
  `Poor fundamentals and you're in the red. Further holding increases risk without a clear recovery catalyst.`,
);

const STRONG: AdviceRow = {
  minGain: 5,
  rows: {
    bigUp: advice(
      "hold_accumulate",
      "Hold & Accumulate",
      "buy",
      `Fundamentals are strong and you're sitting on a solid gain. No reason to exit — consider adding on dips.`,
    ),
    smallUp: advice(
      "buy_more",
      "Add to Position",
      "buy",
      `The quant model rates this highly. Your modest gain leaves room to build a larger position.`,
    ),
    flat: advice(
      "buy_more",
      "Add to Position",
      "buy",
      `Strong quant score and near break-even — this is a good spot to increase exposure.`,
    ),
    smallDown: advice(
      "average_down",
      "Average Down",
      "buy",
      `Fundamentals support the thesis. The dip is an opportunity to lower your average cost.`,
    ),
    bigDown: advice(
      "strong_buy_more",
      "Strong Average Down",
      "buy",
      `You're down significantly, but the quant model still rates fundamentals highly. If your conviction holds, this is a meaningful entry point.`,
    ),
  },
};

const MODERATE: AdviceRow = {
  minGain: 5,
  rows: {
    bigUp: (pnlPct: number) =>
      advice(
        "take_partial_profits",
        "Take Partial Profits",
        "sell",
        `You're up ${pnlPct.toFixed(1)}% but the quant model doesn't see strong further upside from here. Locking in some gains is sensible.`,
      ),
    smallUp: advice(
      "hold",
      "Hold",
      "hold",
      `Mixed signals — the stock is fairly valued and you're modestly ahead. Sit tight and reassess if conditions change.`,
    ),
    flat: advice(
      "hold",
      "Hold",
      "hold",
      `Neutral quant score and near break-even. No strong signal to add or exit right now.`,
    ),
    smallDown: (pnlPct: number) =>
      advice(
        "hold_cautious",
        "Hold — Don't Panic",
        "hold",
        `Down ${Math.abs(pnlPct).toFixed(1)}%, but fundamentals are neutral. Selling here locks in a loss with no strong reason to exit.`,
      ),
    bigDown: (pnlPct: number) =>
      advice(
        "hold_cautious",
        "Hold or Cut Losses",
        "hold",
        `You're down ${Math.abs(pnlPct).toFixed(1)}% and fundamentals are mixed. Only hold if your original thesis is still intact; otherwise cut losses.`,
      ),
  },
};

const trimOnStrength = advice(
  "trim",
  "Trim on Strength",
  "sell",
  `Weak fundamentals and you're in profit. Use the strength to reduce your exposure.`,
);

const WEAK: AdviceRow = {
  minGain: Number.MIN_VALUE,
  rows: {
    bigUp: trimOnStrength,
    smallUp: trimOnStrength,
    flat: advice(
      "reduce",
      "Consider Reducing",
      "sell",
      `Quant model flags weak fundamentals. This is not a position to add to — consider reducing.`,
    ),
    smallDown: advice(
      "reduce",
      "Consider Reducing",
      "sell",
      `Fundamentals are deteriorating and you're slightly in the red. Trimming here limits further downside.`,
    ),
    bigDown: (pnlPct: number) =>
      advice(
        "reduce",
        "Reduce or Exit",
        "sell",
        `Down ${Math.abs(pnlPct).toFixed(1)}% on a stock with weak fundamentals. Consider cutting the position to redeploy capital.`,
      ),
  },
};

const POOR: AdviceRow = {
  minGain: Number.MIN_VALUE,
  rows: {
    bigUp: advice(
      "sell_into_strength",
      "Sell Into Strength",
      "sell",
      `Fundamentals are poor but you have gains to protect. Exit while price is in your favour.`,
    ),
    smallUp: exitWhileInProfit,
    flat: exitAtALoss,
    smallDown: exitAtALoss,
    bigDown: exitAtALoss,
  },
};

const TABLE: Record<ScoreBand, AdviceRow> = {
  strong: STRONG,
  moderate: MODERATE,
  weak: WEAK,
  poor: POOR,
};

/**
 * @param score       0–100 quant score
 * @param pnlPct      unrealised P&L % ((currentPrice - avgCost) / avgCost * 100)
 */
export function getPositionAdvice(
  score: number,
  pnlPct: number,
): PositionAdvice {
  const band = TABLE[scoreBand(score)];
  const entry = band.rows[profitBand(pnlPct, band.minGain)];
  return typeof entry === "function" ? entry(pnlPct) : entry;
}
