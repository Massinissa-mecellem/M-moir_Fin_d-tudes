import { useRef, useState } from "react";
import {
  X,
  Calendar,
  Sprout,
  Droplets,
  Leaf,
  Loader2,
  MapPin,
  Download,
  Camera,
  FileSpreadsheet,
  CloudRain,
  Wind,
  ThermometerSun,
  CloudSun,
  Waves,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "./StatusBadge";
import { NdviChart } from "./NdviChart";
import { formatDate, formatHa, formatNumber, polygonAreaHa } from "./utils";
import type { ParcelleDetails, ParcelleMeteo } from "./types";
import { downloadParcelleCsv, downloadParcellePdf, PANEL_PDF_CHART_ID } from "./exportReports";
import { YieldEstimation } from "./YieldEstimation";

interface Props {
  details: ParcelleDetails | null;
  loading: boolean;
  onClose: () => void;
  meteo?: ParcelleMeteo | null;
}

const getWeatherIcon = (precipMm: number | null | undefined, tempMax: number | null | undefined) => {
  if ((precipMm ?? 0) >= 2) return <CloudRain className="size-3.5 text-sky-600" />;
  if ((tempMax ?? 0) >= 32) return <ThermometerSun className="size-3.5 text-amber-500" />;
  return <CloudSun className="size-3.5 text-emerald-600" />;
};

export const ParcelleDetailsPanel = ({ details, loading, onClose, meteo }: Props) => {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!details && !loading) return null;

  const ndviAvg = details?.analytics?.length
    ? details.analytics.reduce((s, d) => s + (d.ndvi ?? 0), 0) /
      details.analytics.filter((d) => d.ndvi != null).length
    : details?.info.ndviMoyen;
  const ndwiAvg = details?.analytics?.length
    ? details.analytics.reduce((s, d) => s + (d.ndwi ?? 0), 0) /
      details.analytics.filter((d) => d.ndwi != null).length
    : details?.info.ndwiMoyen;
  const saviAvg = details?.analytics?.length
    ? details.analytics.reduce((s, d) => s + (d.savi ?? 0), 0) /
      details.analytics.filter((d) => d.savi != null).length
    : details?.info.saviMoyen;
  const gndviAvg = details?.analytics?.length
    ? details.analytics.reduce((s, d) => s + (d.gndvi ?? 0), 0) /
      details.analytics.filter((d) => d.gndvi != null).length
    : details?.info.gndviMoyen;

  const surface = details?.info.surface ?? (details ? polygonAreaHa(details.info.geometry) : 0);
  const periodText = details?.info.datePlantation 
    ? `Depuis le ${formatDate(details.info.datePlantation)}` 
    : "6 derniers mois";

  const lastCaptureDate = details?.analytics?.length
    ? details.analytics[details.analytics.length - 1].date
    : details?.latestSentinelImageDate
      ?? details?.info.lastAnalyzedCaptureDate
      ?? null;

  const handleDownloadPdf = async () => {
    if (!details) return;
    try {
      setIsExporting(true);
      await downloadParcellePdf(details, PANEL_PDF_CHART_ID);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (!details) return;
    downloadParcelleCsv(details);
  };

  return (
    <aside className="absolute right-4 top-4 bottom-4 z-[500] flex w-[400px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-panel animate-fade-in-up">
      {loading && !details ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : details ? (
        <>
          <div ref={panelRef} className="flex h-full w-full flex-col bg-card">
            {/* Header */}
            <div className="relative bg-gradient-primary px-5 py-5 text-primary-foreground">
              <div className="absolute right-3 top-3 flex items-center gap-1 pdf-exclude">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleExportCsv}
                  disabled={!details?.analytics?.length || isExporting}
                  title="Exporter la série temporelle en CSV"
                  className="size-7 text-primary-foreground hover:bg-white/20"
                >
                  <FileSpreadsheet className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                  title="Télécharger le rapport PDF"
                  className="size-7 text-primary-foreground hover:bg-white/20"
                >
                  {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  className="size-7 text-primary-foreground hover:bg-white/20"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs opacity-90">
              <MapPin className="size-3.5" />
              Parcelle agricole
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{details.info.nom}</h2>
            <div className="mt-3">
                <StatusBadge
                  ndvi={ndviAvg}
                  size="sm"
                  className="border-white/30 bg-white/20 text-white"
                />
              </div>
            </div>

          <ScrollArea className="flex-1">
            <div className="space-y-5 p-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoTile
                  icon={<Calendar className="size-4" />}
                  label="Créée le"
                  value={formatDate(details.info.createdAt)}
                />
                <InfoTile
                  icon={<Sprout className="size-4" />}
                  label="Culture"
                  value={details.info.cultureType ?? "—"}
                />
                <InfoTile
                  icon={<MapPin className="size-4" />}
                  label="Surface"
                  value={formatHa(surface)}
                />
                <InfoTile
                  icon={<Sprout className="size-4" />}
                  label="Propriétaire"
                  value={details.info.proprietaire}
                />
                <InfoTile
                  icon={<Camera className="size-4" />}
                  label="Dernière Image S2"
                  value={lastCaptureDate ? formatDate(lastCaptureDate) : "—"}
                />
              </div>

              <Separator />

              {/* Modélisation de Cycle Phénologique ou Arboriculture */}
              {details.info.phenology && (
                <div className="rounded-xl border border-border bg-gradient-to-br from-background via-background to-emerald-500/[0.03] p-4 shadow-sm animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-3">
                    <Sprout className="size-4 text-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {details.info.phenology.isTree ? "Modélisation Arboriculture" : "Cycle Phénologique Actif"}
                    </span>
                  </div>

                  {details.info.phenology.isTree ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs border-b pb-2 border-border/60">
                        <span className="text-muted-foreground">Âge du verger</span>
                        <span className="font-semibold text-foreground">{details.info.phenology.meta?.ageLabel ?? `${details.info.cultureAgeYears} ans`}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-b pb-2 border-border/60">
                        <span className="text-muted-foreground">Densité de plantation</span>
                        <span className="font-semibold text-foreground">{details.info.phenology.meta?.densityLabel ?? `${details.info.treeDensity} arbres/ha`}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-b pb-2 border-border/60">
                        <span className="text-muted-foreground">Saison phénologique</span>
                        <span className="font-semibold text-primary">{details.info.phenology.meta?.seasonLabel ?? details.info.phenology.stageLabel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                        {details.info.phenology.description}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Progress track */}
                      <div className="relative pt-2 pb-6">
                        <div className="absolute left-0 right-0 top-4 h-1 bg-secondary rounded-full">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500" 
                            style={{ width: `${details.info.phenology.progressPercent}%` }} 
                          />
                        </div>
                        
                        {/* Nodes for each of the 5 standard stages */}
                        <div className="absolute left-0 right-0 top-2 flex justify-between px-1 pointer-events-none">
                          {["germination", "vegetative", "flowering", "maturation", "harvest"].map((stg, i) => {
                            const isActive = details.info.phenology?.currentStage === stg;
                            const isPast = ["germination", "vegetative", "flowering", "maturation", "harvest"].indexOf(details.info.phenology?.currentStage ?? "") >= i;
                            
                            return (
                              <div key={stg} className="flex flex-col items-center relative">
                                <div 
                                  className={`size-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isActive 
                                      ? 'bg-emerald-500 border-primary scale-125 shadow-md shadow-emerald-500/50' 
                                      : isPast 
                                        ? 'bg-emerald-400 border-emerald-500' 
                                        : 'bg-card border-muted'
                                  }`}
                                >
                                  {isActive && <div className="size-1 bg-white rounded-full" />}
                                </div>
                                <span 
                                  className={`absolute mt-5 text-[8px] font-bold uppercase tracking-wider text-center max-w-[60px] leading-tight ${
                                    isActive ? 'text-primary scale-105' : 'text-muted-foreground opacity-60'
                                  }`}
                                >
                                  {stg === "germination" ? "Germin." : stg === "vegetative" ? "Végét." : stg === "flowering" ? "Floraison" : stg === "maturation" ? "Matur." : "Récolte"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 text-xs leading-relaxed text-muted-foreground border-t border-border/60 mt-3">
                        <span className="font-semibold text-foreground">{details.info.phenology.stageLabel} : </span>
                        {details.info.phenology.description}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Indices */}
              <div>
                <h3 className="mb-3 text-sm font-semibold tracking-tight">
                  Indices spectraux moyens
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <IndexCard
                    label="NDVI"
                    value={formatNumber(ndviAvg, 3)}
                    sub="Végétation"
                    icon={<i className="fi fi-rr-leaf" />}
                    accent="ndvi"
                  />
                  <IndexCard
                    label="NDWI"
                    value={formatNumber(ndwiAvg, 3)}
                    sub="Eau / humidité"
                    icon={<i className="fi fi-rr-raindrops" />}
                    accent="ndwi"
                  />
                  <IndexCard
                    label="SAVI"
                    value={formatNumber(saviAvg, 3)}
                    sub="Sol aride"
                    icon={<i className="fi fi-rr-sprout" />}
                    accent="savi"
                  />
                  <IndexCard
                    label="GNDVI"
                    value={formatNumber(gndviAvg, 3)}
                    sub="Chlorophylle"
                    icon={<i className="fi fi-rr-waves" />}
                    accent="gndvi"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-3 text-sm font-semibold tracking-tight">Météo opérationnelle</h3>
                {meteo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoTile
                        icon={<CloudRain className="size-4 text-sky-600" />}
                        label="Pluie 7 jours"
                        value={`${meteo.rainfallLast7DaysMm.toFixed(1)} mm`}
                      />
                      <InfoTile
                        icon={<ThermometerSun className="size-4 text-amber-500" />}
                        label="ETP (jour)"
                        value={meteo.currentDay?.etp != null ? `${meteo.currentDay.etp.toFixed(1)} mm/j` : "—"}
                      />
                      <InfoTile
                        icon={<Waves className="size-4 text-cyan-600" />}
                        label="Humidité (jour)"
                        value={meteo.currentDay?.humidity != null ? `${meteo.currentDay.humidity.toFixed(0)} %` : "—"}
                      />
                      <InfoTile
                        icon={<Wind className="size-4 text-slate-600" />}
                        label="Vent (jour)"
                        value={
                          meteo.currentDay?.windSpeed != null
                            ? `${meteo.currentDay.windSpeed.toFixed(1)} km/h ${meteo.currentDay.windDirection ?? ""}`.trim()
                            : "—"
                        }
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-gradient-to-br from-background via-background to-sky-50/60 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Températures min/max (J0 + 5 jours)
                      </p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {[meteo.currentDay, ...meteo.next5Days].filter(Boolean).map((day) => (
                          <div key={day!.date} className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              {getWeatherIcon(day!.precipMm, day!.tempMax)}
                              {formatDate(day!.date)}
                            </span>
                            <span className="font-medium text-foreground">
                              {day!.tempMin != null ? `${day!.tempMin.toFixed(1)}°` : "—"} / {day!.tempMax != null ? `${day!.tempMax.toFixed(1)}°` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Données météo indisponibles pour le moment.</p>
                )}
              </div>

              <Separator />

              {/* Chart */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Évolution temporelle
                  </h3>
                  <span className="text-xs text-muted-foreground">{periodText}</span>
                </div>
                <div id={PANEL_PDF_CHART_ID} className="bg-card pb-2">
                  <NdviChart data={details.analytics ?? []} />
                </div>
              </div>

              {/* Estimation du Rendement Agricole */}
              {details.info.cultureType && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 text-sm font-semibold tracking-tight">
                      Estimation du rendement
                    </h3>
                    <YieldEstimation
                      ndvi={ndviAvg}
                      ndwi={ndwiAvg}
                      surface={surface}
                      culture={details.info.cultureType}
                      stade={details.info.phenology?.currentStage ?? details.info.cultureEstimatedStage ?? ""}
                    />
                  </div>
                </>
              )}

              <Separator />

              {/* Diagnostic Agronomique */}
              {details.info.diagnostic ? (
                <div className={`rounded-xl border p-4 text-xs leading-relaxed shadow-sm transition-all duration-300 ${
                  details.info.diagnostic.status === 'critical'
                    ? 'border-red-500/20 bg-red-500/[0.03] text-red-900 dark:text-red-200 animate-pulse'
                    : details.info.diagnostic.status === 'warning'
                      ? 'border-amber-500/20 bg-amber-500/[0.03] text-amber-900 dark:text-amber-200'
                      : 'border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-900 dark:text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between mb-3 border-b pb-2 border-current/10">
                    <div className="flex items-center gap-1.5">
                      <div className={`size-2.5 rounded-full ${
                        details.info.diagnostic.status === 'critical'
                          ? 'bg-red-500 animate-ping'
                          : details.info.diagnostic.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`} />
                      <strong className="font-bold uppercase tracking-wider text-[10px]">
                        Diagnostic Agronomique
                      </strong>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                      details.info.diagnostic.status === 'critical'
                        ? 'bg-red-500/10 text-red-500'
                        : details.info.diagnostic.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {details.info.diagnostic.statusLabel}
                    </span>
                  </div>

                  <p className="font-medium text-foreground mb-3">
                    {details.info.diagnostic.text}
                  </p>

                  {details.info.phenology?.advice && (
                    <div className="rounded-lg bg-card/60 p-2.5 border border-current/5 space-y-1 mt-2 text-muted-foreground">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-foreground">Conseil de saison</div>
                      <p className="text-[11px] leading-relaxed">{details.info.phenology.advice}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="size-2 rounded-full bg-primary animate-pulse" />
                     <strong className="font-bold text-foreground uppercase tracking-wider text-[10px]">Analyse de vigueur</strong>
                  </div>
                  <div className="space-y-2">
                    <p>
                      {(() => {
                        const ndvi = ndviAvg ?? 0;
                        const ndwi = ndwiAvg ?? 0;
                        const name = details.info.nom;
                        const culture = details.info.cultureType?.toLowerCase() || "la culture";
                        
                        if (ndvi === 0 && ndwi === 0) return "En attente de données satellitaires pour cette parcelle.";
                        
                        let analysis = `Sur la base des dernières données, **${name}** montre `;
                        
                        if (ndvi > 0.6) {
                          analysis += `une végétation très dense et vigoureuse pour ${culture}. `;
                        } else if (ndvi > 0.4) {
                          analysis += `une vigueur satisfaisante, typique d'un stade de croissance actif. `;
                        } else if (ndvi > 0.2) {
                          analysis += `une activité chlorophyllienne modérée, ce qui peut indiquer une levée précoce ou un léger ralentissement de croissance. `;
                        } else {
                          analysis += `un indice de vigueur faible (NDVI < 0.2). `;
                        }

                        if (ndwi < 0.1) {
                          analysis += `Attention : un stress hydrique est détecté (NDWI faible), une irrigation d'appoint est recommandée. `;
                        } else if (ndwi > 0.3) {
                          analysis += `Le taux d'humidité foliaire est optimal. `;
                        }

                        if (saviAvg && saviAvg < 0.15) {
                          analysis += `Le sol semble très exposé, surveillez l'érosion ou le manque de couverture végétale. `;
                        }

                        return analysis;
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-card/80 backdrop-blur-sm sticky bottom-0 z-20">
            <Button
              onClick={() => navigate("/conseils", { state: { parcelId: details.info._id } })}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 h-11 text-sm transition-all hover:scale-[1.01] active:scale-95"
            >
              <MessageSquare className="size-4 mr-2" />
              Consulter un conseil
            </Button>
          </div>
          </div>
        </>
      ) : null}
    </aside>
  );
};

const InfoTile = ({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-background/50 p-3">
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
  </div>
);

const IndexCard = ({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub: string; icon: React.ReactNode; accent: string;
}) => {
  const getAccentStyles = () => {
    switch (accent) {
      case "ndvi": return "border-emerald-500/20 bg-emerald-500/5 text-emerald-500";
      case "ndwi": return "border-blue-500/20 bg-blue-500/5 text-blue-500";
      case "savi": return "border-orange-500/20 bg-orange-500/5 text-orange-500";
      case "gndvi": return "border-purple-500/20 bg-purple-500/5 text-purple-500";
      default: return "border-border bg-muted/5 text-foreground";
    }
  };
  const styles = getAccentStyles();
  
  return (
    <div className={`rounded-lg border p-3 ${styles.split(' ').slice(0, 2).join(' ')}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${styles.split(' ').pop()}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
};
