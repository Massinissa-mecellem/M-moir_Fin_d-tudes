import { useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Leaf, Droplets, Trophy, AlertTriangle, ChevronDown, Check,
  Activity, Loader2, FileSpreadsheet,
} from "lucide-react";
import { PlatformSidebar } from "@/components/PlatformSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parcellesApi, compareParcellesSeries } from "@/features/parcelles/api";
import type { ParcelleSeriesResult } from "@/features/parcelles/api";
import type { Parcelle, AnalyticsPoint } from "@/features/parcelles/types";

/* ─── constants ──────────────────────────────────────────────── */

const INDICE_OPTIONS = [
  { key: "ndvi"  as const, label: "NDVI",  description: "Végétation" },
  { key: "ndwi"  as const, label: "NDWI",  description: "Humidité" },
  { key: "savi"  as const, label: "SAVI",  description: "Sol aride" },
  { key: "gndvi" as const, label: "GNDVI", description: "Chlorophylle" },
];
type IndiceKey = "ndvi" | "ndwi" | "savi" | "gndvi";

const PARCEL_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444"];

const THRESHOLDS: Record<IndiceKey, { critical: number; vigilance: number; good: number }> = {
  ndvi:  { critical: 0.30, vigilance: 0.45, good: 0.60 },
  ndwi:  { critical: 0.10, vigilance: 0.20, good: 0.30 },
  savi:  { critical: 0.20, vigilance: 0.35, good: 0.50 },
  gndvi: { critical: 0.20, vigilance: 0.40, good: 0.60 },
};

const fmtDate  = (v: string) => v.slice(5);
const fmtInput = (d: Date)   => d.toISOString().slice(0, 10);

const preset = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { debut: fmtInput(start), fin: fmtInput(end) };
};

/* ─── page component ────────────────────────────────────────── */

const IndicesPage = () => {
  const [parcelles,       setParcelles]       = useState<Parcelle[]>([]);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);
  const [indice,          setIndice]          = useState<IndiceKey>("ndvi");
  const [dateRange,       setDateRange]       = useState(() => preset(180));
  const [results,         setResults]         = useState<ParcelleSeriesResult[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [listLoading,     setListLoading]     = useState(true);
  const [dropdownOpen,    setDropdownOpen]    = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  /* load parcel list */
  useEffect(() => {
    parcellesApi.list()
      .then(data => {
        setParcelles(data);
        setSelectedIds(data.slice(0, 3).map(p => p._id));
      })
      .catch(console.error)
      .finally(() => setListLoading(false));
  }, []);

  /* close dropdown on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* fetch series data */
  useEffect(() => {
    if (selectedIds.length === 0) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    compareParcellesSeries(selectedIds, dateRange.debut, dateRange.fin)
      .then(d => { if (!cancelled) setResults(d); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedIds, dateRange.debut, dateRange.fin]);

  /* merge dates into a flat chart-data array */
  const chartData = useMemo(() => {
    const map = new Map<string, Record<string, number | null>>();
    results.forEach(r => {
      r.series.forEach(pt => {
        if (!map.has(pt.date)) map.set(pt.date, {});
        const entry = map.get(pt.date)!;
        const val = pt[indice as keyof AnalyticsPoint];
        entry[r.parcelleId] = val != null ? Number((val as number).toFixed(3)) : null;
      });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [results, indice]);

  /* kpi metrics */
  const kpis = useMemo(() => {
    if (!results.length) return null;
    const thresh = THRESHOLDS[indice];

    const perParcel = results.map(r => {
      const vals = r.series
        .map(p => p[indice as keyof AnalyticsPoint] as number | null)
        .filter((v): v is number => v != null);
      return { id: r.parcelleId, nom: r.nom, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    }).filter(r => r.avg != null) as { id: string; nom: string; avg: number }[];

    if (!perParcel.length) return null;

    const ndwiVals = results.flatMap(r =>
      r.series.filter(p => p.ndwi != null).map(p => p.ndwi as number)
    );
    const ndwiAvg = ndwiVals.length ? ndwiVals.reduce((a, b) => a + b, 0) / ndwiVals.length : null;

    return {
      globalAvg: perParcel.reduce((s, r) => s + r.avg, 0) / perParcel.length,
      ndwiAvg,
      best:  perParcel.reduce((a, b) => a.avg > b.avg ? a : b),
      worst: perParcel.reduce((a, b) => a.avg < b.avg ? a : b),
      thresh,
    };
  }, [results, indice]);

  const thresh = THRESHOLDS[indice];
  const currentIndice = INDICE_OPTIONS.find(o => o.key === indice)!;

  const toggleParcel = (id: string) =>
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );

  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    // Header: Date, Parcel1, Parcel2...
    const header = ["Date", ...results.map(r => r.nom)];
    
    // Rows: Merge by date
    const csvRows = chartData.map(row => {
      return [
        row.date,
        ...results.map(r => row[r.parcelleId] ?? "")
      ].join(",");
    });

    const csvContent = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Analyse_Spectrale_${indice.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <PlatformSidebar />

      <main className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="border-b border-border bg-card px-8 py-5 sticky top-0 z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">AgriSpectra › Analyse Spectrale</p>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Activity className="size-6 text-emerald-500 mt-1" />
                Analyse Spectrale NDVI / NDWI
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* ── Parcelle multi-select ── */}
              <div className="relative" ref={dropRef}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                >
                  {listLoading
                    ? <Loader2 className="size-4 animate-spin text-slate-400" />
                    : <><span className="text-slate-700">{selectedIds.length} parcelle{selectedIds.length !== 1 ? "s" : ""}</span>
                       <ChevronDown className="size-4 text-slate-400" /></>
                  }
                </button>
                {dropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-xl">
                    <p className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                      Sélectionner des parcelles (max 5)
                    </p>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {parcelles.map((p, i) => (
                        <label
                          key={p._id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted"
                        >
                          <div className={`flex size-4 items-center justify-center rounded border transition-colors ${selectedIds.includes(p._id) ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                            {selectedIds.includes(p._id) && <Check className="size-3 text-white" />}
                          </div>
                          <input type="checkbox" className="sr-only" checked={selectedIds.includes(p._id)} onChange={() => toggleParcel(p._id)} />
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: PARCEL_COLORS[i % PARCEL_COLORS.length] }} />
                          <span className="truncate text-sm text-foreground">{p.nom}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Indice tabs ── */}
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted p-1">
                {INDICE_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setIndice(opt.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${indice === opt.key ? "bg-card shadow-sm text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* ── Quick presets ── */}
              <div className="flex items-center gap-1">
                {[{ l: "30j", d: 30 }, { l: "3M", d: 90 }, { l: "6M", d: 180 }, { l: "1A", d: 365 }].map(p => (
                  <button
                    key={p.l}
                    onClick={() => setDateRange(preset(p.d))}
                    className="rounded border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    {p.l}
                  </button>
                ))}
              </div>

              {/* ── Date inputs ── */}
              <div className="flex items-center gap-1">
                <input type="date" value={dateRange.debut} onChange={e => setDateRange(p => ({ ...p, debut: e.target.value }))} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground shadow-sm" />
                <span className="text-muted-foreground text-xs">—</span>
                <input type="date" value={dateRange.fin}   onChange={e => setDateRange(p => ({ ...p, fin:   e.target.value }))} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground shadow-sm" />
              </div>

              <button
                onClick={handleExportCSV}
                disabled={loading || results.length === 0}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="size-4 mt-0.5" />
                Exporter CSV
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-8">

          {/* ── KPI Cards ── */}
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={<Leaf className="text-emerald-500 size-5" />}
              bg="bg-emerald-50"
              title={`${currentIndice.label} Moyen Global`}
              value={kpis ? kpis.globalAvg.toFixed(3) : null}
              loading={loading}
              badge={kpis
                ? kpis.globalAvg >= thresh.good
                  ? <StatusChip color="emerald">Optimal</StatusChip>
                  : kpis.globalAvg >= thresh.vigilance
                    ? <StatusChip color="amber">Vigilance</StatusChip>
                    : <StatusChip color="red">Critique</StatusChip>
                : null}
            />
            <KpiCard
              icon={<Droplets className="text-blue-500 size-5" />}
              bg="bg-blue-50"
              title="NDWI Moyen Global"
              value={kpis?.ndwiAvg != null ? kpis.ndwiAvg.toFixed(3) : null}
              loading={loading}
              badge={kpis?.ndwiAvg != null
                ? kpis.ndwiAvg < THRESHOLDS.ndwi.critical
                  ? <StatusChip color="red">Stress hydrique</StatusChip>
                  : kpis.ndwiAvg < THRESHOLDS.ndwi.vigilance
                    ? <StatusChip color="amber">Surveiller</StatusChip>
                    : null
                : null}
            />
            <KpiCard
              icon={<Trophy className="text-amber-500 size-5" />}
              bg="bg-amber-50"
              title="Meilleure Parcelle"
              value={kpis?.best.nom ?? null}
              sub={kpis ? `${currentIndice.label} ${kpis.best.avg.toFixed(3)}` : null}
              loading={loading}
              badge={null}
            />
            <KpiCard
              icon={<AlertTriangle className="text-red-500 size-5" />}
              bg="bg-red-50"
              title="Parcelle en Stress"
              value={kpis?.worst.nom ?? null}
              sub={kpis ? `${currentIndice.label} ${kpis.worst.avg.toFixed(3)}` : null}
              loading={loading}
              badge={kpis && kpis.worst.avg < thresh.critical
                ? <StatusChip color="red">Critique</StatusChip>
                : null}
            />
          </section>

          {/* ── Chart + Table ── */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">

            {/* Chart */}
            <Card className="xl:col-span-3 border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Évolution temporelle — {currentIndice.label}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{currentIndice.description} · Sentinel-2 GEE</p>
                </div>
                {loading && <Loader2 className="size-4 animate-spin text-slate-400 shrink-0" />}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-80 w-full rounded-lg" />
                ) : chartData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Leaf className="size-10 text-muted-foreground opacity-50" />
                    <p className="text-sm">Aucune donnée pour la période sélectionnée.</p>
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "currentColor" }} tickFormatter={fmtDate} stroke="currentColor" opacity={0.3} />
                        <YAxis domain={[-0.1, 1]} tick={{ fontSize: 10, fill: "currentColor" }} stroke="currentColor" opacity={0.3} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                          formatter={(value: number, key: string) => {
                            const r = results.find(r => r.parcelleId === key);
                            return [typeof value === "number" ? value.toFixed(3) : "—", r?.nom ?? key];
                          }}
                        />
                        <Legend
                          formatter={key => results.find(r => r.parcelleId === key)?.nom ?? key}
                          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        />
                        <ReferenceLine y={thresh.critical}  stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "Critique",  fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
                        <ReferenceLine y={thresh.vigilance} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "Vigilance", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }} />
                        <ReferenceLine y={thresh.good}      stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "Optimal",   fill: "#22c55e", fontSize: 10, position: "insideTopRight" }} />
                        {results.map((r, i) => (
                          <Line
                            key={r.parcelleId}
                            type="monotone"
                            dataKey={r.parcelleId}
                            stroke={PARCEL_COLORS[i % PARCEL_COLORS.length]}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: PARCEL_COLORS[i % PARCEL_COLORS.length] }}
                            activeDot={{ r: 5 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparison table */}
            <Card className="xl:col-span-2 border-border shadow-sm flex flex-col">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-base font-bold text-foreground">Tableau comparatif</CardTitle>
                <p className="text-xs text-muted-foreground">Dernière capture Sentinel-2</p>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto">
                {loading ? (
                  <div className="p-4"><Skeleton className="h-48 w-full" /></div>
                ) : results.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-slate-400 px-6 text-center">
                    Sélectionnez des parcelles pour afficher la comparaison
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3 text-left">Parcelle</th>
                        <th className="px-3 py-3 text-right">NDVI</th>
                        <th className="px-3 py-3 text-right">NDWI</th>
                        <th className="px-3 py-3 text-right">SAVI</th>
                        <th className="px-4 py-3 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {results.map((r, i) => {
                        const last = r.series.length ? r.series[r.series.length - 1] : null;
                        const ndvi = last?.ndvi ?? null;
                        const status = r.status ?? (ndvi == null ? null : ndvi >= 0.6 ? "ok" : ndvi >= 0.3 ? "warning" : "critical");
                        return (
                          <tr key={r.parcelleId} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PARCEL_COLORS[i % PARCEL_COLORS.length] }} />
                                <span className="font-medium text-foreground truncate max-w-[90px]">{r.nom}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-muted-foreground">{last?.ndvi != null ? last.ndvi.toFixed(3) : "—"}</td>
                            <td className="px-3 py-3 text-right font-mono text-muted-foreground">{last?.ndwi != null ? last.ndwi.toFixed(3) : "—"}</td>
                            <td className="px-3 py-3 text-right font-mono text-muted-foreground">{last?.savi != null ? last.savi.toFixed(3) : "—"}</td>
                            <td className="px-4 py-3 text-right">
                              {status === "ok"       && <StatusChip color="emerald">Optimal</StatusChip>}
                              {status === "warning"  && <StatusChip color="amber">Vigilance</StatusChip>}
                              {status === "critical" && <StatusChip color="red">Critique</StatusChip>}
                              {!status               && <span className="text-slate-400 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          </section>

          {/* ── Interpretation zone ── */}
          {!loading && kpis && (
            <section>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                      <Leaf className="size-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">Analyse automatique</p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Sur la période sélectionnée, le {currentIndice.label} moyen de vos parcelles est{" "}
                        <strong>{kpis.globalAvg.toFixed(3)}</strong>{" "}
                        ({kpis.globalAvg >= thresh.good ? "niveau optimal" : kpis.globalAvg >= thresh.vigilance ? "niveau de vigilance" : "niveau critique"}).
                        La meilleure parcelle est <strong>{kpis.best.nom}</strong> ({currentIndice.label} {kpis.best.avg.toFixed(3)}).
                        {kpis.worst.avg < thresh.vigilance && (
                          <> La parcelle <strong>{kpis.worst.nom}</strong> ({currentIndice.label} {kpis.worst.avg.toFixed(3)}) nécessite une attention particulière.</>
                        )}
                        {kpis.ndwiAvg != null && kpis.ndwiAvg < THRESHOLDS.ndwi.vigilance && (
                          <> Le NDWI global ({kpis.ndwiAvg.toFixed(3)}) indique un risque de stress hydrique — envisager une irrigation.</>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

        </div>
      </main>
    </div>
  );
};

/* ─── sub-components ──────────────────────────────────────── */

const StatusChip = ({ color, children }: { color: "emerald" | "amber" | "red"; children: ReactNode }) => {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber:   "bg-amber-50 text-amber-700",
    red:     "bg-red-50 text-red-700",
  }[color];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
};

const KpiCard = ({
  icon, bg, title, value, sub, loading, badge,
}: {
  icon: ReactNode;
  bg: string;
  title: string;
  value: string | null;
  sub?: string | null;
  loading: boolean;
  badge: ReactNode;
}) => (
  <Card className="border-border shadow-sm">
    <CardContent className="flex flex-col gap-4 p-5">
      <div className={`flex size-10 items-center justify-center rounded-md ${bg} dark:bg-opacity-20`}>{icon}</div>
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground truncate">{value ?? "—"}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {badge && <div className="mt-2">{badge}</div>}
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

export default IndicesPage;
