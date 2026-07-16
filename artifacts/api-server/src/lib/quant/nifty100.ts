/**
 * Curated watchlist of NSE-listed large/mid-cap stocks (Nifty 100 universe).
 * Used as the input set for the rankings engine.
 * companyName and sector are static approximations for display — the live
 * profile endpoint is authoritative when viewing individual stock pages.
 */

export interface WatchlistEntry {
  ticker: string;
  companyName: string;
  sector: string;
}

export const WATCHLIST: WatchlistEntry[] = [
  // Financial Services
  { ticker: "HDFCBANK.NS", companyName: "HDFC Bank", sector: "Financial Services" },
  { ticker: "ICICIBANK.NS", companyName: "ICICI Bank", sector: "Financial Services" },
  { ticker: "KOTAKBANK.NS", companyName: "Kotak Mahindra Bank", sector: "Financial Services" },
  { ticker: "SBIN.NS", companyName: "State Bank of India", sector: "Financial Services" },
  { ticker: "AXISBANK.NS", companyName: "Axis Bank", sector: "Financial Services" },
  { ticker: "BAJFINANCE.NS", companyName: "Bajaj Finance", sector: "Financial Services" },
  { ticker: "BAJAJFINSV.NS", companyName: "Bajaj Finserv", sector: "Financial Services" },
  { ticker: "HDFCLIFE.NS", companyName: "HDFC Life Insurance", sector: "Financial Services" },
  { ticker: "SBILIFE.NS", companyName: "SBI Life Insurance", sector: "Financial Services" },
  { ticker: "ICICIGI.NS", companyName: "ICICI Lombard General Insurance", sector: "Financial Services" },
  { ticker: "INDUSINDBK.NS", companyName: "IndusInd Bank", sector: "Financial Services" },
  { ticker: "CHOLAFIN.NS", companyName: "Cholamandalam Investment", sector: "Financial Services" },
  { ticker: "MUTHOOTFIN.NS", companyName: "Muthoot Finance", sector: "Financial Services" },
  // Technology
  { ticker: "TCS.NS", companyName: "Tata Consultancy Services", sector: "Technology" },
  { ticker: "INFY.NS", companyName: "Infosys", sector: "Technology" },
  { ticker: "HCLTECH.NS", companyName: "HCL Technologies", sector: "Technology" },
  { ticker: "WIPRO.NS", companyName: "Wipro", sector: "Technology" },
  { ticker: "TECHM.NS", companyName: "Tech Mahindra", sector: "Technology" },
  { ticker: "LTIM.NS", companyName: "LTIMindtree", sector: "Technology" },
  { ticker: "PERSISTENT.NS", companyName: "Persistent Systems", sector: "Technology" },
  { ticker: "COFORGE.NS", companyName: "Coforge", sector: "Technology" },
  { ticker: "MPHASIS.NS", companyName: "Mphasis", sector: "Technology" },
  // Energy & Oil
  { ticker: "RELIANCE.NS", companyName: "Reliance Industries", sector: "Energy" },
  { ticker: "ONGC.NS", companyName: "Oil & Natural Gas Corporation", sector: "Energy" },
  { ticker: "BPCL.NS", companyName: "Bharat Petroleum", sector: "Energy" },
  { ticker: "IOC.NS", companyName: "Indian Oil Corporation", sector: "Energy" },
  { ticker: "COALINDIA.NS", companyName: "Coal India", sector: "Energy" },
  { ticker: "POWERGRID.NS", companyName: "Power Grid Corporation", sector: "Utilities" },
  { ticker: "NTPC.NS", companyName: "NTPC", sector: "Utilities" },
  { ticker: "TATAPOWER.NS", companyName: "Tata Power", sector: "Utilities" },
  { ticker: "ADANIGREEN.NS", companyName: "Adani Green Energy", sector: "Utilities" },
  { ticker: "ADANIPORTS.NS", companyName: "Adani Ports & SEZ", sector: "Industrials" },
  // Consumer & FMCG
  { ticker: "HINDUNILVR.NS", companyName: "Hindustan Unilever", sector: "Consumer Defensive" },
  { ticker: "ITC.NS", companyName: "ITC", sector: "Consumer Defensive" },
  { ticker: "NESTLEIND.NS", companyName: "Nestlé India", sector: "Consumer Defensive" },
  { ticker: "BRITANNIA.NS", companyName: "Britannia Industries", sector: "Consumer Defensive" },
  { ticker: "DABUR.NS", companyName: "Dabur India", sector: "Consumer Defensive" },
  { ticker: "MARICO.NS", companyName: "Marico", sector: "Consumer Defensive" },
  { ticker: "COLPAL.NS", companyName: "Colgate-Palmolive India", sector: "Consumer Defensive" },
  { ticker: "GODREJCP.NS", companyName: "Godrej Consumer Products", sector: "Consumer Defensive" },
  // Consumer Cyclical / Auto
  { ticker: "MARUTI.NS", companyName: "Maruti Suzuki India", sector: "Consumer Cyclical" },
  { ticker: "TATAMOTORS.NS", companyName: "Tata Motors", sector: "Consumer Cyclical" },
  { ticker: "BAJAJ-AUTO.NS", companyName: "Bajaj Auto", sector: "Consumer Cyclical" },
  { ticker: "HEROMOTOCO.NS", companyName: "Hero MotoCorp", sector: "Consumer Cyclical" },
  { ticker: "EICHERMOT.NS", companyName: "Eicher Motors", sector: "Consumer Cyclical" },
  { ticker: "TVSMOTOR.NS", companyName: "TVS Motor Company", sector: "Consumer Cyclical" },
  { ticker: "TITAN.NS", companyName: "Titan Company", sector: "Consumer Cyclical" },
  { ticker: "DMART.NS", companyName: "Avenue Supermarts (D-Mart)", sector: "Consumer Cyclical" },
  { ticker: "TRENT.NS", companyName: "Trent", sector: "Consumer Cyclical" },
  { ticker: "NAUKRI.NS", companyName: "Info Edge (Naukri)", sector: "Consumer Cyclical" },
  // Industrials
  { ticker: "LT.NS", companyName: "Larsen & Toubro", sector: "Industrials" },
  { ticker: "SIEMENS.NS", companyName: "Siemens India", sector: "Industrials" },
  { ticker: "ABB.NS", companyName: "ABB India", sector: "Industrials" },
  { ticker: "BHEL.NS", companyName: "Bharat Heavy Electricals", sector: "Industrials" },
  { ticker: "HAVELLS.NS", companyName: "Havells India", sector: "Industrials" },
  { ticker: "CUMMINSIND.NS", companyName: "Cummins India", sector: "Industrials" },
  { ticker: "ASTRAL.NS", companyName: "Astral", sector: "Industrials" },
  { ticker: "SUPREMEIND.NS", companyName: "Supreme Industries", sector: "Industrials" },
  // Healthcare / Pharma
  { ticker: "SUNPHARMA.NS", companyName: "Sun Pharmaceutical", sector: "Healthcare" },
  { ticker: "DRREDDY.NS", companyName: "Dr. Reddy's Laboratories", sector: "Healthcare" },
  { ticker: "CIPLA.NS", companyName: "Cipla", sector: "Healthcare" },
  { ticker: "DIVISLAB.NS", companyName: "Divi's Laboratories", sector: "Healthcare" },
  { ticker: "APOLLOHOSP.NS", companyName: "Apollo Hospitals", sector: "Healthcare" },
  { ticker: "TORNTPHARM.NS", companyName: "Torrent Pharmaceuticals", sector: "Healthcare" },
  { ticker: "AUROPHARMA.NS", companyName: "Aurobindo Pharma", sector: "Healthcare" },
  { ticker: "LUPIN.NS", companyName: "Lupin", sector: "Healthcare" },
  { ticker: "ALKEM.NS", companyName: "Alkem Laboratories", sector: "Healthcare" },
  // Basic Materials / Metals
  { ticker: "TATASTEEL.NS", companyName: "Tata Steel", sector: "Basic Materials" },
  { ticker: "JSWSTEEL.NS", companyName: "JSW Steel", sector: "Basic Materials" },
  { ticker: "HINDALCO.NS", companyName: "Hindalco Industries", sector: "Basic Materials" },
  { ticker: "VEDL.NS", companyName: "Vedanta", sector: "Basic Materials" },
  { ticker: "SAIL.NS", companyName: "Steel Authority of India", sector: "Basic Materials" },
  { ticker: "NMDC.NS", companyName: "NMDC", sector: "Basic Materials" },
  { ticker: "PIDILITIND.NS", companyName: "Pidilite Industries", sector: "Basic Materials" },
  { ticker: "ASIANPAINT.NS", companyName: "Asian Paints", sector: "Basic Materials" },
  { ticker: "BERGEPAINT.NS", companyName: "Berger Paints India", sector: "Basic Materials" },
  { ticker: "GRASIM.NS", companyName: "Grasim Industries", sector: "Basic Materials" },
  { ticker: "ULTRACEMCO.NS", companyName: "UltraTech Cement", sector: "Basic Materials" },
  { ticker: "SHREECEM.NS", companyName: "Shree Cement", sector: "Basic Materials" },
  { ticker: "AMBUJACEM.NS", companyName: "Ambuja Cements", sector: "Basic Materials" },
  // Communication Services
  { ticker: "BHARTIARTL.NS", companyName: "Bharti Airtel", sector: "Communication Services" },
  { ticker: "ZOMATO.NS", companyName: "Zomato", sector: "Communication Services" },
  { ticker: "PAYTM.NS", companyName: "One 97 Communications (Paytm)", sector: "Communication Services" },
  // Real Estate
  { ticker: "DLF.NS", companyName: "DLF", sector: "Real Estate" },
  { ticker: "GODREJPROP.NS", companyName: "Godrej Properties", sector: "Real Estate" },
  { ticker: "PRESTIGE.NS", companyName: "Prestige Estates", sector: "Real Estate" },
  { ticker: "OBEROIRLTY.NS", companyName: "Oberoi Realty", sector: "Real Estate" },
  // Conglomerates / Others
  { ticker: "IRFC.NS", companyName: "Indian Railway Finance Corporation", sector: "Financial Services" },
  { ticker: "JSWENERGY.NS", companyName: "JSW Energy", sector: "Utilities" },
  { ticker: "MANKIND.NS", companyName: "Mankind Pharma", sector: "Healthcare" },
  { ticker: "LODHA.NS", companyName: "Macrotech Developers (Lodha)", sector: "Real Estate" },
  { ticker: "TATACONSUM.NS", companyName: "Tata Consumer Products", sector: "Consumer Defensive" },
  { ticker: "TATACHEM.NS", companyName: "Tata Chemicals", sector: "Basic Materials" },
  { ticker: "VOLTAS.NS", companyName: "Voltas", sector: "Industrials" },
  { ticker: "DIXON.NS", companyName: "Dixon Technologies", sector: "Technology" },
  { ticker: "POLYCAB.NS", companyName: "Polycab India", sector: "Industrials" },
  { ticker: "PAGEIND.NS", companyName: "Page Industries", sector: "Consumer Cyclical" },
  { ticker: "SCHAEFFLER.NS", companyName: "Schaeffler India", sector: "Industrials" },
  { ticker: "BOSCHLTD.NS", companyName: "Bosch", sector: "Consumer Cyclical" },
  { ticker: "MOTHERSON.NS", companyName: "Samvardhana Motherson", sector: "Consumer Cyclical" },
];

export const WATCHLIST_TICKERS = new Set(WATCHLIST.map((e) => e.ticker));

export function getWatchlistEntry(ticker: string): WatchlistEntry | undefined {
  return WATCHLIST.find((e) => e.ticker === ticker.toUpperCase());
}
