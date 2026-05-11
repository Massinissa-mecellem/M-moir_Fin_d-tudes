import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/features/parcelles/api";
import { isProfileComplete } from "@/lib/profile";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const LoginPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { token, setToken } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");

  useEffect(() => {
    const err = params.get("error");
    if (err === "google") {
      toast.error("Connexion Google refusée ou échouée.");
    } else if (err === "config") {
      toast.error("Authentification non configurée côté serveur.");
    }
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        if (me.role === 'admin') {
          navigate("/admin", { replace: true });
        } else if (isProfileComplete(me)) {
          navigate("/", { replace: true });
        } else {
          navigate("/setup", { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const startGoogle = () => {
    const url = new URL(`${API_BASE}/api/auth/google`);
    url.searchParams.set("frontend", window.location.origin);
    window.location.href = url.toString();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { token: newToken } = await authApi.login({ email, password });
        setToken(newToken);
        toast.success("Connexion réussie");
      } else {
        const { token: newToken } = await authApi.register({ email, password, nom, prenom });
        setToken(newToken);
        toast.success("Compte créé avec succès");
      }
    } catch (err: any) {
      console.error("Login/Register error:", err);
      let msg = "Une erreur est survenue";
      if (err.response) {
        msg = err.response.data?.error || msg;
      } else if (err.request) {
        msg = "Le serveur ne répond pas. Vérifiez votre connexion ou les réglages CORS.";
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b241a] text-emerald-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 md:flex-row md:items-stretch md:gap-12 md:px-8 md:py-14">
        {/* Colonne branding */}
        <div className="flex flex-1 flex-col justify-center md:max-w-md">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl overflow-hidden">
              <img src="/logo.png" alt="AgriSpectra logo" className="size-12 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-emerald-50">AgriSpectra</h1>
              <p className="text-sm text-emerald-200/75">Surveillance agricole satellitaire</p>
            </div>
          </div>
          <p className="mt-8 text-3xl font-semibold leading-tight text-emerald-50 md:text-4xl">
            {mode === "login" ? "Bon retour" : "Bienvenue"}
          </p>
          <p className="mt-3 text-base leading-relaxed text-emerald-200/85">
            {mode === "login" 
              ? "Connectez-vous pour accéder à vos parcelles et indices NDVI / NDWI."
              : "Créez votre compte pour commencer à surveiller vos exploitations."}
          </p>
        </div>

        {/* Colonne formulaire */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="rounded-2xl border border-emerald-900/60 bg-[#103325]/90 p-6 shadow-xl backdrop-blur md:p-8">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 w-full gap-3 border-emerald-700/50 bg-[#0f2f22] text-emerald-50 hover:bg-emerald-950/80 hover:text-emerald-50"
              onClick={startGoogle}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-5 shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Continuer avec Google
              <ExternalLink className="size-4 opacity-70 ml-auto" />
            </Button>

            <div className="relative my-6">
              <Separator className="bg-emerald-900/50" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#103325] px-3 text-xs text-emerald-400/80">
                ou
              </span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-emerald-200/90">Nom</Label>
                    <Input
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Nom"
                      className="border-emerald-900/50 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-emerald-200/90">Prénom</Label>
                    <Input
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      placeholder="Prénom"
                      className="border-emerald-900/50 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/30"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-emerald-200/90">Adresse e-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agriculteur@exemple.dz"
                  className="border-emerald-900/50 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-200/90">Mot de passe</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-emerald-900/50 bg-[#0f2f22] text-emerald-50 placeholder:text-emerald-200/30"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 h-11"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : mode === "login" ? (
                  <>
                    <LogIn className="mr-2 size-4" />
                    Se connecter
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 size-4" />
                    Créer mon compte
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline underline-offset-4"
              >
                {mode === "login" 
                  ? "Pas encore de compte ? S'inscrire" 
                  : "Déjà un compte ? Se connecter"}
              </button>
            </div>

            <p className="mt-8 text-center text-xs leading-relaxed text-emerald-200/55">
              En continuant, vous acceptez les conditions d&apos;utilisation de la plateforme AgriSpectra.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
