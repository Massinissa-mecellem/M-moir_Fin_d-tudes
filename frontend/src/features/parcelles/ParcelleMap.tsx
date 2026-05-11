import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Navigation, Target, Search } from "lucide-react";
import { toast } from "sonner";
import "@geoman-io/leaflet-geoman-free";
import { MapContainer, TileLayer, GeoJSON, useMap, CircleMarker, Popup, Circle } from "react-leaflet";
import type { Parcelle, ParcelleGeometry } from "./types";
import { getCropStatus } from "./types";
import { parcellesApi } from "./api";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const isUrbanOrBuilding = (cultureType?: string) => {
  if (!cultureType) return false;
  const normalized = cultureType.toLowerCase();
  return ["ville", "urbain", "urbaine", "batiment", "bâtiment", "construction"].some((token) =>
    normalized.includes(token),
  );
};

const getParcelleHealthColor = (parcelle: Parcelle) => {
  if (parcelle.status === "critical") return "#dc2626"; // rouge
  if (isUrbanOrBuilding(parcelle.cultureType)) return "#dc2626"; // zone non cultivée
  const cropStatus = getCropStatus(parcelle.ndviMoyen);
  if (cropStatus === "stressed") return "#dc2626";
  return "#16a34a"; // vert cultivé
};

const getParcelleCenter = (geometry: ParcelleGeometry): [number, number] | null => {
  try {
    const layer = L.geoJSON(geometry as any);
    const center = layer.getBounds().getCenter();
    return [center.lat, center.lng];
  } catch {
    return null;
  }
};

interface DrawControllerProps {
  drawing: boolean;
  onCreated: (geom: ParcelleGeometry) => void;
}

const DrawController = ({ drawing, onCreated }: DrawControllerProps) => {
  const map = useMap();

  useEffect(() => {
    map.pm.setGlobalOptions({
      pathOptions: {
        color: "hsl(142 60% 45%)",
        weight: 2.5,
        fillColor: "hsl(142 60% 45%)",
        fillOpacity: 0.18,
      },
      snappable: true,
      allowSelfIntersection: false,
    });

    map.pm.setLang("fr");

  const handleCreate = (e: any) => {
  const layer = e.layer as L.Polygon;
  let geom: ParcelleGeometry | null = null;
  try {
    const gj = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
    geom = { type: "Polygon", coordinates: gj.geometry.coordinates };
  } catch (err) {
    console.error("[ParcelleMap] toGeoJSON failed", err);
    return;
  }
  // Defer cleanup + state update so Geoman finishes its internal event
  // handling before React re-renders / disables draw mode (avoids crash).
  setTimeout(() => {
    try {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      if (map.pm.globalDrawModeEnabled()) map.pm.disableDraw();
    } catch (err) {
      console.warn("[ParcelleMap] cleanup warning", err);
    }
    if (geom) onCreated(geom);
  }, 0);
};


    map.on("pm:create", handleCreate);
    return () => {
      map.off("pm:create", handleCreate);
    };
  }, [map, onCreated]);

  useEffect(() => {
  try {
    if (drawing) {
      if (!map.pm.globalDrawModeEnabled()) {
        map.pm.enableDraw("Polygon", { snappable: true, finishOn: "dblclick" });
      }
    } else if (map.pm.globalDrawModeEnabled()) {
      map.pm.disableDraw();
    }
  } catch (err) {
    console.warn("[ParcelleMap] draw toggle warning", err);
  }
}, [drawing, map]);


  return null;
};

interface FitBoundsProps {
  parcelles: Parcelle[];
  selectedId: string | null;
}

const FitBounds = ({ parcelles, selectedId }: FitBoundsProps) => {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (selectedId) {
      const p = parcelles.find((x) => x._id === selectedId);
      if (!p) return;
      const layer = L.geoJSON(p.geometry as any);
      map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 16 });
      return;
    }
    if (!fittedRef.current && parcelles.length > 0) {
      const group = L.featureGroup(parcelles.map((p) => L.geoJSON(p.geometry as any)));
      try {
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 });
        fittedRef.current = true;
      } catch { /* ignore */ }
    }
  }, [map, parcelles, selectedId]);

  return null;
};

const GeolocationController = () => {
  const map = useMap();
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    const onLocationFound = (e: L.LocationEvent) => {
      setPosition(e.latlng);
      setAccuracy(e.accuracy);
      map.flyTo(e.latlng, 16);
    };

    const onLocationError = (e: L.ErrorEvent) => {
      console.warn("[Geolocation] Error:", e.message);
    };

    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);

    return () => {
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
    };
  }, [map]);

  if (!position) return null;

  return (
    <Fragment>
      <CircleMarker
        center={position}
        radius={8}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 1,
        }}
      >
        <Popup>Vous êtes ici</Popup>
      </CircleMarker>
      {accuracy && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{
            color: "#3b82f6",
            weight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
          }}
        />
      )}
    </Fragment>
  );
};

const GeolocationButton = () => {
  const map = useMap();
  const [loading, setLoading] = useState(false);

  const handleLocate = () => {
    setLoading(true);
    map.locate({ setView: true, maxZoom: 16 });
    map.once("locationfound", () => setLoading(false));
    map.once("locationerror", () => setLoading(false));
  };

  return (
    <div className="leaflet-top leaflet-right mt-16 mr-3 z-[1000] pointer-events-auto">
      <div className="leaflet-bar border-none shadow-panel">
        <button
          onClick={handleLocate}
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center bg-background hover:bg-secondary transition-colors rounded-xl text-foreground shadow-md border border-border"
          title="Ma position"
        >
          {loading ? (
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <Target className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
};

const SearchBox = () => {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      // Limité à l'Algérie avec countrycodes=dz
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=dz`);
      const data = await res.json();
      setResults(data);
      if (data.length > 0) {
        const { lat, lon } = data[0];
        map.flyTo([parseFloat(lat), parseFloat(lon)], 14);
        // On ne vide pas les résultats s'il y en a plusieurs, pour laisser le choix
        if (data.length === 1) setResults([]);
      } else {
        toast.error("Adresse introuvable en Algérie");
      }
    } catch (error) {
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[1001] pointer-events-auto w-full max-w-lg px-4 flex justify-center">
      <div className="w-full">
      <form onSubmit={handleSearch} className="flex items-center rounded-2xl bg-background border border-border shadow-lg overflow-hidden">
        <input 
          type="text" 
          placeholder="Rechercher une adresse..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent border-none outline-none px-4 py-3 text-base text-foreground w-full placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={isSearching} className="p-3 hover:bg-secondary text-muted-foreground transition-colors">
          {isSearching ? <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Search className="size-5" />}
        </button>
      </form>
      {results.length > 1 && (
        <ul className="mt-2 bg-background border border-border rounded-xl shadow-panel max-h-64 overflow-y-auto w-full">
          {results.map((r, i) => (
             <li 
               key={i} 
               className="px-4 py-3 text-sm text-foreground hover:bg-secondary cursor-pointer border-b border-border last:border-0 truncate" 
               onClick={() => {
                map.flyTo([parseFloat(r.lat), parseFloat(r.lon)], 15);
                setResults([]);
                setQuery(r.display_name.split(',')[0]); // Garder juste le premier élément
             }}>
               {r.display_name}
             </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
};

interface ParcelleMapProps {
  parcelles: Parcelle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  drawing: boolean;
  onCreated: (geom: ParcelleGeometry) => void;
  rainByParcelle?: Record<string, { rain7d: number; dryDays: number }>;
  indexType?: string;
  onIndexTypeChange?: (type: string) => void;
}

export const ParcelleMap = ({
  parcelles,
  selectedId,
  onSelect,
  drawing,
  onCreated,
  rainByParcelle = {},
  indexType = "ndvi",
  onIndexTypeChange,
}: ParcelleMapProps) => {
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (selectedId) {
      setHeatmapLoading(true);
      parcellesApi.getHeatmap(selectedId, indexType)
        .then(res => {
          if (!cancelled) setHeatmapUrl(res.url);
        })
        .catch(err => {
          console.error("Failed to fetch heatmap", err);
          if (!cancelled) setHeatmapUrl(null);
        })
        .finally(() => {
          if (!cancelled) setHeatmapLoading(false);
        });
    } else {
      setHeatmapUrl(null);
    }
    return () => { cancelled = true; };
  }, [selectedId, indexType]);

  return (
    <div className="relative h-full w-full">
      {heatmapLoading && (
        <div className="absolute top-20 right-3 z-[1000] pointer-events-none">
          <div className="flex items-center justify-center p-2 bg-background/80 backdrop-blur-md rounded-xl border border-border shadow-panel">
             <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      )}

      <MapContainer
      center={[28.0339, 1.6596]} // Algérie - centre par défaut
      zoom={6}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.esri.com">Esri</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        opacity={0.7}
      />
      {heatmapUrl && (
        <TileLayer
          url={heatmapUrl}
          opacity={0.7}
        />
      )}

      <DrawController drawing={drawing} onCreated={onCreated} />
      <FitBounds parcelles={parcelles} selectedId={selectedId} />
      <GeolocationController />
      <GeolocationButton />
      <SearchBox />

      {parcelles.map((p) => {
        const isSelected = p._id === selectedId;
        const baseColor = getParcelleHealthColor(p);
        const center = getParcelleCenter(p.geometry);
        const baseStyle = {
          color: baseColor,
          weight: isSelected ? 3.5 : 2,
          fillColor: baseColor,
          fillOpacity: isSelected ? 0.4 : 0.18,
          dashArray: isSelected ? undefined : "4 4",
        };
        return (
          <Fragment key={`${p._id}-group`}>
            <GeoJSON
              key={`${p._id}-polygon`}
              data={p.geometry as any}
              style={() => baseStyle}
              onEachFeature={(_, layer) => {
                const rain = rainByParcelle[p._id]?.rain7d;
                const dryDays = rainByParcelle[p._id]?.dryDays;
                const ndvi = p.ndviMoyen != null ? p.ndviMoyen.toFixed(2) : "—";
                const ndwi = p.ndwiMoyen != null ? p.ndwiMoyen.toFixed(2) : "—";
                const savi = p.saviMoyen != null ? p.saviMoyen.toFixed(2) : "—";
                const gndvi = p.gndviMoyen != null ? p.gndviMoyen.toFixed(2) : "—";
                
                const rainText = rain != null ? `${rain.toFixed(1)} mm/7j` : "pluie indisponible";
                const dryText = dryDays != null ? ` · ${dryDays}j secs` : "";
                
                layer.bindTooltip(
                  `<div class="flex flex-col gap-1">
                    <div class="font-bold border-b border-border/50 pb-1">${p.nom}</div>
                    <div class="grid grid-cols-2 gap-x-3 text-[10px]">
                      <span>NDVI: <b>${ndvi}</b></span>
                      <span>NDWI: <b>${ndwi}</b></span>
                      <span>SAVI: <b>${savi}</b></span>
                      <span>GNDVI: <b>${gndvi}</b></span>
                    </div>
                    <div class="text-[9px] text-muted-foreground pt-1">${rainText}${dryText}</div>
                  </div>`, 
                  {
                    sticky: true,
                    direction: "top",
                    className: "parcelle-label-tooltip-v2",
                  }
                );
              }}
              eventHandlers={{
                click: () => onSelect(p._id),
                add: (e) => { (e.target as L.Path).setStyle(baseStyle); },
                mouseover: (e) => { (e.target as L.Path).setStyle({ fillOpacity: 0.45, weight: 3 }); },
                mouseout: (e) => { (e.target as L.Path).setStyle(baseStyle); },
              }}
            />
            {center && (
              <CircleMarker
                key={`${p._id}-point`}
                center={center}
                radius={isSelected ? 8 : 6}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: baseColor,
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => onSelect(p._id) }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{p.nom}</div>
                    <div>NDWI: {p.ndwiMoyen != null ? p.ndwiMoyen.toFixed(2) : "—"}</div>
                    <div>Pluie 7j: {rainByParcelle[p._id]?.rain7d != null ? `${rainByParcelle[p._id].rain7d?.toFixed(1)} mm` : "—"}</div>
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </Fragment>
        );
      })}
    </MapContainer>
    </div>
  );
};
