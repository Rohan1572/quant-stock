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
 * @param score       0–100 quant score
 * @param pnlPct      unrealised P&L % ((currentPrice - avgCost) / avgCost * 100)
 */
export function getPositionAdvice(score: number, pnlPct: number): PositionAdvice {
  const up = pnlPct > 0;
  const bigUp = pnlPct >= 20;
  const smallUp = pnlPct >= 5 && pnlPct < 20;
  const smallDown = pnlPct < 0 && pnlPct >= -15;
  const bigDown = pnlPct < -15;

  // Strong fundamentals (score ≥ 65)
  if (score >= 65) {
    if (bigUp)
      return {
        action: "hold_accumulate",
        label: "Hold & Accumulate",
        rationale: `Fundamentals are strong and you're sitting on a solid gain. No reason to exit — consider adding on dips.`,
        sentiment: "buy",
      };
    if (smallUp)
      return {
        action: "buy_more",
        label: "Add to Position",
        rationale: `The quant model rates this highly. Your modest gain leaves room to build a larger position.`,
        sentiment: "buy",
      };
    if (smallDown)
      return {
        action: "average_down",
        label: "Average Down",
        rationale: `Fundamentals support the thesis. The dip is an opportunity to lower your average cost.`,
        sentiment: "buy",
      };
    if (bigDown)
      return {
        action: "strong_buy_more",
        label: "Strong Average Down",
        rationale: `You're down significantly, but the quant model still rates fundamentals highly. If your conviction holds, this is a meaningful entry point.`,
        sentiment: "buy",
      };
    // flat
    return {
      action: "buy_more",
      label: "Add to Position",
      rationale: `Strong quant score and near break-even — this is a good spot to increase exposure.`,
      sentiment: "buy",
    };
  }

  // Moderate fundamentals (score 45–64)
  if (score >= 45) {
    if (bigUp)
      return {
        action: "take_partial_profits",
        label: "Take Partial Profits",
        rationale: `You're up ${pnlPct.toFixed(1)}% but the quant model doesn't see strong further upside from here. Locking in some gains is sensible.`,
        sentiment: "sell",
      };
    if (smallUp)
      return {
        action: "hold",
        label: "Hold",
        rationale: `Mixed signals — the stock is fairly valued and you're modestly ahead. Sit tight and reassess if conditions change.`,
        sentiment: "hold",
      };
    if (smallDown)
      return {
        action: "hold_cautious",
        label: "Hold — Don't Panic",
        rationale: `Down ${Math.abs(pnlPct).toFixed(1)}%, but fundamentals are neutral. Selling here locks in a loss with no strong reason to exit.`,
        sentiment: "hold",
      };
    if (bigDown)
      return {
        action: "hold_cautious",
        label: "Hold or Cut Losses",
        rationale: `You're down ${Math.abs(pnlPct).toFixed(1)}% and fundamentals are mixed. Only hold if your original thesis is still intact; otherwise cut losses.`,
        sentiment: "hold",
      };
    return {
      action: "hold",
      label: "Hold",
      rationale: `Neutral quant score and near break-even. No strong signal to add or exit right now.`,
      sentiment: "hold",
    };
  }

  // Weak fundamentals (score 30–44)
  if (score >= 30) {
    if (up)
      return {
        action: "trim",
        label: "Trim on Strength",
        rationale: `Weak fundamentals and you're in profit. Use the strength to reduce your exposure.`,
        sentiment: "sell",
      };
    if (smallDown)
      return {
        action: "reduce",
        label: "Consider Reducing",
        rationale: `Fundamentals are deteriorating and you're slightly in the red. Trimming here limits further downside.`,
        sentiment: "sell",
      };
    if (bigDown)
      return {
        action: "reduce",
        label: "Reduce or Exit",
        rationale: `Down ${Math.abs(pnlPct).toFixed(1)}% on a stock with weak fundamentals. Consider cutting the position to redeploy capital.`,
        sentiment: "sell",
      };
    return {
      action: "reduce",
      label: "Consider Reducing",
      rationale: `Quant model flags weak fundamentals. This is not a position to add to — consider reducing.`,
      sentiment: "sell",
    };
  }

  // Poor fundamentals (score < 30)
  if (bigUp)
    return {
      action: "sell_into_strength",
      label: "Sell Into Strength",
      rationale: `Fundamentals are poor but you have gains to protect. Exit while price is in your favour.`,
      sentiment: "sell",
    };
  if (up)
    return {
      action: "sell",
      label: "Sell",
      rationale: `The quant model sees poor fundamentals. You're in the black — take the profit and exit.`,
      sentiment: "sell",
    };
  return {
    action: "sell",
    label: "Exit Position",
    rationale: `Poor fundamentals and you're in the red. Further holding increases risk without a clear recovery catalyst.`,
    sentiment: "sell",
  };
}
