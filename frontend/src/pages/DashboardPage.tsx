import { useEffect, useState, type ReactNode } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { Droplets, Sprout, Siren, Activity, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { PlatformSidebar } from "@/components/PlatformSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi, parcellesApi, getParcelleSeries, alertsApi, type DashboardStats } from "@/features/parcelles/api";
import type { Parcelle, AnalyticsPoint, AlertItem } from "@/features/parcelles/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

interface SerieData { date: string; ndvi: number | null; ndwi: number | null; }
interface DistData { name: string; value: number; }

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null);
  const [serie, setSerie] = useState<AnalyticsPoint[]>([]);
  const [statusDist, setStatusDist] = useState<DistData[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [serieLoading, setSerieLoading] = useState(false);
  const [activeChartIndices, setActiveChartIndices] = useState<"standard" | "advanced">("standard");

  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    return { debut: formatDateInput(start), fin: formatDateInput(end) };
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      dashboardApi.stats(),
      dashboardApi.statusDistribution(),
      alertsApi.list({ limit: 5 }),
      parcellesApi.list()
    ]).then(([statsData, statusData, alertsData, parcellesData]) => {
      if (!cancelled) {
        setStats(statsData);
        setStatusDist(statusData);
        setAlerts(alertsData);
        setParcelles(parcellesData);
        if (parcellesData.length > 0 && !selectedParcelleId) {
          setSelectedParcelleId(parcellesData[0]._id);
        }
      }
    }).catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedParcelleId) return;
    let cancelled = false;
    setSerieLoading(true);
    getParcelleSeries(selectedParcelleId, dateRange.debut, dateRange.fin)
      .then((data) => {
        if (!cancelled) setSerie(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setSerieLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedParcelleId, dateRange.debut, dateRange.fin]);

  const barChartData = {
    labels: serie.map(s => s.date),
    datasets: activeChartIndices === "standard" ? [
      {
        label: "NDVI",
        data: serie.map(s => s.ndvi),
        backgroundColor: "#10b981",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8
      },
      {
        label: "NDWI",
        data: serie.map(s => s.ndwi),
        backgroundColor: "#3b82f6",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8
      }
    ] : [
      {
        label: "SAVI",
        data: serie.map((s: any) => s.savi),
        backgroundColor: "#f59e0b",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8
      },
      {
        label: "GNDVI",
        data: serie.map((s: any) => s.gndvi),
        backgroundColor: "#8b5cf6",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const, 
        align: "end" as const, 
        labels: { 
          usePointStyle: true, 
          boxWidth: 8, 
          color: "hsl(var(--muted-foreground))",
          font: { family: "Inter, sans-serif", size: 11 }
        } 
      },
      tooltip: {
        backgroundColor: "hsl(var(--card))",
        titleColor: "hsl(var(--foreground))",
        bodyColor: "hsl(var(--muted-foreground))",
        borderColor: "hsl(var(--border))",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      y: { 
        min: 0, 
        max: 1, 
        border: { display: false }, 
        grid: { color: "hsl(var(--border) / 0.5)" }, 
        ticks: { color: "hsl(var(--muted-foreground))", font: { size: 10 } } 
      },
      x: { 
        border: { display: false }, 
        grid: { display: false }, 
        ticks: { color: "hsl(var(--muted-foreground))", font: { size: 10 } } 
      }
    }
  };

  // Status colors: Saines (green), Modérées (orange), Stress (red)
  const statusColors: Record<string, string> = {
    "Saines": "#10b981",
    "Modérées": "#f59e0b",
    "Stress": "#ef4444",
    "Donnée non disponible": "#cbd5e1"
  };

  const donutChartData = {
    labels: statusDist.map(d => d.name || "Donnée non disponible"),
    datasets: [
      {
        data: statusDist.map(d => d.value),
        backgroundColor: statusDist.map(d => statusColors[d.name || "Donnée non disponible"] || "#cbd5e1"),
        borderWidth: 0,
        hoverOffset: 4,
        borderRadius: 2
      }
    ]
  };

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "80%",
    plugins: {
      legend: { display: false }
    }
  };

  const formatTrend = (trend?: number, isInverseGood = false) => {
    if (trend == null || isNaN(trend)) return null;
    const isPositive = trend > 0;
    const isGood = isInverseGood ? !isPositive : isPositive;
    const colorClass = isGood ? "text-emerald-500" : "text-red-500";
    const IconClass = isPositive ? "fi fi-rr-arrow-trend-up" : "fi fi-rr-arrow-trend-down";
    const absValue = Math.abs(trend);
    const text = Number.isInteger(absValue) ? absValue.toString() : absValue.toFixed(1) + "%";

    return (
      <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isGood ? 'bg-emerald-500/10' : 'bg-red-500/10'} ${colorClass}`}>
        <i className={`${IconClass} mr-1 mt-0.5`} />
        {isPositive ? "+" : "-"}{text}
      </span>
    );
  };

  const wilayaColors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#64748b"];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <PlatformSidebar />
      <main className="flex-1 space-y-8 overflow-y-auto p-8 scroll-smooth">
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h2>
            <p className="text-muted-foreground">Vue d'ensemble de vos parcelles et indices de santé.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
            <Calendar className="size-3.5" />
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Total parcelles"
            icon={<i className="fi fi-rr-leaf text-emerald-500" />}
            iconBg="bg-emerald-500/10"
            value={loading ? null : `${stats?.activeParcelles ?? 0}`}
            trend={formatTrend(stats?.trendParcelles)}
            loading={loading}
          />
          <KpiCard
            title="NDVI moyen global"
            icon={<i className="fi fi-rr-stats text-emerald-500" />}
            iconBg="bg-emerald-500/10"
            value={loading ? null : stats?.ndviGlobalAvg ? stats.ndviGlobalAvg.toFixed(2) : "—"}
            trend={formatTrend(stats?.trendNdvi)}
            loading={loading}
          />
          <KpiCard
            title="Stress hydrique"
            icon={<i className="fi fi-rr-raindrops text-amber-500" />}
            iconBg="bg-amber-500/10"
            value={loading ? null : `${stats?.stressHydriqueCount ?? 0}`}
            trend={formatTrend(stats?.trendStressHydrique, true)}
            loading={loading}
          />
          <KpiCard
            title="Alertes actives"
            icon={<i className="fi fi-rr-bell text-red-500" />}
            iconBg="bg-red-500/10"
            value={loading ? null : `${stats?.activeAlertsCount ?? 0}`}
            trend={formatTrend(stats?.trendAlerts, true)}
            loading={loading}
          />
        </section>

        {/* Charts & Analysis */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 border-border shadow-soft bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Évolution des indices satellitaires</CardTitle>
                <p className="text-xs text-muted-foreground">Données historiques basées sur l'imagerie Sentinel-2</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  value={selectedParcelleId ?? ""}
                  onChange={(event) => setSelectedParcelleId(event.target.value)}
                >
                  {parcelles.map((parcelle) => (
                    <option key={parcelle._id} value={parcelle._id}>
                      {parcelle.nom}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                    value={dateRange.debut}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, debut: event.target.value }))}
                  />
                  <span className="text-muted-foreground mx-1">-</span>
                  <input
                    type="date"
                    className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                    value={dateRange.fin}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, fin: event.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => setActiveChartIndices("standard")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeChartIndices === "standard" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Standard (NDVI/NDWI)
                  </button>
                  <button
                    onClick={() => setActiveChartIndices("advanced")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeChartIndices === "advanced" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Avancé (SAVI/GNDVI)
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[350px] w-full">
                {serieLoading ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted/20 rounded-xl">
                    <Activity className="size-10 text-primary animate-pulse" />
                  </div>
                ) : (
                  <Bar data={barChartData} options={barChartOptions} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analytical Indicators */}
          <Card className="border-border shadow-soft bg-card/50 backdrop-blur-sm flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Analyse de la parcelle</CardTitle>
              <p className="text-xs text-muted-foreground">Indicateurs de santé avancés</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedParcelleId && parcelles.find(p => p._id === selectedParcelleId) && (
                <>
                  <div className="space-y-4">
                    <AnalysisItem 
                      label="SAVI (Vigueur corrigée)" 
                      value={parcelles.find(p => p._id === selectedParcelleId)?.saviMoyen} 
                      description="Corrige l'influence du sol nu. Crucial pour les zones arides."
                      status={ (parcelles.find(p => p._id === selectedParcelleId)?.saviMoyen ?? 0) < 0.2 ? 'critical' : 'ok' }
                    />
                    <AnalysisItem 
                      label="GNDVI (Chlorophylle)" 
                      value={parcelles.find(p => p._id === selectedParcelleId)?.gndviMoyen} 
                      description="Mesure l'état nutritionnel et la photosynthèse."
                      status={ (parcelles.find(p => p._id === selectedParcelleId)?.gndviMoyen ?? 0) < 0.3 ? 'warning' : 'ok' }
                    />
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                      <Siren className="size-3" /> Observation Auto
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      { (parcelles.find(p => p._id === selectedParcelleId)?.saviMoyen ?? 0) < 0.2 
                        ? "Attention : La faible valeur SAVI suggère un sol très exposé ou un stress sévère en zone semi-aride."
                        : (parcelles.find(p => p._id === selectedParcelleId)?.gndviMoyen ?? 0) < 0.3
                        ? "Anomalie : Le GNDVI bas indique une possible carence en azote ou un stress chlorophyllien."
                        : "État Stable : Les indices de vigueur et de chlorophylle sont dans les normes pour cette culture."
                      }
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Bottom Charts */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Donut Chart */}
          <Card className="lg:col-span-2 border-border shadow-soft bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Statut des parcelles</CardTitle>
              <p className="text-xs text-muted-foreground">Répartition par niveau de santé</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
                <div className="relative h-44 w-44 shrink-0">
                  {loading ? (
                    <Skeleton className="h-full w-full rounded-full" />
                  ) : (
                    <>
                      <Doughnut data={donutChartData} options={donutChartOptions} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-foreground">{stats?.activeParcelles ?? 0}</span>
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold">Total</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex-1 w-full space-y-3">
                  {loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    statusDist.map(item => {
                      const total = statusDist.reduce((acc, curr) => acc + curr.value, 0);
                      const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                      const displayName = item.name || "Donnée non disponible";
                      return (
                        <div key={displayName} className="group flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="inline-block size-3 rounded-full shadow-sm" style={{ backgroundColor: statusColors[item.name] || statusColors[displayName] || "#cbd5e1" }} />
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{displayName}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground/60">{item.value} parc.</span>
                            <span className="text-sm font-bold text-foreground">{percent}%</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card className="lg:col-span-3 border-border shadow-soft bg-card/50 backdrop-blur-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Alertes récentes</CardTitle>
                <p className="text-xs text-muted-foreground">Anomalies détectées sur les 7 derniers jours</p>
              </div>
              <button className="text-xs font-semibold text-primary hover:underline">Voir tout</button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[350px] scrollbar-thin">
              <div className="space-y-1">
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                      <Activity className="size-6 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Aucune alerte</p>
                    <p className="text-xs text-muted-foreground">Toutes vos parcelles semblent en bonne santé.</p>
                  </div>
                ) : (
                  alerts.slice(0, 10).map((alert) => (
                    <div key={alert._id} className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all">
                      <div className="flex items-start gap-4">
                        <div className={`mt-0.5 rounded-lg p-2 shadow-sm ${
                          alert.type === "Santé" || alert.type === "Stress Hydrique" 
                            ? "bg-red-500/10 text-red-500" 
                            : "bg-amber-500/10 text-amber-500"
                        }`}>
                          <Siren className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{alert.parcelleId.nom}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className={alert.type === "Santé" || alert.type === "Stress Hydrique" ? "text-red-500/80 font-medium" : "text-amber-500/80 font-medium"}>
                              {alert.type}
                            </span>
                            • 
                            <span>{new Date(alert.date).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex flex-col items-end">
                           <span className="text-xs font-bold text-foreground">
                            {alert.valeurIndice?.toFixed(2) ?? "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">NDVI</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
};

const KpiCard = ({
  title,
  icon,
  iconBg,
  value,
  trend,
  loading,
}: {
  title: string;
  icon: ReactNode;
  iconBg: string;
  value: string | null;
  trend: ReactNode;
  loading: boolean;
}) => (
  <Card className="border-border shadow-soft overflow-hidden group hover:shadow-md transition-all duration-300 bg-card/50 backdrop-blur-sm">
    <CardContent className="p-6 flex flex-col justify-between h-full space-y-4 relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
      <div className={`flex size-12 items-center justify-center rounded-xl ${iconBg} shadow-sm group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="flex items-center justify-between gap-3">
          {loading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <span className="text-3xl font-black text-foreground tracking-tight">{value ?? "—"}</span>
          )}
          {!loading && trend && <div>{trend}</div>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const AnalysisItem = ({ label, value, description, status }: { label: string, value?: number, description: string, status: 'ok' | 'warning' | 'critical' }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-foreground">{label}</span>
      <span className={`text-xs font-black ${status === 'critical' ? 'text-red-500' : status === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`}>
        {value?.toFixed(3) ?? '—'}
      </span>
    </div>
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-500 ${status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} 
        style={{ width: `${(value ?? 0) * 100}%` }}
      />
    </div>
    <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
  </div>
);

export default DashboardPage;
