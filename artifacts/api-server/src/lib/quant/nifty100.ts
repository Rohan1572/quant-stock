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

// The eleven GICS-style sector labels, named once rather than repeated on
// every entry below.
const FINANCIAL_SERVICES = "Financial Services";
const TECHNOLOGY = "Technology";
const ENERGY = "Energy";
const UTILITIES = "Utilities";
const INDUSTRIALS = "Industrials";
const CONSUMER_DEFENSIVE = "Consumer Defensive";
const CONSUMER_CYCLICAL = "Consumer Cyclical";
const HEALTHCARE = "Healthcare";
const BASIC_MATERIALS = "Basic Materials";
const COMMUNICATION_SERVICES = "Communication Services";
const REAL_ESTATE = "Real Estate";

export const WATCHLIST: WatchlistEntry[] = [
  // Financial Services
  {
    ticker: "HDFCBANK.NS",
    companyName: "HDFC Bank",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "ICICIBANK.NS",
    companyName: "ICICI Bank",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "KOTAKBANK.NS",
    companyName: "Kotak Mahindra Bank",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "SBIN.NS",
    companyName: "State Bank of India",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "AXISBANK.NS",
    companyName: "Axis Bank",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "BAJFINANCE.NS",
    companyName: "Bajaj Finance",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "BAJAJFINSV.NS",
    companyName: "Bajaj Finserv",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "HDFCLIFE.NS",
    companyName: "HDFC Life Insurance",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "SBILIFE.NS",
    companyName: "SBI Life Insurance",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "ICICIGI.NS",
    companyName: "ICICI Lombard General Insurance",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "INDUSINDBK.NS",
    companyName: "IndusInd Bank",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "CHOLAFIN.NS",
    companyName: "Cholamandalam Investment",
    sector: FINANCIAL_SERVICES,
  },
  {
    ticker: "MUTHOOTFIN.NS",
    companyName: "Muthoot Finance",
    sector: FINANCIAL_SERVICES,
  },
  // Technology
  {
    ticker: "TCS.NS",
    companyName: "Tata Consultancy Services",
    sector: TECHNOLOGY,
  },
  { ticker: "INFY.NS", companyName: "Infosys", sector: TECHNOLOGY },
  {
    ticker: "HCLTECH.NS",
    companyName: "HCL Technologies",
    sector: TECHNOLOGY,
  },
  { ticker: "WIPRO.NS", companyName: "Wipro", sector: TECHNOLOGY },
  { ticker: "TECHM.NS", companyName: "Tech Mahindra", sector: TECHNOLOGY },
  {
    ticker: "LTTS.NS",
    companyName: "L&T Technology Services",
    sector: TECHNOLOGY,
  },
  {
    ticker: "PERSISTENT.NS",
    companyName: "Persistent Systems",
    sector: TECHNOLOGY,
  },
  { ticker: "COFORGE.NS", companyName: "Coforge", sector: TECHNOLOGY },
  { ticker: "MPHASIS.NS", companyName: "Mphasis", sector: TECHNOLOGY },
  // Energy & Oil
  {
    ticker: "RELIANCE.NS",
    companyName: "Reliance Industries",
    sector: ENERGY,
  },
  {
    ticker: "ONGC.NS",
    companyName: "Oil & Natural Gas Corporation",
    sector: ENERGY,
  },
  { ticker: "BPCL.NS", companyName: "Bharat Petroleum", sector: ENERGY },
  { ticker: "IOC.NS", companyName: "Indian Oil Corporation", sector: ENERGY },
  { ticker: "COALINDIA.NS", companyName: "Coal India", sector: ENERGY },
  {
    ticker: "POWERGRID.NS",
    companyName: "Power Grid Corporation",
    sector: UTILITIES,
  },
  { ticker: "NTPC.NS", companyName: "NTPC", sector: UTILITIES },
  { ticker: "TATAPOWER.NS", companyName: "Tata Power", sector: UTILITIES },
  {
    ticker: "ADANIGREEN.NS",
    companyName: "Adani Green Energy",
    sector: UTILITIES,
  },
  {
    ticker: "ADANIPORTS.NS",
    companyName: "Adani Ports & SEZ",
    sector: INDUSTRIALS,
  },
  // Consumer & FMCG
  {
    ticker: "HINDUNILVR.NS",
    companyName: "Hindustan Unilever",
    sector: CONSUMER_DEFENSIVE,
  },
  { ticker: "ITC.NS", companyName: "ITC", sector: CONSUMER_DEFENSIVE },
  {
    ticker: "NESTLEIND.NS",
    companyName: "Nestlé India",
    sector: CONSUMER_DEFENSIVE,
  },
  {
    ticker: "BRITANNIA.NS",
    companyName: "Britannia Industries",
    sector: CONSUMER_DEFENSIVE,
  },
  {
    ticker: "DABUR.NS",
    companyName: "Dabur India",
    sector: CONSUMER_DEFENSIVE,
  },
  { ticker: "MARICO.NS", companyName: "Marico", sector: CONSUMER_DEFENSIVE },
  {
    ticker: "COLPAL.NS",
    companyName: "Colgate-Palmolive India",
    sector: CONSUMER_DEFENSIVE,
  },
  {
    ticker: "GODREJCP.NS",
    companyName: "Godrej Consumer Products",
    sector: CONSUMER_DEFENSIVE,
  },
  // Consumer Cyclical / Auto
  {
    ticker: "MARUTI.NS",
    companyName: "Maruti Suzuki India",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "M&M.NS",
    companyName: "Mahindra & Mahindra",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "BAJAJ-AUTO.NS",
    companyName: "Bajaj Auto",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "HEROMOTOCO.NS",
    companyName: "Hero MotoCorp",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "EICHERMOT.NS",
    companyName: "Eicher Motors",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "TVSMOTOR.NS",
    companyName: "TVS Motor Company",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "TITAN.NS",
    companyName: "Titan Company",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "DMART.NS",
    companyName: "Avenue Supermarts (D-Mart)",
    sector: CONSUMER_CYCLICAL,
  },
  { ticker: "TRENT.NS", companyName: "Trent", sector: CONSUMER_CYCLICAL },
  {
    ticker: "NAUKRI.NS",
    companyName: "Info Edge (Naukri)",
    sector: CONSUMER_CYCLICAL,
  },
  // Industrials
  { ticker: "LT.NS", companyName: "Larsen & Toubro", sector: INDUSTRIALS },
  { ticker: "SIEMENS.NS", companyName: "Siemens India", sector: INDUSTRIALS },
  { ticker: "ABB.NS", companyName: "ABB India", sector: INDUSTRIALS },
  {
    ticker: "BHEL.NS",
    companyName: "Bharat Heavy Electricals",
    sector: INDUSTRIALS,
  },
  { ticker: "HAVELLS.NS", companyName: "Havells India", sector: INDUSTRIALS },
  {
    ticker: "CUMMINSIND.NS",
    companyName: "Cummins India",
    sector: INDUSTRIALS,
  },
  { ticker: "ASTRAL.NS", companyName: "Astral", sector: INDUSTRIALS },
  {
    ticker: "SUPREMEIND.NS",
    companyName: "Supreme Industries",
    sector: INDUSTRIALS,
  },
  // Healthcare / Pharma
  {
    ticker: "SUNPHARMA.NS",
    companyName: "Sun Pharmaceutical",
    sector: HEALTHCARE,
  },
  {
    ticker: "DRREDDY.NS",
    companyName: "Dr. Reddy's Laboratories",
    sector: HEALTHCARE,
  },
  { ticker: "CIPLA.NS", companyName: "Cipla", sector: HEALTHCARE },
  {
    ticker: "DIVISLAB.NS",
    companyName: "Divi's Laboratories",
    sector: HEALTHCARE,
  },
  {
    ticker: "APOLLOHOSP.NS",
    companyName: "Apollo Hospitals",
    sector: HEALTHCARE,
  },
  {
    ticker: "TORNTPHARM.NS",
    companyName: "Torrent Pharmaceuticals",
    sector: HEALTHCARE,
  },
  {
    ticker: "AUROPHARMA.NS",
    companyName: "Aurobindo Pharma",
    sector: HEALTHCARE,
  },
  { ticker: "LUPIN.NS", companyName: "Lupin", sector: HEALTHCARE },
  {
    ticker: "ALKEM.NS",
    companyName: "Alkem Laboratories",
    sector: HEALTHCARE,
  },
  // Basic Materials / Metals
  {
    ticker: "TATASTEEL.NS",
    companyName: "Tata Steel",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "JSWSTEEL.NS",
    companyName: "JSW Steel",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "HINDALCO.NS",
    companyName: "Hindalco Industries",
    sector: BASIC_MATERIALS,
  },
  { ticker: "VEDL.NS", companyName: "Vedanta", sector: BASIC_MATERIALS },
  {
    ticker: "SAIL.NS",
    companyName: "Steel Authority of India",
    sector: BASIC_MATERIALS,
  },
  { ticker: "NMDC.NS", companyName: "NMDC", sector: BASIC_MATERIALS },
  {
    ticker: "PIDILITIND.NS",
    companyName: "Pidilite Industries",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "ASIANPAINT.NS",
    companyName: "Asian Paints",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "BERGEPAINT.NS",
    companyName: "Berger Paints India",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "GRASIM.NS",
    companyName: "Grasim Industries",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "ULTRACEMCO.NS",
    companyName: "UltraTech Cement",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "SHREECEM.NS",
    companyName: "Shree Cement",
    sector: BASIC_MATERIALS,
  },
  {
    ticker: "AMBUJACEM.NS",
    companyName: "Ambuja Cements",
    sector: BASIC_MATERIALS,
  },
  // Communication Services
  {
    ticker: "BHARTIARTL.NS",
    companyName: "Bharti Airtel",
    sector: COMMUNICATION_SERVICES,
  },
  {
    ticker: "SWIGGY.NS",
    companyName: "Swiggy",
    sector: COMMUNICATION_SERVICES,
  },
  {
    ticker: "PAYTM.NS",
    companyName: "One 97 Communications (Paytm)",
    sector: COMMUNICATION_SERVICES,
  },
  // Real Estate
  { ticker: "DLF.NS", companyName: "DLF", sector: REAL_ESTATE },
  {
    ticker: "GODREJPROP.NS",
    companyName: "Godrej Properties",
    sector: REAL_ESTATE,
  },
  {
    ticker: "PRESTIGE.NS",
    companyName: "Prestige Estates",
    sector: REAL_ESTATE,
  },
  {
    ticker: "OBEROIRLTY.NS",
    companyName: "Oberoi Realty",
    sector: REAL_ESTATE,
  },
  // Conglomerates / Others
  {
    ticker: "IRFC.NS",
    companyName: "Indian Railway Finance Corporation",
    sector: FINANCIAL_SERVICES,
  },
  { ticker: "JSWENERGY.NS", companyName: "JSW Energy", sector: UTILITIES },
  { ticker: "MANKIND.NS", companyName: "Mankind Pharma", sector: HEALTHCARE },
  {
    ticker: "LODHA.NS",
    companyName: "Macrotech Developers (Lodha)",
    sector: REAL_ESTATE,
  },
  {
    ticker: "TATACONSUM.NS",
    companyName: "Tata Consumer Products",
    sector: CONSUMER_DEFENSIVE,
  },
  {
    ticker: "TATACHEM.NS",
    companyName: "Tata Chemicals",
    sector: BASIC_MATERIALS,
  },
  { ticker: "VOLTAS.NS", companyName: "Voltas", sector: INDUSTRIALS },
  {
    ticker: "DIXON.NS",
    companyName: "Dixon Technologies",
    sector: TECHNOLOGY,
  },
  { ticker: "POLYCAB.NS", companyName: "Polycab India", sector: INDUSTRIALS },
  {
    ticker: "PAGEIND.NS",
    companyName: "Page Industries",
    sector: CONSUMER_CYCLICAL,
  },
  {
    ticker: "SCHAEFFLER.NS",
    companyName: "Schaeffler India",
    sector: INDUSTRIALS,
  },
  { ticker: "BOSCHLTD.NS", companyName: "Bosch", sector: CONSUMER_CYCLICAL },
  {
    ticker: "MOTHERSON.NS",
    companyName: "Samvardhana Motherson",
    sector: CONSUMER_CYCLICAL,
  },
];

export const WATCHLIST_TICKERS = new Set(WATCHLIST.map((e) => e.ticker));

export function getWatchlistEntry(ticker: string): WatchlistEntry | undefined {
  return WATCHLIST.find((e) => e.ticker === ticker.toUpperCase());
}
