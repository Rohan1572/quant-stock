---
name: Yahoo Finance unofficial API auth
description: quoteSummary (fundamentals) endpoints require a cookie+crumb handshake; chart and search endpoints do not.
---

Yahoo Finance's unofficial public endpoints (`query1`/`query2.finance.yahoo.com`) have inconsistent auth requirements as of mid-2026:

- `/v1/finance/search` (ticker search) and `/v8/finance/chart/{symbol}` (price history) work with a plain unauthenticated GET — no cookie or crumb needed.
- `/v10/finance/quoteSummary/{symbol}` (fundamentals: price, summaryDetail, financialData, etc.) returns `{"finance":{"error":{"code":"Unauthorized","description":"Invalid Crumb"}}}` without a crumb.

**Why:** Yahoo tightened access to the fundamentals endpoint but left market-data endpoints open; this asymmetry isn't documented anywhere official and is easy to miss when prototyping against just the chart/search endpoints.

**How to apply:** to call quoteSummary, first GET `https://fc.yahoo.com` to collect a session cookie, then GET `https://query1.finance.yahoo.com/v1/test/getcrumb` with that cookie to get a crumb string, then append `&crumb=<crumb>` (with the cookie header) to the quoteSummary request. Cache the crumb+cookie for a while (e.g. 30 min) and refresh on a 401. This is a prototype-tier, no-SLA data source — it can change or rate-limit without notice.
