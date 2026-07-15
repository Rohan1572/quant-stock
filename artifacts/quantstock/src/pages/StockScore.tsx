import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Info,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { 
  useGetStock, 
  useGetStockScore, 
  useGetStockScoreDetails,
  getGetStockScoreDetailsQueryKey
} from "@workspace/api-client-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PriceChart } from "@/components/chart/PriceChart";

function formatRecommendation(rec: string) {
  return rec.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getRecommendationVariant(rec: string): "buy" | "sell" | "hold" {
  if (rec.includes('buy')) return 'buy';
  if (rec.includes('sell') || rec.includes('short') || rec.includes('reduce')) return 'sell';
  return 'hold';
}

function getRecommendationColor(rec: string) {
  if (rec.includes('buy')) return 'text-buy';
  if (rec.includes('sell') || rec.includes('short') || rec.includes('reduce')) return 'text-sell';
  return 'text-hold';
}

export default function StockScore() {
  const { ticker } = useParams<{ ticker: string }>();
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();
  
  const [chartRange, setChartRange] = useState<'1m' | '6m' | '1y' | '5y'>('1y');
  const [showDetails, setShowDetails] = useState(false);

  const { data: stock, isLoading: isStockLoading, isError: isStockError } = useGetStock(decodedTicker);
  const { data: score, isLoading: isScoreLoading, isError: isScoreError } = useGetStockScore(decodedTicker);
  const { data: details, isLoading: isDetailsLoading } = useGetStockScoreDetails(
    decodedTicker,
    { query: { enabled: showDetails, queryKey: getGetStockScoreDetailsQueryKey(decodedTicker) } }
  );

  if (isStockError || isScoreError) {
    return (
      <div className="flex-1 container max-w-5xl mx-auto py-8 px-4 flex flex-col items-center justify-center text-center">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Ticker Not Found</h2>
        <p className="text-muted-foreground mb-6">Could not find scoring data for {decodedTicker}.</p>
        <Link href="/">
          <Button>Back to Search</Button>
        </Link>
      </div>
    );
  }

  const isLoading = isStockLoading || isScoreLoading;

  return (
    <div className="flex-1 w-full bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Terminal
            </Link>
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-5 w-48" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-mono">
                    {stock?.ticker}
                  </h1>
                  <Badge variant="outline" className="text-sm">
                    {stock?.currency || 'INR'}
                  </Badge>
                </div>
                <h2 className="text-lg md:text-xl text-muted-foreground font-medium">
                  {stock?.companyName}
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span>{stock?.sector}</span>
                  {stock?.industry && (
                    <>
                      <span>•</span>
                      <span>{stock?.industry}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end p-4 bg-card rounded-xl border shadow-sm mt-4 md:mt-0 min-w-[200px]">
            <span className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Current Price</span>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono">
                  ₹{stock?.price?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'N/A'}
                </span>
                {stock?.changePercent != null && (
                  <span className={`text-sm font-medium flex items-center ${stock.changePercent >= 0 ? 'text-buy' : 'text-sell'}`}>
                    {stock.changePercent >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {Math.abs(stock.changePercent).toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Score Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Top Level Recommendation */}
          <Card className="lg:col-span-1 bg-card border-2 shadow-sm overflow-hidden flex flex-col">
            <div className="h-2 w-full bg-gradient-to-r from-primary to-blue-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quant Score</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center text-center pb-8 pt-4">
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <Skeleton className="w-32 h-32 rounded-full mb-4" />
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <>
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle cx="72" cy="72" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/30" />
                      <circle 
                        cx="72" cy="72" r="60" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray={377} 
                        strokeDashoffset={377 - (377 * (score?.overallScore || 0)) / 100}
                        className={getRecommendationColor(score?.recommendation || 'hold')} 
                        strokeLinecap="round" 
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-5xl font-black font-mono tracking-tighter">
                        {Math.round(score?.overallScore || 0)}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground uppercase mt-1">/ 100</span>
                    </div>
                  </div>
                  
                  <Badge 
                    variant={getRecommendationVariant(score?.recommendation || 'hold')} 
                    className="text-lg px-4 py-1.5 font-bold uppercase tracking-widest shadow-sm"
                  >
                    {formatRecommendation(score?.recommendation || 'hold')}
                  </Badge>
                  
                  <div className="flex items-center gap-1 mt-4 text-sm font-medium text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
                    <Activity className="w-4 h-4" />
                    Confidence: {Math.round(score?.confidence || 0)}%
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Explanation & Value */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Fair Value Estimate */}
                  {score?.fairValueEstimate && stock?.price && (
                    <div className="p-4 rounded-xl border bg-secondary/30 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">DCF Fair Value Estimate</div>
                        <div className="text-2xl font-bold font-mono">
                          ₹{score.fairValueEstimate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Upside / Downside</div>
                        {score.fairValueEstimate > stock.price ? (
                          <div className="text-xl font-bold text-buy flex items-center justify-end">
                            <TrendingUp className="w-5 h-5 mr-1" />
                            +{(((score.fairValueEstimate - stock.price) / stock.price) * 100).toFixed(1)}%
                          </div>
                        ) : (
                          <div className="text-xl font-bold text-sell flex items-center justify-end">
                            <TrendingDown className="w-5 h-5 mr-1" />
                            {(((score.fairValueEstimate - stock.price) / stock.price) * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reasons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-buy flex items-center mb-3">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Key Drivers
                      </h4>
                      <ul className="space-y-2">
                        {score?.explanation.reasons.map((reason, i) => (
                          <li key={i} className="text-sm flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-buy mt-1.5 mr-2 shrink-0" />
                            <span className="text-foreground/90 leading-tight">{reason}</span>
                          </li>
                        ))}
                        {score?.explanation.reasons.length === 0 && (
                          <li className="text-sm text-muted-foreground italic">No strong positive drivers detected.</li>
                        )}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-sell flex items-center mb-3">
                        <AlertTriangle className="w-4 h-4 mr-1.5" /> Risk Factors
                      </h4>
                      <ul className="space-y-2">
                        {score?.explanation.risks.map((risk, i) => (
                          <li key={i} className="text-sm flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-sell mt-1.5 mr-2 shrink-0" />
                            <span className="text-foreground/90 leading-tight">{risk}</span>
                          </li>
                        ))}
                        {score?.riskFlags.map((flag, i) => (
                          <li key={`flag-${i}`} className="text-sm flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 mr-2 shrink-0" />
                            <span className="text-foreground/90 font-medium leading-tight">{flag}</span>
                          </li>
                        ))}
                        {score?.explanation.risks.length === 0 && score?.riskFlags.length === 0 && (
                          <li className="text-sm text-muted-foreground italic">No significant risks detected.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle>Category Scores</CardTitle>
              <CardDescription>Relative to sector peers</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : score?.categoryScores ? (
                <div className="space-y-5">
                  {Object.entries(score.categoryScores).map(([key, value]) => {
                    // format camelCase to Title Case
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    // pick color based on value
                    let color = 'bg-primary';
                    if (value >= 70) color = 'bg-buy';
                    else if (value <= 40) color = 'bg-sell';
                    else color = 'bg-hold';

                    return (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-sm font-mono font-bold">{Math.round(value)}</span>
                        </div>
                        <Progress value={value} indicatorColor={color} className="h-2 bg-secondary" />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <div>
                <CardTitle>Price History</CardTitle>
              </div>
              <Tabs 
                value={chartRange} 
                onValueChange={(v) => setChartRange(v as any)} 
                className="w-auto"
              >
                <TabsList className="grid w-full grid-cols-4 h-8">
                  <TabsTrigger value="1m" className="text-xs px-2">1M</TabsTrigger>
                  <TabsTrigger value="6m" className="text-xs px-2">6M</TabsTrigger>
                  <TabsTrigger value="1y" className="text-xs px-2">1Y</TabsTrigger>
                  <TabsTrigger value="5y" className="text-xs px-2">5Y</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-6">
              <PriceChart ticker={decodedTicker} range={chartRange} />
            </CardContent>
          </Card>
        </div>

        {/* Drill Down Details */}
        <div className="mb-12">
          <Button 
            variant="outline" 
            className="w-full py-6 text-base font-medium shadow-sm hover:bg-secondary/50 border-dashed"
            onClick={() => setShowDetails(!showDetails)}
            data-testid="button-toggle-details"
          >
            {showDetails ? (
              <><ChevronUp className="w-5 h-5 mr-2" /> Hide Technical Details</>
            ) : (
              <><ChevronDown className="w-5 h-5 mr-2" /> See the Numbers (Drill Down)</>
            )}
          </Button>

          {showDetails && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
              {isDetailsLoading ? (
                <Card>
                  <CardContent className="p-8 flex items-center justify-center">
                    <Skeleton className="h-8 w-8 rounded-full mr-4" />
                    <span className="text-muted-foreground font-medium">Loading raw metrics...</span>
                  </CardContent>
                </Card>
              ) : details ? (
                <div className="space-y-6">
                  
                  {/* DCF Assumptions */}
                  <Card className="bg-secondary/20 border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center">
                        <Info className="w-5 h-5 mr-2 text-primary" /> DCF Model Assumptions
                      </CardTitle>
                      <CardDescription>Variables used to compute the Fair Value Estimate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-card rounded-lg border shadow-sm">
                          <div className="text-sm text-muted-foreground mb-1">Cost of Capital (WACC)</div>
                          <div className="text-xl font-bold font-mono">{(details.dcfAssumptions.wacc * 100).toFixed(1)}%</div>
                        </div>
                        <div className="p-4 bg-card rounded-lg border shadow-sm">
                          <div className="text-sm text-muted-foreground mb-1">Terminal Growth Rate</div>
                          <div className="text-xl font-bold font-mono">{(details.dcfAssumptions.terminalGrowthRate * 100).toFixed(1)}%</div>
                        </div>
                        <div className="p-4 bg-card rounded-lg border shadow-sm">
                          <div className="text-sm text-muted-foreground mb-1">Projection Period</div>
                          <div className="text-xl font-bold font-mono">{details.dcfAssumptions.projectionYears} Years</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Categories Detail Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {details.categories.map((category) => (
                      <Card key={category.category} className="shadow-sm overflow-hidden">
                        <div className="bg-secondary/40 p-4 border-b flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg">{category.category}</h3>
                            <Badge variant="outline" className="text-xs bg-background">
                              Weight: {(category.weight * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="text-xl font-black font-mono">
                            {Math.round(category.score)}
                          </div>
                        </div>
                        <CardContent className="p-0">
                          <div className="divide-y divide-border/50">
                            {category.metrics.map((metric) => (
                              <div key={metric.key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors">
                                <div className="mb-2 sm:mb-0">
                                  <div className="font-medium text-sm">{metric.label}</div>
                                  {metric.sectorBenchmark != null && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      Sector Avg: {metric.sectorBenchmark.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                                  <div className="text-right">
                                    <div className="text-xs text-muted-foreground uppercase mb-0.5 tracking-wider">Value</div>
                                    <div className="font-mono text-sm font-bold">
                                      {metric.value != null ? metric.value.toFixed(2) : 'N/A'}
                                    </div>
                                  </div>
                                  <div className="text-right w-16">
                                    <div className="text-xs text-muted-foreground uppercase mb-0.5 tracking-wider">Score</div>
                                    <div className={`font-mono text-sm font-bold ${
                                      metric.score >= 70 ? 'text-buy' : 
                                      metric.score <= 40 ? 'text-sell' : 'text-hold'
                                    }`}>
                                      {Math.round(metric.score)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
