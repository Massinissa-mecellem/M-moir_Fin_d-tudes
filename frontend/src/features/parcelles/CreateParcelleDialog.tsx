import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { formatHa, polygonAreaHa } from "./utils";
import type { ParcelleGeometry } from "./types";

interface Props {
  open: boolean;
  geometry: ParcelleGeometry | null;
  onCancel: () => void;
  onConfirm: (data: {
    nom: string;
    cultureType: string;
    proprietaire: string;
    datePlantation: string;
    cultureEstimatedStage?: string;
    cultureAgeYears?: number;
    treeDensity?: number;
  }) => Promise<void>;
}

const SEASONAL_CROPS = [
  { id: "Blé", label: "Blé" },
  { id: "Riz", label: "Riz" },
  { id: "Maïs", label: "Maïs" },
  { id: "Tomate", label: "Tomate" },
  { id: "Poivron", label: "Poivron" },
  { id: "Autre (Saisonnier)", label: "Autre (Saisonnier)" }
];

const TREE_CROPS = [
  { id: "Olivier", label: "Olivier" },
  { id: "Agrumes", label: "Agrumes (Oranger, Citronnier)" },
  { id: "Pommier", label: "Pommier" },
  { id: "Palmier", label: "Palmier Dattier" },
  { id: "Autre (Arboriculture)", label: "Autre (Arboriculture)" }
];

export const CreateParcelleDialog = ({ open, geometry, onCancel, onConfirm }: Props) => {
  const [nom, setNom] = useState("");
  const [cultureType, setCultureType] = useState("");
  const [datePlantation, setDatePlantation] = useState("");
  const [proprietaire, setProprietaire] = useState("");
  const [cultureEstimatedStage, setCultureEstimatedStage] = useState("auto");
  const [cultureAgeYears, setCultureAgeYears] = useState<number>(5);
  const [treeDensity, setTreeDensity] = useState<number>(150);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNom("");
      setCultureType("");
      setDatePlantation(new Date().toISOString().slice(0, 10));
      setProprietaire("");
      setCultureEstimatedStage("auto");
      setCultureAgeYears(5);
      setTreeDensity(150);
    }
  }, [open]);

  const surface = geometry ? polygonAreaHa(geometry) : 0;
  const todayIso = new Date().toISOString().slice(0, 10);

  // Déterminer s'il s'agit d'une arboriculture (arbres)
  const isTree = TREE_CROPS.some(t => t.id.toLowerCase() === cultureType.toLowerCase()) ||
                 cultureType.toLowerCase().includes("olivier") ||
                 cultureType.toLowerCase().includes("pomme") ||
                 cultureType.toLowerCase().includes("agrume") ||
                 cultureType.toLowerCase().includes("palm");

  const handleSubmit = async () => {
    if (!nom.trim() || !proprietaire.trim() || !cultureType) return;
    setSubmitting(true);
    try {
      await onConfirm({
        nom: nom.trim(),
        cultureType,
        proprietaire: proprietaire.trim(),
        datePlantation,
        ...(isTree ? { cultureAgeYears, treeDensity } : { cultureEstimatedStage })
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-primary/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">Nouvelle parcelle</DialogTitle>
          <DialogDescription className="text-xs">
            Surface estimée : <span className="font-semibold text-primary">{formatHa(surface)}</span>.
            Le calcul des indices (NDVI / NDWI) démarrera automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="nom" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom de la parcelle</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Champ Nord 1" className="rounded-2xl" autoFocus />
          </div>

          {/* Propriétaire */}
          <div className="space-y-1.5">
            <Label htmlFor="proprio" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Propriétaire</Label>
            <Input id="proprio" value={proprietaire} onChange={(e) => setProprietaire(e.target.value)} placeholder="Nom de l'agriculteur" className="rounded-2xl" />
          </div>

          {/* Type de culture */}
          <div className="space-y-1.5">
            <Label htmlFor="culture" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type de culture</Label>
            <select
              id="culture"
              value={cultureType}
              onChange={(e) => {
                setCultureType(e.target.value);
                setCultureEstimatedStage("auto");
              }}
              className="w-full rounded-2xl border border-input bg-card px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-10 font-semibold"
            >
              <option value="" disabled>Choisir une culture...</option>
              <optgroup label="🌾 Cultures Saisonnières">
                {SEASONAL_CROPS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
              <optgroup label="🌳 Arboriculture (Arbres)">
                {TREE_CROPS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
            </select>
          </div>

          {/* Date de plantation */}
          {cultureType && (
            <div className="space-y-1.5 animate-fade-in-up">
              <Label htmlFor="datePlantation" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isTree ? "Date d'analyse de départ" : "Date de semis / plantation"}
              </Label>
              <Input
                id="datePlantation"
                type="date"
                max={todayIso}
                value={datePlantation}
                onChange={(e) => setDatePlantation(e.target.value)}
                className="rounded-2xl"
              />
            </div>
          )}

          {/* Options conditionnelles Saisonnières */}
          {cultureType && !isTree && (
            <div className="space-y-1.5 animate-fade-in-up border-t pt-3 border-muted-foreground/10">
              <Label htmlFor="initialStage" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stade de croissance actuel estimé</Label>
              <select
                id="initialStage"
                value={cultureEstimatedStage}
                onChange={(e) => setCultureEstimatedStage(e.target.value)}
                className="w-full rounded-2xl border border-input bg-card px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-10 font-semibold"
              >
                <option value="auto">Automatique (Estimer par l'âge en jours)</option>
                <option value="germination">Germination / Levée</option>
                <option value="vegetative">Croissance Végétative</option>
                <option value="flowering">Floraison / Épiaison</option>
                <option value="maturation">Maturation</option>
                <option value="harvest">Récolte</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Permet d'estimer automatiquement le stade si la culture a déjà été semée auparavant.
              </p>
            </div>
          )}

          {/* Options conditionnelles Arboriculture */}
          {cultureType && isTree && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in-up border-t pt-3 border-muted-foreground/10">
              <div className="space-y-1.5">
                <Label htmlFor="age" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Âge des arbres (ans)</Label>
                <Input
                  id="age"
                  type="number"
                  min={0}
                  max={200}
                  value={cultureAgeYears}
                  onChange={(e) => setCultureAgeYears(Math.max(0, Number(e.target.value)))}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="density" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Densité (arbres/ha)</Label>
                <Input
                  id="density"
                  type="number"
                  min={0}
                  max={2000}
                  value={treeDensity}
                  onChange={(e) => setTreeDensity(Math.max(0, Number(e.target.value)))}
                  className="rounded-2xl"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 border-muted-foreground/10">
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="rounded-2xl">Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting || !nom.trim() || !proprietaire.trim() || !cultureType} className="rounded-2xl">
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
