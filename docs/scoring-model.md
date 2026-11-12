# Scoring model

Six categories — valuation, financial health, profitability, growth, risk,
momentum — blended by the weights in `scoring_configs`. Each metric is scored as
a z-score against its sector benchmark's **dispersion** (how far apart sector
peers actually are), then saturated through `tanh` so the result stays in 0–100
without pinning to the ends.

The point of working in dispersion rather than raw units is that "20 points of
ROE above the median" means very different things in a tightly-clustered sector
and a widely-spread one.

## Invariants

These are easy to break by refactoring, and each one has already caused a wrong
answer. `npm test` guards all of them.

**1. Non-meaningful metrics must stay excluded all the way to aggregation.**
`MetricDetail.score` has to be a number because the API schema requires it, so
absent or meaningless metrics hold a neutral `50` for display. That `50` must
never reach the aggregate — `toWeighted()` converts it to `INVALID_SCORE` (NaN)
at the boundary, and `weightedMean`, `coverage` and `scoreBand` all skip
non-finite entries. Feeding the `50` in is what previously made missing data read
as a mediocre score rather than an unknown one.

**2. A negative or non-finite multiple is invalid, not good or bad.** A P/E of
-50 once clamped to a perfect 100, scoring a loss-maker above the whole sector.

**3. Never pass a benchmark of 0 to the ratio transform.** It returns invalid.
The moving-average metrics previously did exactly this and the old transform
short-circuited it to a flat `50`, so a price 40% above and 40% below the
average scored identically. They now use a benchmark _ratio_ of `1.0`.

**4. The coverage shrink is deliberate.** Renormalising over available metrics
alone rewards a company for missing data: a loss-maker left with only P/B and
EV/EBITDA reads as a stellar 94 valuation purely because P/E and PEG were
dropped. `coverageShrink()` pulls it back toward neutral.

**5. Confidence is gated by coverage.** The reference-data components
(benchmarks, price history) are multiplied by how much model they are judging.
Without the gate, a stock with none of its financial data still scored ~52%
confidence purely for having a clean price series.

**6. The score range is indicative, not a statistical confidence interval.**
Its width is a heuristic propagation of metric noise, missing coverage, and a
model-error floor. It has not been calibrated to achieve any probability
coverage in historical data.

**7. Metric weight balance is not metric independence.** The legacy
`metricDiversity` confidence field measures how evenly available weights are
distributed; it does not estimate correlation. Obvious duplicated exposures
are reduced with lower weights, but empirical correlation adjustment requires
point-in-time peer and return data.

## Category-specific notes

- Debt/equity contributes to risk only, and negative values are excluded because
  they can indicate negative book equity rather than low leverage.
- Financial health uses FCF conversion (`FCF / positive net income`) and FCF
  yield, not a company-specific net-margin hurdle.
- In Financial Services, EV/EBITDA, operating-company liquidity/FCF measures,
  and debt/equity are excluded. Sector-specific capital and asset-quality data
  are not currently available, so coverage is intentionally lower.
- Obvious duplicate signals have lower relative weights. Those weights remain
  heuristic until evaluated on point-in-time data.

## Caveats in the data feed

**Yahoo betas are unreliable for Indian NSE names.** Measured live:

| Ticker   | Reported beta |
| -------- | ------------- |
| INFY     | 0.108         |
| RELIANCE | 0.152         |
| TCS      | 0.166         |
| HDFCBANK | 0.404         |

These observations motivate a **Blume adjustment**, `β = ⅓·raw + ⅔·1.0`.
Betas outside `(0, 3)` are excluded from risk scoring and fall back to `1.0`
for the illustrative DCF.

**The DCF is an illustrative equity-cash-flow proxy, not a bank-grade
valuation.** Yahoo free cash flow (operating cash flow less capex) is treated
as an equity cash-flow proxy, discounted at cost of equity, without adding cash
or subtracting debt a second time. Revenue growth is only a proxy for FCF
growth; rates are approximate fixed assumptions. Financial statements and FCF
growth history are needed to improve it.

**Sector benchmarks are indicative, not live peer medians.** They are a static
table, so `benchmarkQuality` deliberately scores below 1.0 and live sector
percentile ranking remains future work. For Financial Services, EV/EBITDA,
standard liquidity ratios, FCF measures, and debt/equity are excluded where
they are not comparable, and the FCF-based DCF estimate is omitted. The model
does not yet have bank-specific capital or asset-quality measures.

**Price history uses adjusted close when Yahoo supplies it.** If the upstream
feed omits adjusted close, the series falls back to raw close and may still
contain corporate-action discontinuities.

**Ratings are screening buckets, not trade recommendations.** They are not
calibrated to expected returns, a holding period, transaction costs, or a
portfolio mandate.

**`core.autocrlf` and Prettier.** See `.prettierrc.json`; the default `lf`
setting fights the Windows checkout and fails `format:check` on every clone.

## Validating changes

The test suite runs on fixtures with plausible values, which is exactly how the
beta problem above survived it. Check data assumptions against the live feed:

```powershell
npm run dev:api
curl http://localhost:5000/api/stocks/RELIANCE.NS/score/details
```
