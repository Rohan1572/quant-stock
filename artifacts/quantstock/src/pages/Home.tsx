import { Link } from "wouter";
import { Activity, TrendingUp, Search as SearchIcon } from "lucide-react";
import { SearchCombobox } from "@/components/search/SearchCombobox";

const TRENDING_TICKERS = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank" },
  { symbol: "INFY.NS", name: "Infosys" },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 w-full max-w-5xl mx-auto min-h-[calc(100vh-8rem)]">
      
      <div className="text-center mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20">
          <Activity className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-foreground">
          Precision scoring for <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
            Indian equities.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          No black-box AI. Just pure, transparent quantitative models computing fair value, risk, and momentum on NSE & BSE.
        </p>
      </div>

      <div className="w-full max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 fill-mode-both">
        <SearchCombobox autoFocus />
      </div>

      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span>Trending Tickers</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRENDING_TICKERS.map((ticker) => (
            <Link 
              key={ticker.symbol} 
              href={`/stocks/${ticker.symbol}`}
              className="flex flex-col p-3 rounded-lg border bg-card hover:bg-secondary hover:border-primary/50 transition-all text-left"
              data-testid={`trending-${ticker.symbol}`}
            >
              <span className="font-mono font-bold text-sm text-foreground mb-1">
                {ticker.symbol.split('.')[0]}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {ticker.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
      
    </div>
  );
}
