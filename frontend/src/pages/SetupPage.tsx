import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Loader2, Sprout, UserRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authApi } from "@/features/parcelles/api";
import { useAuth } from "@/contexts/AuthContext";
import { ALGERIA_WILAYAS } from "@/data/wilayas";
import { isProfileComplete } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const oauthSteps = [
  { ok: true, label: "/api/auth/google → Google" },
  { ok: true, label: "Consentement utilisateur" },
  { ok: true, label: "Callback → upsert MongoDB" },
  { ok: true, label: "JWT signé → redirect frontend" },
];

const SPECIALITES = [
  "Production végétale",
  "Irrigation",
  "Maladies phytosanitaires",
  "Fertilisation et nutrition",
  "Analyse des sols",
  "Arboriculture",
];

const SetupPage = () => {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<"agriculteur" | "conseiller">("agriculteur");
  const [wilaya, setWilaya] = useState("");
  const [nomExploitation, setNomExploitation] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [specialites, setSpecialites] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        if (isProfileComplete(me)) {
          navigate("/", { replace: true });
          return;
        }
        if (me.wilaya) setWilaya(me.wilaya);
        setNomExploitation(me.nomExploitation ?? "");
        setRole((me.role as "agriculteur" | "conseiller") || "agriculteur");
        setTelephone(me.telephone ?? "");
        setAdresse(me.adresse ?? "");
        setSpecialites(me.specialites ?? []);
      })
      .catch(() => navigate("/login", { replace: true }))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const toggleSpecialite = (s: string) => {
    setSpecialites(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wilaya.trim()) {
      toast.error("Choisissez une wilaya.");
      return;
    }
    if (role === "conseiller") {
      if (!telephone.trim()) {
        toast.error("Le numéro de téléphone est requis.");
        return;
      }
      if (specialites.length === 0) {
        toast.error("Sélectionnez au moins une spécialité.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { user, token } = await authApi.patchProfile({
        role,
        wilaya: wilaya.trim(),
        nomExploitation: role === "agriculteur" ? nomExploitation.trim() : undefined,
        telephone: role === "conseiller" ? telephone.trim() : undefined,
        adresse: role === "conseiller" ? adresse.trim() : undefined,
        specialites: role === "conseiller" ? specialites : undefined,
      });
      setToken(token);
      toast.success("Profil complété");
      if (isProfileComplete(user)) navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "")
          : "Erreur lors de l’enregistrement.";
      toast.error(msg || "Erreur lors de l’enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b241a] text-emerald-50">
        <Loader2 className="size-10 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b241a] px-4 py-10 text-emerald-50">
      <div className="mx-auto max-w-lg space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="" className="mx-auto mb-3 h-12 w-12 object-contain" />
          <h1 className="text-xl font-semibold tracking-tight">Finaliser votre compte</h1>
          <p className="mt-1 text-sm text-emerald-200/80">
            Après connexion — sélection du rôle et informations complémentaires
          </p>
        </div>

        <Card className="border-emerald-900/60 bg-[#103325]/90 text-emerald-50 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-emerald-50">Sélection du rôle</CardTitle>
            <CardDescription className="text-emerald-200/70">
              Choisissez votre profil pour continuer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRole("agriculteur")}
              className={cn(
                "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
                role === "agriculteur"
                  ? "border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500/50"
                  : "border-emerald-900/40 bg-[#0a1f16]/80 opacity-60"
              )}
            >
              <Sprout className={cn("mb-2 size-5", role === "agriculteur" ? "text-emerald-400" : "text-emerald-600")} />
              <span className="font-semibold">Agriculteur</span>
              <span className="text-xs text-emerald-200/70">Gérer mes parcelles</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("conseiller")}
              className={cn(
                "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
                role === "conseiller"
                  ? "border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500/50"
                  : "border-emerald-900/40 bg-[#0a1f16]/80 opacity-60"
              )}
            >
              <UserRound className={cn("mb-2 size-5", role === "conseiller" ? "text-emerald-400" : "text-emerald-600")} />
              <span className="font-semibold">Conseiller</span>
              <span className="text-xs text-emerald-200/70">Suivre des exploitations</span>
            </button>
          </CardContent>
        </Card>

        <Card className="border-emerald-900/60 bg-[#103325]/90 text-emerald-50 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-emerald-50">Informations complémentaires</CardTitle>
            <CardDescription className="text-emerald-200/70">
              Ces données sont nécessaires pour configurer votre espace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="wilaya">Wilaya</Label>
                <Select value={wilaya} onValueChange={setWilaya}>
                  <SelectTrigger id="wilaya" className="border-emerald-900/60 bg-[#0f2f22] text-emerald-50">
                    <SelectValue placeholder="Choisir une wilaya" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-emerald-900 bg-[#103325] text-emerald-50">
                    {ALGERIA_WILAYAS.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {role === "agriculteur" ? (
                <div className="space-y-2">
                  <Label htmlFor="farm">Nom de l&apos;exploitation (optionnel)</Label>
                  <Input
                    id="farm"
                    value={nomExploitation}
                    onChange={(e) => setNomExploitation(e.target.value)}
                    placeholder="ex: Ferme El Baraka"
                    className="border-emerald-900/60 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/40"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Numéro de téléphone</Label>
                    <Input
                      id="phone"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="ex: 0550 00 00 00"
                      className="border-emerald-900/60 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse professionnelle (optionnelle)</Label>
                    <Input
                      id="address"
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      placeholder="ex: Rue des Jardins, Alger"
                      className="border-emerald-900/60 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/40"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Domaines d&apos;expertise</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SPECIALITES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSpecialite(s)}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
                            specialites.includes(s)
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-100"
                              : "border-emerald-900/60 bg-[#0f2f22] text-emerald-400/70 hover:bg-emerald-900/30"
                          )}
                        >
                          <div className={cn(
                            "size-2 rounded-full",
                            specialites.includes(s) ? "bg-emerald-400" : "bg-emerald-900"
                          )} />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                size="lg"
                disabled={submitting || !wilaya.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  "Terminer la configuration"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-emerald-900/50 bg-[#0f2f22]/60 text-emerald-100/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <UserRound className="size-4" />
              Accompagnement personnalisé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-200/85 leading-relaxed">
              En choisissant le rôle de conseiller, vous pourrez apporter votre expertise aux agriculteurs et suivre l&apos;évolution de leurs parcelles en temps réel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SetupPage;
