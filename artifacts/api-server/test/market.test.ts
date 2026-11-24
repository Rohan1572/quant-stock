import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { marketFromValue } from "../src/lib/quant/market";
import {
  getMarketWatchlistEntry,
  getWatchlist,
} from "../src/lib/quant/watchlists";

describe("market configuration", () => {
  it("defaults missing market context to India and rejects unknown values", () => {
    assert.equal(marketFromValue(undefined), "india");
    assert.equal(marketFromValue("us"), "us");
    assert.equal(marketFromValue("uk"), null);
  });

  it("keeps the India and US ranking universes separate", () => {
    const indiaWatchlist = getWatchlist("india");
    const usWatchlist = getWatchlist("us");

    assert.equal(indiaWatchlist.length, 100);
    assert.equal(usWatchlist.length, 25);
    assert.equal(getMarketWatchlistEntry("us", "AAPL")?.companyName, "Apple");
    assert.equal(getMarketWatchlistEntry("india", "AAPL"), undefined);
  });
});
