import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { Parcelle } from "./types";

interface Props {
  open: boolean;
  parcelle: Parcelle | null;
  onCancel: () => void;
  onConfirm: (id: string, data: Partial<Parcelle>) => Promise<void>;
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

export const EditParcelleDialog = ({ open, parcelle, onCancel, onConfirm }: Props) => {
  const [nom, setNom] = useState("");
  const [cultureType, setCultureType] = useState("");
  const [datePlantation, setDatePlantation] = useState("");
  const [proprietaire, setProprietaire] = useState("");
  const [cultureEstimatedStage, setCultureEstimatedStage] = useState("auto");
  const [cultureAgeYears, setCultureAgeYears] = useState<number>(5);
  const [treeDensity, setTreeDensity] = useState<number>(150);
  const [submitting, setSubmitting] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);

  const toDateInput = (raw?: string) => {
    if (!raw) return "";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (open && parcelle) {
      setNom(parcelle.nom || "");
      setCultureType(parcelle.cultureType || "");
      setDatePlantation(toDateInput(parcelle.datePlantation));
      setProprietaire(parcelle.proprietaire || "");
      setCultureEstimatedStage(parcelle.cultureEstimatedStage || "auto");
      setCultureAgeYears(parcelle.cultureAgeYears || 5);
      setTreeDensity(parcelle.treeDensity || 150);
    }
  }, [open, parcelle]);

  // Déterminer s'il s'agit d'une arboriculture (arbres)
  const isTree = TREE_CROPS.some(t => t.id.toLowerCase() === cultureType.toLowerCase()) ||
                 cultureType.toLowerCase().includes("olivier") ||
                 cultureType.toLowerCase().includes("pomme") ||
                 cultureType.toLowerCase().includes("agrume") ||
                 cultureType.toLowerCase().includes("palm");

  const handleSubmit = async () => {
    if (!parcelle || !nom.trim() || !proprietaire.trim() || !cultureType) return;
    setSubmitting(true);
    try {
      await onConfirm(parcelle._id, {
        nom: nom.trim(),
        cultureType,
        proprietaire: proprietaire.trim(),
        datePlantation,
        cultureEstimatedStage: isTree ? undefined : cultureEstimatedStage,
        cultureAgeYears: isTree ? cultureAgeYears : undefined,
        treeDensity: isTree ? treeDensity : undefined
      });
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-primary/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">Modifier la parcelle</DialogTitle>
          <DialogDescription className="text-xs">
            Mettez à jour les informations agronomiques et de localisation de la parcelle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-nom" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom de la parcelle</Label>
            <Input id="edit-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Champ Nord 1" className="rounded-2xl" autoFocus />
          </div>

          {/* Propriétaire */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-proprio" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Propriétaire</Label>
            <Input id="edit-proprio" value={proprietaire} onChange={(e) => setProprietaire(e.target.value)} placeholder="Nom de l'agriculteur" className="rounded-2xl" />
          </div>

          {/* Type de culture */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-culture" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type de culture</Label>
            <select
              id="edit-culture"
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

          {/* Date de semis / plantation */}
          {cultureType && (
            <div className="space-y-1.5 animate-fade-in-up">
              <Label htmlFor="edit-datePlantation" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isTree ? "Date d'analyse de départ" : "Date de semis / plantation"}
              </Label>
              <Input
                id="edit-datePlantation"
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
              <Label htmlFor="edit-initialStage" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stade de croissance actuel estimé</Label>
              <select
                id="edit-initialStage"
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
            </div>
          )}

          {/* Options conditionnelles Arboriculture */}
          {cultureType && isTree && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in-up border-t pt-3 border-muted-foreground/10">
              <div className="space-y-1.5">
                <Label htmlFor="edit-age" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Âge des arbres (ans)</Label>
                <Input
                  id="edit-age"
                  type="number"
                  min={0}
                  max={200}
                  value={cultureAgeYears}
                  onChange={(e) => setCultureAgeYears(Math.max(0, Number(e.target.value)))}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-density" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Densité (arbres/ha)</Label>
                <Input
                  id="edit-density"
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
