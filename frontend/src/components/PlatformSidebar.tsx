import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Map, Bell, FileText, FileSpreadsheet, LogOut, LineChart, Activity, Sun, Moon, Phone, User, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ExportParcelleShortcutDialog } from "@/components/ExportParcelleShortcutDialog";
import { useAuth } from "@/contexts/AuthContext";

const suiviItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/parcelles", label: "Mes parcelles", icon: Map, end: false },
  { to: "/indices", label: "Indices NDVI/NDWI", icon: Activity, end: false },

  { to: "/conseils", label: "Contacter un expert", icon: User, end: false },
];

const alertesItems = [
  { to: "/alertes", label: "Alertes actives", icon: Bell, end: false },
];

const adminItems = [
  { to: "/admin", label: "Administration", icon: ShieldCheck, end: false },
];

const toolButtonClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export const PlatformSidebar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [shortcutMode, setShortcutMode] = useState<"pdf" | "csv" | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark";
  });

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", newTheme);
  }, [theme]);

  const openShortcut = useCallback((mode: "pdf" | "csv") => {
    setShortcutMode(mode);
    setShortcutOpen(true);
  }, []);

  const handleShortcutOpenChange = useCallback((open: boolean) => {
    setShortcutOpen(open);
    if (!open) setShortcutMode(null);
  }, []);

  const getInitials = (prenom?: string) => {
    if (!prenom) return "U";
    return prenom[0].toUpperCase();
  };

  return (
    <aside className="group flex h-full w-[80px] shrink-0 flex-col bg-sidebar-background border-r border-sidebar-border text-sidebar-foreground transition-all duration-300 ease-in-out hover:w-[260px] relative z-20">
      
      {/* Logo Section */}
      <div className="flex h-16 items-center px-4 overflow-hidden shrink-0">
        <a href="/" className="flex items-center gap-3 whitespace-nowrap">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
             <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            AgriSpectra
          </h1>
        </a>
      </div>

      <Separator className="bg-sidebar-border/50" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-4">
        
        {/* SUIVI */}
        <div className="px-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
            Suivi
          </p>
        </div>
        <nav className="space-y-1 px-3 pb-6">
          {suiviItems.map((item) => (
            <NavLink
              key={`nav-${item.to}`}
              to={item.to}
              end={item.end}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground whitespace-nowrap"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-4 border-primary"
            >
              <item.icon className="size-5 shrink-0" />
              <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* ALERTES */}
        <div className="px-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
            Alertes
          </p>
        </div>
        <nav className="space-y-1 px-3 pb-6">
          {alertesItems.map((item) => (
            <NavLink
              key={`nav-${item.to}`}
              to={item.to}
              end={item.end}
              className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground whitespace-nowrap"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-4 border-primary"
            >
              <div className="flex items-center gap-3">
                <item.icon className="size-5 shrink-0" />
                <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {item.label}
                </span>
              </div>
              {/* Fake badge for demo */}
              <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10 text-[10px] font-bold text-red-500 border border-red-500/20">
                3
              </span>
            </NavLink>
          ))}
        </nav>

        {/* EXPORTS */}
        <div className="px-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
            Exports
          </p>
        </div>
        <nav className="space-y-1 px-3 pb-4">
          <button type="button" className={toolButtonClass} onClick={() => openShortcut("pdf")}>
            <FileText className="size-5 shrink-0" />
            <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
              Rapports PDF
            </span>
          </button>
          <button type="button" className={toolButtonClass} onClick={() => openShortcut("csv")}>
            <FileSpreadsheet className="size-5 shrink-0" />
            <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
              Export CSV
            </span>
          </button>
        </nav>

        {/* ADMINISTRATION (Conditional) */}
        {user?.role === 'admin' && (
          <>
            <div className="px-4 pb-2 mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 whitespace-nowrap">
                Administration
              </p>
            </div>
            <nav className="space-y-1 px-3 pb-4">
              {adminItems.map((item) => (
                <NavLink
                  key={`nav-${item.to}`}
                  to={item.to}
                  end={item.end}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground whitespace-nowrap"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-4 border-primary"
                >
                  <item.icon className="size-5 shrink-0" />
                  <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {item.label}
                  </span>
                </NavLink>
              ))}
            </nav>
          </>
        )}

      </div>

      <ExportParcelleShortcutDialog
        open={shortcutOpen}
        onOpenChange={handleShortcutOpenChange}
        mode={shortcutMode}
      />

      {/* Footer User Profile */}
      <div className="mt-auto border-t border-sidebar-border/50 p-4">
        {user ? (
          <div className="flex flex-col gap-3 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-primary">
                {getInitials(user.prenom)}
              </div>
              <div className="flex flex-col opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="text-sm font-semibold text-sidebar-foreground capitalize">
                  {user.nom || ''} {user.prenom || ''}
                  {(!user.nom && !user.prenom) && user.email}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {user.role === 'agriculteur' ? 'Agriculteur' : user.role} · {user.wilaya || 'Non spécifié'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:bg-sidebar-accent hover:text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              onClick={toggleTheme}
            >
              {theme === "light" ? (
                <>
                  <Moon className="mr-2 size-4" />
                  Mode sombre
                </>
              ) : (
                <>
                  <Sun className="mr-2 size-4" />
                  Mode clair
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:bg-sidebar-accent hover:text-destructive opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut className="mr-2 size-4" />
              Déconnexion
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
