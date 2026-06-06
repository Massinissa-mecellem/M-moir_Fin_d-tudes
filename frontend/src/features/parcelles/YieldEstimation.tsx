import { AlertCircle, TrendingUp, ShieldAlert, Sprout } from "lucide-react";

interface Props {
  ndvi: number | null | undefined;
  ndwi: number | null | undefined;
  surface: number;
  culture: string;
  stade: string;
}

interface YieldCoefficients {
  a: number;
  b: number;
  hi: number;
  label: string;
  emoji: string;
}

const YIELD_CONFIG: Record<string, YieldCoefficients> = {
  ble: { a: 8.5, b: -2.1, hi: 0.40, label: "Blé", emoji: "🌾" },
  mais: { a: 12.0, b: -3.5, hi: 0.45, label: "Maïs", emoji: "🌽" },
  orge: { a: 7.8, b: -1.9, hi: 0.38, label: "Orge", emoji: "🌿" },
  olivier: { a: 5.5, b: -1.2, hi: 0.35, label: "Olivier", emoji: "🫒" },
  raisins: { a: 18.0, b: -4.0, hi: 0.42, label: "Raisins", emoji: "🍇" },
  pommeDeTerre: { a: 35.0, b: -8.0, hi: 0.75, label: "Pomme de terre", emoji: "🥔" },
  tomate: { a: 65.0, b: -12.0, hi: 0.65, label: "Tomate", emoji: "🍅" },
};

const normalizeCulture = (cultureStr: string): string => {
  const norm = cultureStr.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlever les accents
    .replace(/\s+/g, "");
  
  if (norm.includes("ble")) return "ble";
  if (norm.includes("mais")) return "mais";
  if (norm.includes("orge")) return "orge";
  if (norm.includes("olivier")) return "olivier";
  if (norm.includes("raisin")) return "raisins";
  if (norm.includes("pommedeterre")) return "pommeDeTerre";
  if (norm.includes("tomate")) return "tomate";
  return norm;
};

const normalizeStage = (stageStr: string): string => {
  const norm = stageStr.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Enlever les accents
  
  if (norm.includes("germin")) return "germination";
  if (norm.includes("veget") || norm.includes("croissance")) return "vegetatif";
  if (norm.includes("flor") || norm.includes("epiais") || norm.includes("flower")) return "floraison";
  if (norm.includes("matur")) return "maturation";
  if (norm.includes("recol") || norm.includes("harvest") || norm.includes("fin de cycle")) return "recolte";
  return norm;
};

export const YieldEstimation = ({ ndvi, ndwi, surface, culture, stade }: Props) => {
  const normCulture = normalizeCulture(culture);
  const normStage = normalizeStage(stade);
  const config = YIELD_CONFIG[normCulture];

  // 1. Vérification si la culture est supportée
  if (!config) {
    return (
      <div className="rounded-3xl p-6 bg-[#0d2818] border border-[#00c853]/20 text-white shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-[#00c853]/10 flex items-center justify-center text-[#00c853] shrink-0">
            <Sprout className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Estimation du Rendement</h4>
            <p className="text-base font-bold text-foreground capitalize">{culture} ({surface.toFixed(2)} ha)</p>
          </div>
        </div>
        <div className="flex gap-3 p-4 bg-[#0d2818]/60 rounded-2xl border border-yellow-500/20 text-yellow-500 text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p className="font-semibold leading-relaxed">
            L'estimation du rendement n'est pas encore modélisée pour ce type de culture ({culture}).
          </p>
        </div>
      </div>
    );
  }

  // 2. Vérification des données satellitaires valides
  if (ndvi == null || ndwi == null || isNaN(ndvi) || isNaN(ndwi)) {
    return (
      <div className="rounded-3xl p-6 bg-[#0d2818] border border-[#00c853]/20 text-white shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-[#00c853]/10 flex items-center justify-center text-primary shrink-0">
            <span className="text-xl">{config.emoji}</span>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">{config.label}</h4>
            <p className="text-xs text-muted-foreground">{surface.toFixed(2)} ha</p>
          </div>
        </div>
        <div className="flex gap-3 p-4 bg-[#0d2818]/60 rounded-2xl border border-yellow-500/20 text-yellow-500 text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p className="font-semibold leading-relaxed">
            Données satellitaires NDVI / NDWI insuffisantes pour estimer le rendement.
          </p>
        </div>
      </div>
    );
  }

  // 3. Vérification du stade phénologique
  const isBlocked = normStage === "germination" || normStage === "vegetatif";
  const isHarvestReady = normStage === "recolte";

  // 4. Calculs si éligible
  let biomasse = 0;
  let rendement = 0;
  let facteurNdwi = 1.0;
  let rendementFinal = 0;
  let recolteTotale = 0;
  let minRecolte = 0;
  let maxRecolte = 0;

  let ndwiStatus = "Inconnu";
  let ndwiColor = "text-muted-foreground bg-muted/10 border-muted/20";

  if (!isBlocked && !isHarvestReady) {
    // Étape 2 : Biomasse = a * NDVI + b
    biomasse = config.a * ndvi + config.b;
    // Si la biomasse calculée est négative, on la sature à 0
    if (biomasse < 0) biomasse = 0;

    // Étape 3 : Rendement = Biomasse * HI
    rendement = biomasse * config.hi;

    // Étape 4 : Facteur NDWI
    if (ndwi > 0.2) {
      facteurNdwi = 1.10;
      ndwiStatus = "Optimal";
      ndwiColor = "text-[#00c853] bg-[#00c853]/10 border-[#00c853]/20";
    } else if (ndwi > 0.0) {
      facteurNdwi = 0.90;
      ndwiStatus = "Léger stress";
      ndwiColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
    } else if (ndwi > -0.2) {
      facteurNdwi = 0.70;
      ndwiStatus = "Stress modéré";
      ndwiColor = "text-orange-500 bg-orange-500/10 border-orange-500/20";
    } else {
      facteurNdwi = 0.50;
      ndwiStatus = "Stress sévère";
      ndwiColor = "text-red-500 bg-red-500/10 border-red-500/20";
    }

    // Rendement final
    rendementFinal = rendement * facteurNdwi;

    // Étape 5 : Récolte totale et fourchette (+/- 15%)
    recolteTotale = rendementFinal * surface;
    minRecolte = recolteTotale * 0.85;
    maxRecolte = recolteTotale * 1.15;
  }

  // Couleurs pour le statut du NDVI
  const getNdviColor = (val: number) => {
    if (val > 0.6) return "text-[#00c853] bg-[#00c853]/10 border-[#00c853]/20";
    if (val >= 0.3) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="rounded-3xl p-6 bg-gradient-to-br from-[#0d2818] to-[#06180e] border border-[#00c853]/20 text-white shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-12 -right-12 size-24 rounded-full bg-[#00c853]/10 blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#00c853]/10">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-[#00c853]/10 border border-[#00c853]/20 flex items-center justify-center shrink-0">
            <span className="text-2xl">{config.emoji}</span>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#00c853]">Estimation du Rendement</h4>
            <p className="text-base font-bold text-foreground flex items-center gap-1.5">
              {config.label}
              <span className="text-xs text-muted-foreground font-medium">({surface.toFixed(2)} ha)</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/80">
            Stade : {stade}
          </span>
        </div>
      </div>

      {/* Message d'état si bloqué */}
      {isBlocked && (
        <div className="mt-4 flex gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 text-blue-400 text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-blue-400" />
          <p className="font-semibold leading-relaxed">
            L'estimation du rendement sera disponible à partir du stade floraison.
          </p>
        </div>
      )}

      {isHarvestReady && (
        <div className="mt-4 flex gap-3 p-4 bg-emerald-500/5 rounded-2xl border border-[#00c853]/20 text-[#00c853] text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-[#00c853]" />
          <p className="font-semibold leading-relaxed">
            La culture est en fin de cycle, la récolte est imminente.
          </p>
        </div>
      )}

      {/* Affichage des résultats si éligible */}
      {!isBlocked && !isHarvestReady && (
        <div className="mt-5 space-y-5">
          {/* Indices actuels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">NDVI Actuel</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black">{ndvi.toFixed(3)}</span>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${getNdviColor(ndvi)}`}>
                  {ndvi > 0.6 ? "Bon" : ndvi >= 0.3 ? "Moyen" : "Faible"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">NDWI Actuel</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black">{ndwi.toFixed(3)}</span>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${ndwiColor}`}>
                  {ndwiStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Rendement moyen à l'hectare */}
          <div className="p-4 bg-[#00c853]/5 border-2 border-[#00c853]/20 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00c853]">Rendement Estimé</span>
              <p className="text-2xl font-black tracking-tight text-white">
                {rendementFinal.toFixed(2)} <span className="text-sm font-bold text-muted-foreground">t/ha</span>
              </p>
            </div>
            <div className="size-10 rounded-xl bg-[#00c853]/10 flex items-center justify-center text-[#00c853]">
              <TrendingUp className="size-5" />
            </div>
          </div>

          {/* Récolte totale estimée & Fourchette */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-muted-foreground">Récolte Totale Estimée</span>
              <span className="text-2xl font-black text-[#00c853] tracking-tight">
                ~ {Math.round(recolteTotale).toLocaleString("fr-FR")} <span className="text-xs font-bold text-white">tonnes</span>
              </span>
            </div>

            <div className="pt-3 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Fourchette min - max (±15%)</span>
              <span className="font-bold text-foreground">
                {Math.round(minRecolte).toLocaleString("fr-FR")} t – {Math.round(maxRecolte).toLocaleString("fr-FR")} t
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="mt-5 flex gap-2 items-center justify-center opacity-60">
        <ShieldAlert className="size-3.5 text-muted-foreground" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Estimation indicative basée sur les indices satellitaires Sentinel-2
        </span>
      </div>
    </div>
  );
};
