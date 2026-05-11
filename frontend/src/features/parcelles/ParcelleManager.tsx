import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CloudRain, Droplets, Leaf, Waves, Wind, ThermometerSun } from "lucide-react";
import { PlatformSidebar } from "@/components/PlatformSidebar";
import { ParcelleSidebar } from "./ParcelleSidebar";
import { ParcelleMap } from "./ParcelleMap";
import { ParcelleDetailsPanel } from "./ParcelleDetailsPanel";
import { CreateParcelleDialog } from "./CreateParcelleDialog";
import { EditParcelleDialog } from "./EditParcelleDialog";
import { getParcelleMeteo, parcellesApi } from "./api";
import type { Parcelle, ParcelleDetails, ParcelleGeometry, ParcelleMeteo } from "./types";
import { polygonAreaHa } from "./utils";

export const ParcelleManager = () => {
  const navigate = useNavigate();
  const { id: routeParcelleId } = useParams();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ParcelleDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedIndexType, setSelectedIndexType] = useState<string>("ndvi");

  const [drawing, setDrawing] = useState(false);
  const [pendingGeom, setPendingGeom] = useState<ParcelleGeometry | null>(null);
  const [editingParcelle, setEditingParcelle] = useState<Parcelle | null>(null);
  const [meteoByParcelle, setMeteoByParcelle] = useState<Record<string, ParcelleMeteo>>({});
  const selectedMeteo = selectedId ? meteoByParcelle[selectedId] : null;
  const selectedParcelle = selectedId ? parcelles.find((p) => p._id === selectedId) : null;

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await parcellesApi.list();
      setParcelles(data);
    } catch (err: any) {
      toast.error("Impossible de charger les parcelles", {
        description: err?.message ?? "Vérifiez la connexion au backend.",
      });
    } finally {
      setLoadingList(false);
    }
  }, []);

  const handleShowList = () => {
    setShowList(true);
    fetchList();
  };

  useEffect(() => {
    if (!parcelles.length) return;
    let cancelled = false;
    Promise.allSettled(parcelles.map((parcelle) => getParcelleMeteo(parcelle._id)))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, ParcelleMeteo> = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            next[result.value.parcelleId] = result.value;
          }
        });
        setMeteoByParcelle(next);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Météo indisponible", { description: "Certaines données météo n'ont pas pu être chargées." });
        }
      });
    return () => { cancelled = true; };
  }, [parcelles]);

  // Load details on select
  useEffect(() => {
    if (!selectedId) { setDetails(null); return; }
    let cancelled = false;
    setLoadingDetails(true);
    parcellesApi.get(selectedId)
      .then((d) => { if (!cancelled) setDetails(d); })
      .catch((err) => {
        if (!cancelled) toast.error("Erreur de chargement", { description: err?.message });
      })
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (routeParcelleId) {
      setShowList(true);
      setSelectedId(routeParcelleId);
      if (!parcelles.length) fetchList();
    }
  }, [routeParcelleId, parcelles.length, fetchList]);

  const handleCreated = (geom: ParcelleGeometry) => {
    setDrawing(false);
    setPendingGeom(geom);
  };

  const handleConfirmCreate = async (data: { nom: string; cultureType: string; proprietaire: string; datePlantation: string }) => {
    if (!pendingGeom) return;
    try {
      const surface = polygonAreaHa(pendingGeom);
      const res = await parcellesApi.create({
        ...data,
        surface,
        geometry: pendingGeom,
      });
      toast.success("Parcelle créée", { description: "Calcul NDVI / NDWI lancé." });
      setPendingGeom(null);
      if (showList) await fetchList();
      if (res?.info?._id) setSelectedId(res.info._id);
    } catch (err: any) {
      toast.error("Création impossible", { description: err?.response?.data?.error ?? err?.message });
    }
  };

  const handleEdit = async (id: string, data: Partial<Parcelle>) => {
    try {
      await parcellesApi.update(id, data);
      toast.success("Parcelle modifiée");
      setParcelles((prev) => prev.map((p) => (p._id === id ? { ...p, ...data } : p)));
      if (details?.info._id === id) setDetails({ ...details, info: { ...details.info, ...data } });
    } catch (err: any) {
      toast.error("Modification impossible", { description: err?.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await parcellesApi.remove(id);
      toast.success("Parcelle supprimée");
      setParcelles((prev) => prev.filter((p) => p._id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err?.message });
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <PlatformSidebar />
      <ParcelleSidebar
        parcelles={parcelles}
        loading={loadingList}
        selectedId={selectedId}
        drawing={drawing}
        onSelect={setSelectedId}
        onStartDraw={() => setDrawing(true)}
        onCancelDraw={() => setDrawing(false)}
        onRefresh={handleShowList}
        onOpenAlerts={() => navigate("/alertes")}
        showList={showList}
        onEdit={(p) => setEditingParcelle(p)}
        onDelete={handleDelete}
      />

      <main className="relative flex-1">
        <ParcelleMap
          parcelles={parcelles}
          selectedId={selectedId}
          onSelect={setSelectedId}
          drawing={drawing}
          onCreated={handleCreated}
          indexType={selectedIndexType}
          onIndexTypeChange={setSelectedIndexType}
          rainByParcelle={Object.fromEntries(
            Object.entries(meteoByParcelle).map(([id, meteo]) => [
              id,
              { rain7d: meteo.rainfallLast7DaysMm, dryDays: meteo.dryDays },
            ])
          )}
        />

        {/* Top status overlay */}
        <div className="pointer-events-none absolute left-4 top-4 z-[500] flex items-center gap-2">
          {drawing && (
            <div className="pointer-events-auto rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shadow-soft backdrop-blur">
              Mode dessin actif
            </div>
          )}
        </div>

        <div className="absolute bottom-6 left-4 z-[500] flex flex-col gap-3">
          {/* Sélecteur d'indice - Déplacé ici */}
          {selectedId && (
            <div className="flex w-[310px] items-center justify-between p-1 bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-panel pointer-events-auto animate-fade-in-up">
              {[
                { id: 'ndvi', label: 'NDVI', color: 'text-emerald-500' },
                { id: 'ndwi', label: 'NDWI', color: 'text-blue-500' },
                { id: 'savi', label: 'SAVI', color: 'text-orange-500' },
                { id: 'gndvi', label: 'GNDVI', color: 'text-purple-500' }
              ].map((idx) => (
                <button
                  key={idx.id}
                  onClick={() => setSelectedIndexType(idx.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    selectedIndexType === idx.id 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <div className={`size-2 rounded-full ${selectedIndexType === idx.id ? 'bg-current' : idx.color.replace('text-', 'bg-')}`} />
                  {idx.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Box Légende */}
            <div className="w-[310px] rounded-xl border border-border bg-card/95 p-3 text-xs shadow-panel backdrop-blur">
              <div className="mb-2 font-semibold text-foreground">État de la végétation</div>
              <div className="space-y-1.5">
                <LegendItem color="bg-status-good" label="végétation saine et active" />
                <LegendItem color="bg-status-medium" label="végétation modérée ou en debut de cycle" />
                <LegendItem color="bg-status-stressed" label="végétation tres clairsemée,sol nu,stress severe ou fin de cycle" />
              </div>
            </div>

            {/* Box Météo - À droite de la légende */}
            {selectedMeteo && (
              <div className="min-w-[350px] rounded-xl border border-sky-200/60 dark:border-sky-800/60 bg-gradient-to-br from-white/95 via-sky-50/95 to-cyan-50/90 dark:from-slate-900/95 dark:via-sky-950/90 dark:to-cyan-950/80 p-3 text-xs shadow-panel backdrop-blur animate-fade-in-up">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  <CloudRain className="size-3.5" />
                  Météo terrain
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <OverlayMetric
                    icon={<CloudRain className="size-3.5 text-sky-600" />}
                    label="Pluie 7j"
                    value={`${selectedMeteo.rainfallLast7DaysMm.toFixed(1)} mm`}
                  />
                  <OverlayMetric
                    icon={<Droplets className="size-3.5 text-blue-500" />}
                    label="Humidité"
                    value={selectedMeteo.currentDay?.humidity != null ? `${selectedMeteo.currentDay.humidity.toFixed(0)}%` : "—"}
                  />
                  <OverlayMetric
                    icon={<Wind className="size-3.5 text-slate-600" />}
                    label="Vent"
                    value={selectedMeteo.currentDay?.windSpeed != null ? `${selectedMeteo.currentDay.windSpeed.toFixed(0)} km/h` : "—"}
                  />
                  <OverlayMetric
                    icon={<ThermometerSun className="size-3.5 text-orange-500" />}
                    label="Temp"
                    value={selectedMeteo.currentDay?.tempMax != null ? `${selectedMeteo.currentDay.tempMax.toFixed(1)}°C` : "—"}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedId && (
          <ParcelleDetailsPanel
            details={details}
            loading={loadingDetails}
            onClose={() => setSelectedId(null)}
            meteo={selectedId ? (meteoByParcelle[selectedId] ?? null) : null}
          />
        )}
      </main>

      <CreateParcelleDialog
        open={!!pendingGeom}
        geometry={pendingGeom}
        onCancel={() => setPendingGeom(null)}
        onConfirm={handleConfirmCreate}
      />

      <EditParcelleDialog
        open={!!editingParcelle}
        parcelle={editingParcelle}
        onCancel={() => setEditingParcelle(null)}
        onConfirm={handleEdit}
      />
    </div>
  );
};

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-2 text-muted-foreground">
    <span className={`size-2.5 rounded-sm ${color}`} />
    {label}
  </div>
);

const OverlayMetric = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-md border border-white/60 dark:border-white/10 bg-white/70 dark:bg-white/5 px-2.5 py-1.5">
    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {icon}
      {label}
    </div>
    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</div>
  </div>
);
