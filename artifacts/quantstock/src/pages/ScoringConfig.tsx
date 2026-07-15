import { useState, useEffect } from "react";
import { useListScoringConfigs, useUpsertScoringConfig, getListScoringConfigsQueryKey, ScoringConfig as IScoringConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Settings2, AlertCircle, Save, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const configSchema = z.object({
  sector: z.string().optional().transform(val => val === "" ? undefined : val),
  valuationWeight: z.coerce.number().min(0).max(1),
  financialHealthWeight: z.coerce.number().min(0).max(1),
  profitabilityWeight: z.coerce.number().min(0).max(1),
  growthWeight: z.coerce.number().min(0).max(1),
  riskWeight: z.coerce.number().min(0).max(1),
  momentumWeight: z.coerce.number().min(0).max(1),
}).refine(data => {
  const sum = data.valuationWeight + data.financialHealthWeight + data.profitabilityWeight + 
              data.growthWeight + data.riskWeight + data.momentumWeight;
  // allow small floating point variance
  return Math.abs(sum - 1.0) < 0.01;
}, {
  message: "Weights must exactly sum to 1.0",
  path: ["valuationWeight"], // attach error to first field
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function ScoringConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: configs, isLoading } = useListScoringConfigs();
  const upsertConfig = useUpsertScoringConfig();

  const [isEditing, setIsEditing] = useState(false);
  const [editingSector, setEditingSector] = useState<string | null | undefined>(undefined);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      sector: "",
      valuationWeight: 0.25,
      financialHealthWeight: 0.20,
      profitabilityWeight: 0.15,
      growthWeight: 0.15,
      riskWeight: 0.15,
      momentumWeight: 0.10,
    }
  });

  // Watch weights to show live sum
  const watchAllFields = form.watch();
  const currentSum = (
    (Number(watchAllFields.valuationWeight) || 0) +
    (Number(watchAllFields.financialHealthWeight) || 0) +
    (Number(watchAllFields.profitabilityWeight) || 0) +
    (Number(watchAllFields.growthWeight) || 0) +
    (Number(watchAllFields.riskWeight) || 0) +
    (Number(watchAllFields.momentumWeight) || 0)
  );

  const startEdit = (config?: IScoringConfig) => {
    if (config) {
      form.reset({
        sector: config.sector || "",
        valuationWeight: config.valuationWeight,
        financialHealthWeight: config.financialHealthWeight,
        profitabilityWeight: config.profitabilityWeight,
        growthWeight: config.growthWeight,
        riskWeight: config.riskWeight,
        momentumWeight: config.momentumWeight,
      });
      setEditingSector(config.sector);
    } else {
      form.reset({
        sector: "",
        valuationWeight: 0.25,
        financialHealthWeight: 0.20,
        profitabilityWeight: 0.15,
        growthWeight: 0.15,
        riskWeight: 0.15,
        momentumWeight: 0.10,
      });
      setEditingSector(undefined);
    }
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingSector(undefined);
    form.reset();
  };

  const onSubmit = (data: ConfigFormValues) => {
    upsertConfig.mutate(
      { 
        data: {
          sector: data.sector || null,
          valuationWeight: data.valuationWeight,
          financialHealthWeight: data.financialHealthWeight,
          profitabilityWeight: data.profitabilityWeight,
          growthWeight: data.growthWeight,
          riskWeight: data.riskWeight,
          momentumWeight: data.momentumWeight,
        }
      },
      {
        onSuccess: () => {
          toast({
            title: "Configuration Saved",
            description: `Successfully updated weights for ${data.sector || 'Platform Default'}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListScoringConfigsQueryKey() });
          setIsEditing(false);
        },
        onError: (err: any) => {
          toast({
            title: "Failed to save",
            description: err?.error || "Unknown error occurred.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="flex-1 w-full bg-background p-6">
      <div className="container max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
              <Settings2 className="w-8 h-8 mr-3 text-primary" />
              Scoring Configurations
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Adjust the weight of each category used to compute the final stock score. 
              The Platform Default applies to all stocks unless a sector-specific override is created.
            </p>
          </div>
          {!isEditing && (
            <Button onClick={() => startEdit()} className="shadow-sm" data-testid="button-create-override">
              <Plus className="w-4 h-4 mr-2" /> Add Sector Override
            </Button>
          )}
        </div>

        {isEditing ? (
          <Card className="mb-8 border-primary/20 shadow-md">
            <CardHeader className="bg-secondary/30 border-b pb-4">
              <CardTitle className="text-xl">
                {editingSector === null ? "Edit Platform Default" : editingSector ? `Edit Sector Override: ${editingSector}` : "Create Sector Override"}
              </CardTitle>
              <CardDescription>Weights are represented as decimals (e.g., 0.25 = 25%) and must sum exactly to 1.0.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {editingSector !== null && (
                  <div className="max-w-sm space-y-2">
                    <label className="text-sm font-medium">Sector Name</label>
                    <Input 
                      placeholder="e.g. Technology" 
                      {...form.register("sector")} 
                      disabled={editingSector !== undefined} // cant change sector once created, only platform default is null
                      data-testid="input-sector"
                    />
                    <p className="text-sm text-muted-foreground">Leave empty for platform default (if creating one)</p>
                    {form.formState.errors.sector && <p className="text-sm text-destructive">{form.formState.errors.sector.message}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 p-4 bg-muted/20 rounded-xl border border-dashed">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valuation</label>
                    <Input type="number" step="0.01" min="0" max="1" {...form.register("valuationWeight")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Financial Health</label>
                    <Input type="number" step="0.01" min="0" max="1" {...form.register("financialHealthWeight")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Profitability</label>
                    <Input type="number" step="0.01" min="0" max="1" {...form.register("profitabilityWeight")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Growth</label>
                    <Input type="number" step="0.01" min="0" max="1" {...form.register("growthWeight")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Risk</label>
                    <Input type="number" step="0.01" min="0" max="1" {...form.register("riskWeight")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Momentum</label>
                    <Input type="number" step="0.01" min="0" max="1" {...form.register("momentumWeight")} />
                  </div>
                </div>
                
                {form.formState.errors.valuationWeight && (
                  <div className="flex items-center text-sm text-destructive font-medium p-3 bg-destructive/10 rounded-md">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {form.formState.errors.valuationWeight.message}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm font-medium">
                    <span className="text-muted-foreground">Total Sum:</span>
                    <span className={`font-mono text-lg ${Math.abs(currentSum - 1.0) < 0.01 ? 'text-buy' : 'text-destructive'}`}>
                      {currentSum.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={cancelEdit} disabled={upsertConfig.isPending}>
                      <X className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                    <Button type="submit" disabled={upsertConfig.isPending} data-testid="button-save-config">
                      <Save className="w-4 h-4 mr-2" /> 
                      {upsertConfig.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Active Configurations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : configs && configs.length > 0 ? (
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Target</TableHead>
                    <TableHead className="text-right">Valuation</TableHead>
                    <TableHead className="text-right">Health</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Growth</TableHead>
                    <TableHead className="text-right">Risk</TableHead>
                    <TableHead className="text-right">Momentum</TableHead>
                    <TableHead className="text-right w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id} className={config.sector === null ? "bg-primary/5 font-medium" : ""}>
                      <TableCell>
                        {config.sector === null ? (
                          <Badge variant="default" className="shadow-none rounded">Platform Default</Badge>
                        ) : (
                          <span className="font-medium text-foreground">{config.sector}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{(config.valuationWeight * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-mono">{(config.financialHealthWeight * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-mono">{(config.profitabilityWeight * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-mono">{(config.growthWeight * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-mono">{(config.riskWeight * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-mono">{(config.momentumWeight * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => startEdit(config)}
                          className="h-8 w-8 p-0"
                          data-testid={`button-edit-${config.sector || 'default'}`}
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No configurations found.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
