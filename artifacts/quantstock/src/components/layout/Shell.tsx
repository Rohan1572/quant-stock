import { Link, useLocation } from "wouter";
import { Activity, Settings, Trophy, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { SearchCombobox } from "@/components/search/SearchCombobox";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const showHeaderSearch = location !== "/";

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 mr-6 text-foreground hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">QuantStock</span>
          </Link>
          
          <div className="flex-1 flex items-center justify-end md:justify-between space-x-2 md:space-x-4">
            <div className="hidden md:flex flex-1 max-w-sm">
              {showHeaderSearch && <SearchCombobox compact className="w-full" />}
            </div>
            
            <nav className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Link href="/rankings"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors",
                  location === "/rankings"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Top 100</span>
              </Link>
              <Link href="/scoring-config" 
                className={cn(
                  "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors",
                  location === "/scoring-config" 
                    ? "bg-secondary text-secondary-foreground" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configuration</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full">
        {children}
      </main>
      
      <footer className="py-6 md:py-0 border-t mt-auto bg-card text-card-foreground">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:h-16 px-4 md:px-8">
          <p className="text-sm text-muted-foreground">
            QuantStock engine. Data is for informational purposes.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>v0.1.0</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-buy animate-pulse"></span>
              API Connected
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
