import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Loader2, ArrowRight } from "lucide-react";
import { useSearchStocks, getSearchStocksQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchCombobox({ 
  className, 
  autoFocus = false,
  compact = false,
}: { 
  className?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  const { data: results, isLoading } = useSearchStocks(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 0, queryKey: getSearchStocksQueryKey({ q: debouncedQuery }) } }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (ticker: string) => {
    setIsOpen(false);
    setLocation(`/stocks/${encodeURIComponent(ticker.toUpperCase())}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSelect(query.trim());
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", compact ? "max-w-xs" : "max-w-2xl mx-auto", className)}>
      <form onSubmit={onSubmit} className="relative">
        <div className="relative group">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors", compact ? "w-3.5 h-3.5" : "w-5 h-5 left-4")} />
          <Input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder={compact ? "Search tickers…" : "Search tickers (e.g. RELIANCE, TCS, INFY)"}
            autoFocus={autoFocus}
            className={cn(
              "bg-card border-input focus-visible:border-primary font-mono uppercase",
              compact
                ? "pl-8 pr-8 h-8 text-xs rounded-md border"
                : "pl-12 pr-12 h-14 text-lg border-2 shadow-sm rounded-xl"
            )}
            data-testid="input-ticker-search"
          />
          {isLoading && query === debouncedQuery && query.length > 0 && (
            <Loader2 className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin", compact ? "w-3 h-3" : "w-5 h-5 right-4")} />
          )}
          {!isLoading && query.length > 0 && (
            <button
              type="submit"
              className={cn("absolute right-2 top-1/2 -translate-y-1/2 bg-primary/10 text-primary rounded hover:bg-primary hover:text-primary-foreground transition-colors", compact ? "p-0.5" : "p-1.5 right-3")}
              data-testid="button-search-submit"
            >
              <ArrowRight className={compact ? "w-3 h-3" : "w-4 h-4"} />
            </button>
          )}
        </div>
      </form>

      {isOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching database...
            </div>
          ) : results && results.length > 0 ? (
            <ul className="max-h-[300px] overflow-auto py-2">
              {results.map((stock) => (
                <li key={stock.ticker}>
                  <button
                    onClick={() => handleSelect(stock.ticker)}
                    className="w-full px-4 py-3 flex flex-col md:flex-row md:items-center justify-between hover:bg-secondary transition-colors text-left gap-1 md:gap-4"
                    data-testid={`search-result-${stock.ticker}`}
                  >
                    <span className="font-mono font-bold text-foreground">
                      {stock.ticker}
                    </span>
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {stock.companyName}
                    </span>
                    <span className="text-xs font-mono px-2 py-1 rounded bg-secondary-foreground/5 text-muted-foreground">
                      {stock.exchange}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No exact matches for <span className="font-mono">{query}</span>. Press enter to force scan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
