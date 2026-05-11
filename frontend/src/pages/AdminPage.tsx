import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Trash2, 
  UserPlus, 
  ShieldCheck, 
  Activity, 
  Database, 
  BarChart3,
  Mail,
  MapPin,
  Smartphone,
  Edit,
  X,
  Check,
  AlertCircle,
  Loader2,
  LogOut
} from 'lucide-react';
import { PlatformSidebar } from "@/components/PlatformSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface User {
  _id: string;
  nom: string;
  prenom: string;
  email: string;
  role: 'agriculteur' | 'conseiller' | 'admin';
  telephone: string;
  wilaya: string;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalParcelles: number;
  roles: { _id: string; count: number }[];
  consumptionByUser: {
    _id: string;
    email: string;
    nom: string;
    prenom: string;
    parcelCount: number;
    estimatedRequests: number;
  }[];
  geeStats: {
    estimatedMonthlyRequests: number;
    quotaLimit: number;
    status: string;
  };
}

interface AdminSidebarProps {
  activeTab: 'dashboard' | 'users' | 'quotas';
  setActiveTab: (tab: 'dashboard' | 'users' | 'quotas') => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab }) => {
  const { logout } = useAuth();
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          Admin Console
        </h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <div className="text-[10px] font-bold uppercase text-slate-500 px-3 mb-2">Principal</div>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${activeTab === 'dashboard' ? 'bg-primary/10 text-primary font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Activity className="size-4" /> Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${activeTab === 'users' ? 'bg-primary/10 text-primary font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Users className="size-4" /> Utilisateurs
        </button>
        <button 
          onClick={() => setActiveTab('quotas')}
          className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${activeTab === 'quotas' ? 'bg-primary/10 text-primary font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Database className="size-4" /> Quotas GEE
        </button>
      </nav>
      <div className="p-4 border-t border-slate-800">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
        >
          <LogOut className="mr-2 size-4" /> Déconnexion
        </Button>
      </div>
    </aside>
  );
};

const AdminPage: React.FC = () => {
  const { user: currentUser, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'quotas'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      console.log("Tentative de récupération des données admin...");
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      console.log("URL API utilisée:", apiUrl);
      
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${apiUrl}/api/admin/users`, { headers }),
        axios.get(`${apiUrl}/api/admin/stats`, { headers })
      ]);
      
      console.log("Données reçues avec succès !");
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      console.error('Erreur détaillée admin:', error);
      const errorMsg = error.response?.data?.error || error.message;
      toast.error(`Erreur: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Toutes ses parcelles seront également supprimées.')) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.delete(`${apiUrl}/api/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Utilisateur supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.put(`${apiUrl}/api/admin/users/${id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Utilisateur mis à jour');
      setIsEditing(null);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredUsers = users.filter(u => 
    u.nom.toLowerCase().includes(search.toLowerCase()) || 
    u.prenom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase";
    switch(role) {
      case 'admin': return `${base} bg-purple-500/10 text-purple-600 border border-purple-200`;
      case 'conseiller': return `${base} bg-blue-500/10 text-blue-600 border border-blue-200`;
      default: return `${base} bg-emerald-500/10 text-emerald-600 border border-emerald-200`;
    }
  };

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 size-12 text-red-500" />
          <h1 className="text-2xl font-bold">Accès Interdit</h1>
          <p className="text-muted-foreground">Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
          <Button onClick={() => window.location.href = '/'} className="mt-4">Retour au Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <header className="border-b bg-card/50 px-8 py-6 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                {activeTab === 'dashboard' && <BarChart3 className="size-7 text-primary" />}
                {activeTab === 'users' && <Users className="size-7 text-primary" />}
                {activeTab === 'quotas' && <Database className="size-7 text-primary" />}
                {activeTab === 'dashboard' && "Tableau de Bord Administrateur"}
                {activeTab === 'users' && "Gestion des Utilisateurs"}
                {activeTab === 'quotas' && "Supervision des Quotas GEE"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'dashboard' && "Surveillance globale et gestion de la plateforme."}
                {activeTab === 'users' && "Consultez et administrez les accès à la plateforme."}
                {activeTab === 'quotas' && "Analyse de la consommation des ressources Google Earth Engine."}
              </p>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm" disabled={loading} className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Activity className="mr-2 size-4" />}
              Rafraîchir
            </Button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* STATS OVERVIEW (Always visible or only in dashboard?) - Let's keep them in dashboard & quotas */}
          {(activeTab === 'dashboard' || activeTab === 'quotas') && (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Users className="size-5 text-emerald-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">{stats?.totalUsers || 0}</h3>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Total Utilisateurs</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Database className="size-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">{stats?.totalParcelles || 0}</h3>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Total Parcelles</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 col-span-1 lg:col-span-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <BarChart3 className="size-5 text-amber-600" />
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${stats?.geeStats.status === 'Normal' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                      Quota GEE: {stats?.geeStats.status || 'Chargement...'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black">{stats?.geeStats.estimatedMonthlyRequests || 0}</h3>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Requêtes / Mois</p>
                    </div>
                    <div className="space-y-2">
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500" 
                          style={{ width: `${Math.min(100, ((stats?.geeStats.estimatedMonthlyRequests || 0) / (stats?.geeStats.quotaLimit || 1)) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground font-medium uppercase opacity-60">Limite: {stats?.geeStats.quotaLimit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* USER MANAGEMENT (Only in Dashboard or Users tab) */}
          {(activeTab === 'dashboard' || activeTab === 'users') && (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
                <div>
                  <CardTitle className="font-black text-lg">Gestion des Utilisateurs</CardTitle>
                  <CardDescription className="text-xs">Consultez et administrez les accès à la plateforme.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Nom, email..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 dark:bg-slate-800 border-none h-9 text-xs focus-visible:ring-primary/20"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-muted-foreground">
                        <th className="text-left py-4 px-6">Identité</th>
                        <th className="text-left py-4 px-2">Role</th>
                        <th className="text-left py-4 px-2">Contact</th>
                        <th className="text-left py-4 px-2">Wilaya</th>
                        <th className="text-right py-4 px-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filteredUsers.map(u => (
                        <tr key={u._id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-[10px]">
                                {u.nom ? u.nom[0] : ''}{u.prenom ? u.prenom[0] : ''}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">{u.prenom} {u.nom}</div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            {isEditing === u._id ? (
                              <select 
                                value={editForm.role} 
                                onChange={(e) => setEditForm({...editForm, role: e.target.value as any})}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] font-bold"
                              >
                                <option value="agriculteur">Agriculteur</option>
                                <option value="conseiller">Conseiller</option>
                                <option value="admin">Admin</option>
                              </select>
                            ) : (
                              <span className={getRoleBadge(u.role)}>{u.role}</span>
                            )}
                          </td>
                          <td className="py-4 px-2">
                            <div className="text-muted-foreground font-medium">
                              {u.telephone || '—'}
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                              {u.wilaya || '—'}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing === u._id ? (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50">
                                    <X className="size-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleUpdate(u._id)} className="h-7 w-7 p-0 text-emerald-500 hover:bg-emerald-50">
                                    <Check className="size-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => {
                                      setIsEditing(u._id);
                                      setEditForm({ role: u.role });
                                    }}
                                  >
                                    <Edit className="size-3.5" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleDelete(u._id)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* QUOTA SPECIFIC DETAILS (Only in Quotas tab) */}
          {activeTab === 'quotas' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold">Répartition par Rôle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                        {stats?.roles?.map(r => (
                          <div key={r._id} className="flex items-center justify-between">
                            <span className="text-xs font-medium capitalize">{r._id}s</span>
                            <div className="flex items-center gap-3 flex-1 mx-4">
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${(r.count / (stats?.totalUsers || 1)) * 100}%` }} />
                                </div>
                                <span className="text-xs font-bold w-8 text-right">{r.count}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold">Santé du Système</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                        <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                          <ShieldCheck className="size-8 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">Tous les systèmes sont opérationnels</h4>
                          <p className="text-[10px] text-muted-foreground mt-1">Dernière vérification: il y a quelques secondes</p>
                        </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* PER USER CONSUMPTION TABLE */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Détail des Consommations par Utilisateur</CardTitle>
                  <CardDescription className="text-xs">Top 10 des utilisateurs générant le plus de requêtes GEE.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-muted-foreground">
                          <th className="text-left py-4 px-6">Utilisateur</th>
                          <th className="text-center py-4 px-2">Nb Parcelles</th>
                          <th className="text-center py-4 px-2">Est. Requêtes / Mois</th>
                          <th className="text-right py-4 px-6">Charge Système</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {stats?.consumptionByUser?.map(u => (
                          <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-bold">{u.prenom} {u.nom}</div>
                              <div className="text-[10px] text-muted-foreground">{u.email}</div>
                            </td>
                            <td className="py-4 px-2 text-center font-bold">{u.parcelCount}</td>
                            <td className="py-4 px-2 text-center text-primary font-bold">{u.estimatedRequests}</td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary" 
                                    style={{ width: `${Math.min(100, (u.estimatedRequests / (stats?.geeStats.quotaLimit || 1)) * 100)}%` }} 
                                  />
                                </div>
                                <span className="text-[10px] font-bold w-8">
                                  {Math.round((u.estimatedRequests / (stats?.geeStats.quotaLimit || 1)) * 100)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
