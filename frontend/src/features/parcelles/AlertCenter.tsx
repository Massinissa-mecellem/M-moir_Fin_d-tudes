import { useEffect, useState } from "react";
import { ArrowLeft, BellRing, CheckCheck, RefreshCw, Trash2, Leaf, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { alertsApi } from "./api";
import { subscribeToPushNotifications } from "./pushNotifications";
import { AlertItem } from "./types";
import { useNavigate } from "react-router-dom";
import { PlatformSidebar } from "@/components/PlatformSidebar";

const alertToneClass: Record<AlertItem["type"], string> = {
  "Stress Hydrique": "border-l-4 border-l-amber-500",
  "Santé": "border-l-4 border-l-red-600",
  "Mise à jour": "border-l-4 border-l-emerald-600",
};

export const AlertCenter = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await alertsApi.list();
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const markRead = async (id: string) => {
    const updated = await alertsApi.markRead(id);
    setAlerts((prev) => prev.map((a) => (a._id === id ? updated : a)));
  };

  const deleteAlert = async (id: string) => {
    await alertsApi.remove(id);
    setAlerts((prev) => prev.filter((a) => a._id !== id));
    toast.success("Alerte supprimée.");
  };

  const clearReadAlerts = async () => {
    const result = await alertsApi.clearRead();
    setAlerts((prev) => prev.filter((a) => !a.isRead));
    toast.success(`${result.deletedCount} alerte(s) lue(s) supprimée(s).`);
  };

  const clearAllAlerts = async () => {
    const result = await alertsApi.clearAll();
    setAlerts([]);
    toast.success(`${result.deletedCount} alerte(s) supprimée(s).`);
  };

  const enablePush = async () => {
    setSubscribing(true);
    try {
      await subscribeToPushNotifications();
      toast.success("Notifications push activées.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'activer les notifications push.";
      toast.error("Activation échouée", { description: message });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <PlatformSidebar />
      <main className="flex-1 overflow-y-auto p-8 scroll-smooth">
        <div className="mx-auto max-w-5xl space-y-8">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <BellRing className="size-8 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Centre d'alertes</h2>
                <p className="text-muted-foreground">Gérez les anomalies détectées sur vos exploitations.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 size-4" />
                Retour
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={loadAlerts}>
                <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-border shadow-soft bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Paramètres</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-xs font-medium text-primary mb-2 flex items-center gap-2">
                      <BellRing className="size-3" />
                      Notifications temps réel
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">Recevez des alertes directement sur votre navigateur ou mobile.</p>
                    <Button className="w-full rounded-lg" onClick={enablePush} disabled={subscribing}>
                      {subscribing ? "Activation..." : "Activer les notifications Push"}
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Actions groupées</p>
                    <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted" onClick={clearReadAlerts}>
                      <Trash2 className="mr-2 size-4 text-muted-foreground" />
                      Supprimer les alertes lues
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-sm hover:bg-destructive/10 hover:text-destructive" onClick={clearAllAlerts}>
                      <Trash2 className="mr-2 size-4" />
                      Tout supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-lg overflow-hidden relative">
                <Leaf className="absolute -bottom-4 -right-4 size-32 opacity-10 rotate-12" />
                <h3 className="text-lg font-bold mb-2">Conseil Agricole</h3>
                <p className="text-sm text-emerald-50 opacity-90 leading-relaxed">
                  Surveillez régulièrement l'indice NDVI après les périodes de pluie pour détecter d'éventuels retards de croissance.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Alertes récentes ({alerts.length})</h3>
              </div>

              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
              )}

              {!loading && alerts.length === 0 && (
                <Card className="border-dashed border-2 border-border bg-transparent">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <CheckCheck className="size-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold text-foreground">Tout est en ordre</p>
                    <p className="text-sm text-muted-foreground max-w-xs">Aucune anomalie n'a été détectée par nos satellites AgriSpectra.</p>
                  </CardContent>
                </Card>
              )}

              {!loading && alerts.map((alert) => (
                <Card 
                  key={alert._id} 
                  className={`group border-border shadow-soft bg-card/50 backdrop-blur-sm transition-all hover:shadow-md hover:border-primary/20 rounded-2xl overflow-hidden ${!alert.isRead ? 'border-l-4 border-l-primary' : ''}`}
                >
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-start gap-5">
                      <div className={`mt-1 p-3 rounded-xl shadow-sm ${
                        alert.type === "Santé" || alert.type === "Stress Hydrique" 
                          ? "bg-red-500/10 text-red-500" 
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}>
                        <Siren className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                            {alert.parcelleId?.nom || "Parcelle inconnue"}
                          </p>
                          {!alert.isRead && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-black uppercase text-primary">Nouveau</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold text-foreground/70">{alert.type}</span>
                          <span className="size-1 bg-border rounded-full" />
                          <span className="flex items-center gap-1">
                            Indice <span className="font-bold text-foreground">{alert.valeurIndice.toFixed(2)}</span>
                          </span>
                          <span className="size-1 bg-border rounded-full" />
                          <span className="italic">{new Date(alert.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                        {alert.rapport && (
                          <p className="mt-3 text-sm text-foreground/80 bg-muted/30 p-3 rounded-lg border border-border/50">
                            {alert.rapport}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-6">
                      {!alert.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="rounded-lg hover:bg-primary/10 hover:text-primary"
                          onClick={() => markRead(alert._id)}
                        >
                          <CheckCheck className="mr-2 size-4" />
                          Lu
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deleteAlert(alert._id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Effacer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
