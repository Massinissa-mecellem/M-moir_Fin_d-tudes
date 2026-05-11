import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { conseilsApi, authApi, authClient, parcellesApi, type ConversationItem, type MessageItem, type AuthMeUser } from "@/features/parcelles/api";
import { io, Socket } from "socket.io-client";
import {
  Search,
  Send,
  FileText,
  Video,
  User,
  Map,
  Activity,
  Droplets,
  AlertTriangle,
  Paperclip,
  MoreVertical,
  Phone,
  LineChart,
  Calendar,
  Sprout,
  Leaf,
  Loader2,
  Camera,
  FileSpreadsheet,
  CloudRain,
  Wind,
  ThermometerSun,
  CloudSun,
  Waves,
  X,
  LogOut,
  Sun,
  Moon,
  MapPin,
  ArrowLeft
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/features/parcelles/StatusBadge";
import { NdviChart } from "@/features/parcelles/NdviChart";
import { getParcelleMeteo } from "@/features/parcelles/api";
import { type ParcelleDetails, type ParcelleMeteo } from "@/features/parcelles/types";
import { formatDate, formatHa, formatNumber, polygonAreaHa } from "@/features/parcelles/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const AdvisorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [farmerParcelles, setFarmerParcelles] = useState<any[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<any>(null);
  const [fullParcelDetails, setFullParcelDetails] = useState<ParcelleDetails | null>(null);
  const [parcelMeteo, setParcelMeteo] = useState<ParcelleMeteo | null>(null);
  const [fullUser, setFullUser] = useState<AuthMeUser | null>(null);

  // State management
  const [viewMode, setViewMode] = useState<'chat' | 'experts' | 'profile'>(user?.role === 'conseiller' ? 'chat' : 'experts');
  const [allExperts, setAllExperts] = useState<AuthMeUser[]>([]);
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState<AuthMeUser | null>(null);

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

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<ConversationItem | null>(null);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  const specialties = [
    "Production végétale",
    "Irrigation",
    "Maladies phytosanitaires",
    "Fertilisation et nutrition",
    "Analyse des sols",
    "Arboriculture"
  ];

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const me = await authApi.me();
        setFullUser(me);
      } catch (err) {
        console.error("Failed to load full user profile", err);
      }
      await loadConversations();
      if (user?.role === 'agriculteur') {
        await loadAllExperts();
        await loadMyParcelles();
      }
      setIsLoading(false);
    };
    init();

    socketRef.current = io(API_BASE);
    socketRef.current.on("message", (msg: MessageItem) => {
      const currentConv = selectedConvRef.current;
      if (currentConv && msg.conversation === currentConv._id) {
        setMessages(prev => [...prev, msg]);
        
        // Auto-select shared parcel for the recipient
        if (msg.text.startsWith("📢 CONTEXT_PARCEL:") && msg.sender !== user?.userId) {
          const parts = msg.text.split(":");
          if (parts.length >= 3) {
            const id = parts[1];
            const name = parts[2];
            console.log("Receiving shared parcel:", name, id);
            // On utilise un timeout pour laisser le state se stabiliser
            setTimeout(() => {
              setSelectedParcel({ _id: id, nom: name });
            }, 100);
          }
        }
      }
      loadConversations();
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv._id);
      socketRef.current?.emit("join", selectedConv._id);
      if (user?.role === 'conseiller') {
        fetchFarmerParcelles(selectedConv.farmer._id);
      }
      setViewMode('chat');
    }
  }, [selectedConv]);

  useEffect(() => {
    const parcelIdFromState = location.state?.parcelId;
    if (parcelIdFromState) {
      const fetchInitialParcel = async () => {
        try {
          const details = await parcellesApi.get(parcelIdFromState);
          setFullParcelDetails(details);
          const adaptedParcel = {
            _id: details.info._id,
            nom: details.info.nom,
            lastNdvi: details.info.ndviMoyen,
            lastNdwi: details.info.ndwiMoyen,
            stressLevel: (details.info.ndviMoyen ?? 0) < 0.3 ? 0.5 : 0
          };
          setSelectedParcel(adaptedParcel);

          const meteo = await getParcelleMeteo(parcelIdFromState);
          setParcelMeteo(meteo);
        } catch (err) {
          console.error("Failed to fetch initial parcel from state", err);
        }
      };
      fetchInitialParcel();
    }
  }, [location.state]);

  useEffect(() => {
    if (selectedParcel?._id) {
      const updateFullDetails = async () => {
        try {
          console.log("Fetching full details for parcel:", selectedParcel._id);
          // On vide pour forcer le rechargement visuel
          setFullParcelDetails(null);
          setParcelMeteo(null);
          
          const [details, meteo] = await Promise.all([
            parcellesApi.get(selectedParcel._id),
            getParcelleMeteo(selectedParcel._id)
          ]);
          
          setFullParcelDetails(details);
          setParcelMeteo(meteo);
        } catch (err) {
          console.error("Failed to update full parcel details", err);
        }
      };
      updateFullDetails();
    }
  }, [selectedParcel?._id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadAllExperts = async () => {
    try {
      const data = await conseilsApi.listExperts();
      setAllExperts(data);
    } catch (err) {
      console.error("Failed to load experts", err);
    }
  };

  const handleInitiate = async (expertId: string) => {
    console.log("Initiating conversation with expert:", expertId);
    try {
      // 1. On change la vue tout de suite pour donner un feedback visuel
      setViewMode('chat');
      
      // 2. On crée/récupère la discussion
      const conv = await conseilsApi.initiate(expertId);
      console.log("Conversation initiated:", conv._id);
      
      // 3. On met à jour l'état
      setSelectedConv(conv);
      setSelectedExpert(null);
      
      // 4. On rafraîchit la liste en arrière-plan
      loadConversations();
    } catch (err) {
      console.error("Failed to initiate conversation", err);
      // En cas d'erreur, on revient à la liste des experts
      setViewMode('experts');
    }
  };

  const fetchFarmerParcelles = async (farmerId: string) => {
    try {
      const { data } = await authClient.get(`/parcelles/farmer/${farmerId}`);
      setFarmerParcelles(data);
      if (data.length > 0) setSelectedParcel(data[0]);
    } catch (err) {
      console.error("Failed to fetch farmer parcelles", err);
    }
  };

  const loadMyParcelles = async () => {
    try {
      const data = await parcellesApi.list();
      setFarmerParcelles(data);
    } catch (err) {
      console.error("Failed to load my parcelles", err);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await conseilsApi.listConversations();
      setConversations(data);
      // Si on est un conseiller et qu'on n'a pas de conv sélectionnée, on prend la première
      if (user?.role === 'conseiller' && data.length > 0 && !selectedConv) {
        setSelectedConv(data[0]);
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await conseilsApi.getMessages(id);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedConv) return;

    try {
      await conseilsApi.sendMessage({
        conversationId: selectedConv._id,
        text: inputText
      });
      setInputText("");
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleShareParcel = async () => {
    if (!selectedParcel || !selectedConv) return;
    
    try {
      const messageText = `📢 CONTEXT_PARCEL:${selectedParcel._id}:${selectedParcel.nom}`;
      await conseilsApi.sendMessage({
        conversationId: selectedConv._id,
        text: messageText
      });
      console.log("Parcel shared:", selectedParcel.nom);
    } catch (err) {
      console.error("Failed to share parcel", err);
    }
  };

  const handleCall = async (type: 'audio' | 'video') => {
    if (!selectedConv) return;
    
    const roomId = `M-moir-${type}-${selectedConv._id}`;
    const callerName = `${fullUser?.nom} ${fullUser?.prenom}`;
    const inviteText = `📢 CALL_INVITE:${type}:${roomId}:${callerName}`;
    
    try {
      // Envoyer l'invitation dans le chat
      await conseilsApi.sendMessage({
        conversationId: selectedConv._id,
        text: inviteText
      });
      
      // Ouvrir la salle pour l'appelant
      const url = type === 'audio' 
        ? `https://meet.jit.si/${roomId}#config.startWithVideoMuted=true`
        : `https://meet.jit.si/${roomId}`;
        
      window.open(url, '_blank');
    } catch (err) {
      console.error("Failed to send call invitation", err);
    }
  };

  const getOtherUser = (conv: ConversationItem): { nom: string; prenom: string; photo: string; telephone?: string } => {
    if (!conv) return { nom: "Utilisateur", prenom: "", photo: "", telephone: "" };
    const other = user?.role === 'conseiller' ? conv.farmer : conv.advisor;
    return other || { nom: "Utilisateur", prenom: "", photo: "", telephone: "" };
  };

  const getPhotoUrl = (u: any) => {
    if (!u) return "";
    if (u.photo && (u.photo.startsWith('http') || u.photo.startsWith('data:'))) {
      return u.photo;
    }
    if (u.photo) {
      const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      return `${base}${u.photo.startsWith('/') ? '' : '/'}${u.photo}`;
    }
    return `https://ui-avatars.com/api/?name=${u.nom}+${u.prenom}&background=0D9488&color=fff&size=128`;
  };

  const filteredExperts = allExperts.filter(exp => {
    if (filterSpecialty === "all") return true;
    return exp.specialites?.includes(filterSpecialty);
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Chargement de votre espace conseil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* 1. Sidebar gauche : Liste des conversations */}
      <div className="w-[320px] border-r flex flex-col bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-primary/10 text-primary"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <h2 className="text-xl font-bold truncate">
              {user?.role === 'conseiller' ? 'Mes Agriculteurs' : 'Mes Conseils'}
            </h2>
          </div>
          <div className="flex items-center justify-between mb-4">
            {user?.role === 'agriculteur' && (
              <Button size="sm" variant="outline" className="w-full rounded-full" onClick={() => {
                setSelectedExpert(null);
                setViewMode('experts');
              }}>
                <User className="size-4 mr-2" />
                Trouver un nouvel expert
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 bg-muted/50 rounded-full border-none" placeholder="Rechercher..." />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {conversations.length === 0 && user?.role === 'conseiller' && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucun agriculteur n'a encore initié de discussion.
              </div>
            )}
            {conversations.length === 0 && user?.role === 'agriculteur' && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Vous n'avez pas encore de conversation. Cliquez sur "Trouver Expert" pour commencer.
              </div>
            )}
            {conversations.map((conv) => {
              const other = getOtherUser(conv);
              const isActive = selectedConv?._id === conv._id && viewMode === 'chat';
              return (
                <button
                  key={conv._id}
                  onClick={() => {
                    setSelectedConv(conv);
                    setViewMode('chat');
                  }}
                  className={cn(
                    "flex items-center gap-3 p-4 hover:bg-muted/30 transition-all text-left group",
                    isActive && "bg-muted/50 border-r-4 border-primary"
                  )}
                >
                  <Avatar className="size-12 border-2 border-transparent group-hover:border-primary/20 transition-all">
                    <AvatarImage src={other.photo} />
                    <AvatarFallback className="bg-primary/10 text-primary">{other.nom?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold truncate text-sm">{other.nom} {other.prenom}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {conv.lastMessage && format(new Date(conv.lastMessage.createdAt), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate italic">
                      {conv.lastMessage?.text || "Nouvelle discussion..."}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer User Profile */}
        <div className="mt-auto border-t border-border/50 p-4">
          {user ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border-2 border-primary/10">
                  <AvatarImage src={fullUser?.photo} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {user?.prenom?.[0] || user?.nom?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate capitalize">
                    {user.nom} {user.prenom}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize truncate">
                    {user.role === 'agriculteur' ? 'Agriculteur' : 'Conseiller'} · {user.wilaya || 'Algérie'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-xl",
                    viewMode === 'profile' && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setViewMode('profile')}
                >
                  <User className="mr-2 size-4" />
                  Mon Profil
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-xl"
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
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:bg-red-500/5 hover:text-red-500 rounded-xl"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Déconnexion
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Zone centrale */}
      <div className="flex-1 flex flex-col bg-background relative shadow-2xl z-10">

        {/* VUE EXPERTS (Agriculteur seulement) */}
        {viewMode === 'experts' && user?.role === 'agriculteur' && (
          <div className="flex-1 flex flex-col p-8 bg-gradient-to-br from-background to-primary/5 overflow-hidden">
            <div className="max-w-5xl mx-auto w-full space-y-8 h-full flex flex-col">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                  <Badge variant="outline" className="px-3 py-1 border-primary/30 text-primary bg-primary/5 uppercase tracking-widest text-[10px] font-bold">
                    Annuaire des Experts
                  </Badge>
                  <h1 className="text-4xl font-black tracking-tight">Trouver un conseiller</h1>
                  <p className="text-muted-foreground text-lg max-w-xl">
                    Sélectionnez un expert qualifié pour optimiser vos rendements et la santé de vos cultures.
                  </p>
                </div>

                <div className="flex flex-col gap-2 min-w-[250px]">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-primary/60 ml-1">Spécialité</label>
                  <select
                    className="bg-card border-2 border-primary/20 rounded-2xl px-6 py-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-xl shadow-primary/5 appearance-none cursor-pointer"
                    value={filterSpecialty}
                    onChange={(e) => setFilterSpecialty(e.target.value)}
                  >
                    <option value="all">Tous les experts</option>
                    {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="flex flex-col gap-4 pb-12 max-w-4xl mx-auto">
                  {filteredExperts.map((expert) => (
                    <div 
                      key={expert._id} 
                      className={cn(
                        "group relative p-6 rounded-3xl border transition-all duration-500",
                        "border-sky-200/60 dark:border-sky-800/60",
                        "bg-gradient-to-br from-white/95 via-sky-50/95 to-cyan-50/90",
                        "dark:from-slate-900/95 dark:via-sky-950/90 dark:to-cyan-950/80",
                        "shadow-xl shadow-sky-500/5 backdrop-blur-md animate-fade-in-up",
                        "hover:scale-[1.02] hover:border-primary/40",
                        "flex flex-col md:flex-row items-center gap-6"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="size-24 border-4 border-background shadow-xl group-hover:scale-105 transition-transform duration-500">
                          <AvatarImage src={expert.photo} />
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{expert.nom?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 size-6 bg-emerald-500 border-4 border-background rounded-full" />
                      </div>

                      <div className="flex-1 text-center md:text-left min-w-0">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                          <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors">{expert.nom} {expert.prenom}</h3>
                          <Badge variant="outline" className="w-fit mx-auto md:mx-0 bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold px-2 py-0">Expert Vérifié</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground flex items-center justify-center md:justify-start gap-1.5 font-bold mb-4">
                          <Map className="size-4 text-primary" /> {expert.wilaya || 'Algérie'}
                        </p>

                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                          {expert.specialites?.slice(0, 4).map(s => (
                            <Badge key={s} variant="secondary" className="bg-muted text-muted-foreground border-transparent text-[10px] px-3 py-1 font-bold rounded-full">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedExpert(expert);
                            setViewMode('profile');
                          }}
                          className="flex-1 md:flex-none rounded-2xl border-primary/20 text-primary hover:bg-primary/5 font-bold px-6 py-6 h-auto"
                        >
                          <User className="size-4 mr-2" />
                          Profil
                        </Button>
                        <Button
                          onClick={() => handleInitiate(expert._id)}
                          className="flex-1 md:flex-none rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/30 px-8 py-6 h-auto"
                        >
                          <Send className="size-4 mr-2" />
                          Consulter
                        </Button>
                      </div>
                    </div>
                  ))}

                  {filteredExperts.length === 0 && (
                    <div className="col-span-full py-24 text-center text-muted-foreground border-2 border-dashed border-primary/20 rounded-[40px] bg-card/20">
                      <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="size-10 text-primary/40" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Aucun expert disponible</h3>
                      <p>Essayez de changer de domaine d'expertise ou de Wilaya.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* VUE PROFIL */}
        {viewMode === 'profile' && (
          <div className="flex-1 flex flex-col bg-background overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full p-8 space-y-10 pb-20">

              {/* Bouton Retour (si on regarde un expert) */}
              {selectedExpert && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedExpert(null);
                    setViewMode('experts');
                  }}
                  className="mb-4 hover:bg-primary/10 text-primary font-bold w-fit"
                >
                  <ArrowLeft className="size-4 mr-2" />
                  Retour à la liste
                </Button>
              )}

              {/* Header Profil */}
              <div className="relative group">
                <div className="h-48 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-[40px] border border-primary/10 overflow-hidden relative shadow-2xl">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                </div>

                <div className="absolute -bottom-10 left-10 flex items-end gap-6">
                  <div className="relative">
                    <Avatar className="size-32 border-8 border-background shadow-2xl rounded-[35px]">
                      <AvatarImage 
                        src={getPhotoUrl(selectedExpert || fullUser)} 
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">
                        {(selectedExpert || fullUser)?.nom?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <button className="absolute bottom-2 right-2 size-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform border-4 border-background">
                      <Search className="size-5" />
                    </button>
                  </div>

                  <div className="mb-4 space-y-1">
                    <h2 className="text-3xl font-black tracking-tight">
                      {selectedExpert ? `${selectedExpert.nom} ${selectedExpert.prenom}` : `${fullUser?.nom} ${fullUser?.prenom}`}
                    </h2>
                    <Badge className="bg-emerald-500 text-white border-none px-3 py-1 font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                      {selectedExpert ? "Expert Vérifié" : fullUser?.role === 'conseiller' ? 'Conseiller Expert' : 'Agriculteur'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-20 pt-8">
                {/* Infos personnelles */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="p-6 rounded-[32px] bg-card border border-border/50 shadow-soft">
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                      <Activity className="size-4" /> Informations
                    </h3>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                        <div className="p-3 bg-muted/30 rounded-2xl text-sm font-medium border border-border/20">
                          {selectedExpert ? selectedExpert.email : fullUser?.email}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Téléphone</label>
                        <div className="p-3 bg-muted/30 rounded-2xl text-sm font-medium border border-border/20">
                          {selectedExpert ? (selectedExpert.telephone || "—") : (fullUser?.telephone || "—")}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Wilaya</label>
                        <div className="p-3 bg-muted/30 rounded-2xl text-sm font-medium border border-border/20">
                          {selectedExpert ? (selectedExpert.wilaya || "Algérie") : (fullUser?.wilaya || "Algérie")}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Spécialités</label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(selectedExpert || fullUser)?.specialites?.map(s => (
                            <Badge key={s} variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-bold px-2.5 py-1">
                              {s}
                            </Badge>
                          ))}
                          {(!(selectedExpert || fullUser)?.specialites || (selectedExpert || fullUser)?.specialites?.length === 0) && (
                            <span className="text-xs text-muted-foreground italic">Aucune spécialité</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!selectedExpert && (
                      <Button variant="outline" className="w-full mt-8 rounded-2xl border-primary/20 text-primary font-bold hover:bg-primary/5">
                        Modifier Profil
                      </Button>
                    )}
                  </div>
                </div>

                {/* Publications et Feed */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Zone de Publication - Uniquement pour le propriétaire du profil s'il est expert */}
                  {!selectedExpert && user?.role === 'conseiller' && (
                    <div className="p-6 rounded-[32px] bg-card border-2 border-primary/10 shadow-xl shadow-primary/5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                        <Send className="size-4" /> Publier un conseil
                      </h3>
                      <textarea
                        placeholder="Partagez votre expertise avec la communauté..."
                        className="w-full bg-muted/30 border-none focus:ring-0 rounded-2xl p-4 min-h-[120px] text-sm font-medium resize-none mb-4"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="rounded-xl text-primary hover:bg-primary/10">
                            <Paperclip className="size-5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="rounded-xl text-primary hover:bg-primary/10">
                            <Map className="size-5" />
                          </Button>
                        </div>
                        <Button className="rounded-2xl bg-primary px-8 font-black shadow-lg shadow-primary/20">
                          Publier
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Feed Mock */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-4">Vos dernières publications</h3>

                    <div className="p-6 rounded-[32px] bg-card/40 border border-border/50 space-y-4 hover:bg-card transition-colors duration-300">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border-2 border-primary/20">
                          <AvatarImage src={getPhotoUrl(selectedExpert || fullUser)} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {(selectedExpert || fullUser)?.nom?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold">
                            {(selectedExpert || fullUser)?.nom} {(selectedExpert || fullUser)?.prenom}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold">Il y a 2 heures</p>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Il est important de surveiller l'indice NDWI pendant cette période de chaleur intense.
                        N'hésitez pas à augmenter la fréquence d'irrigation sur les parcelles de blé pour éviter le stress hydrique.
                      </p>
                      <div className="h-48 w-full bg-muted/20 rounded-2xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground/40 italic group hover:bg-muted/30 transition-all">
                        [ Espace Image Publication ]
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VUE CHAT */}
        {viewMode === 'chat' && (
          <>
            {selectedConv ? (
              <>
                <div className="p-4 border-b flex items-center justify-between bg-card/30 backdrop-blur-md sticky top-0 z-20">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12 border-2 border-primary/20">
                      <AvatarImage src={getOtherUser(selectedConv).photo} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getOtherUser(selectedConv).nom?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-base leading-tight">{getOtherUser(selectedConv).nom} {getOtherUser(selectedConv).prenom}</h3>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Connecté</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => handleCall('audio')}
                      className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 shadow-sm"
                    >
                      <Phone className="size-5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => handleCall('video')}
                      className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 shadow-sm"
                    >
                      <Video className="size-5" />
                    </Button>
                    <Separator orientation="vertical" className="h-8 mx-2" />
                    <Button variant="ghost" size="icon" className="rounded-xl"><MoreVertical className="size-5" /></Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-6 bg-muted/10" ref={scrollRef}>
                  <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                    {messages.map((msg, idx) => {
                      const isMe = msg.sender === user?.userId;
                      return (
                        <div
                          key={msg._id || idx}
                          className={cn(
                            "flex max-w-[85%] flex-col gap-1.5",
                            isMe ? "self-end items-end" : "self-start items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-3xl px-5 py-3 text-sm shadow-sm",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-tr-sm font-medium shadow-primary/20"
                                : "bg-card text-foreground border border-border/50 rounded-tl-sm"
                            )}
                          >
                             {msg.text.startsWith("📢 CALL_INVITE:") ? (
                              <div className={cn(
                                "p-4 rounded-2xl border flex flex-col gap-3 min-w-[240px]",
                                isMe ? "bg-white/10 border-white/20" : "bg-primary/5 border-primary/20"
                              )}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "size-10 rounded-2xl flex items-center justify-center animate-pulse",
                                    msg.text.split(":")[1] === 'video' ? "bg-purple-500/20 text-purple-600" : "bg-blue-500/20 text-blue-600"
                                  )}>
                                    {msg.text.split(":")[1] === 'video' ? <Video className="size-5" /> : <Phone className="size-5" />}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                      {msg.text.split(":")[1] === 'video' ? "Appel Vidéo" : "Appel Audio"}
                                    </p>
                                    <p className="text-sm font-bold truncate">
                                      {isMe ? "Appel lancé..." : `Appel de ${msg.text.split(":")[3]}`}
                                    </p>
                                  </div>
                                </div>
                                <Button 
                                  variant={isMe ? "outline" : "default"}
                                  size="sm" 
                                  className={cn(
                                    "w-full rounded-xl font-bold h-10",
                                    !isMe && "bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-lg shadow-emerald-500/20"
                                  )}
                                  onClick={() => {
                                    const parts = msg.text.split(":");
                                    const roomId = parts[2];
                                    const type = parts[1];
                                    const url = type === 'audio' 
                                      ? `https://meet.jit.si/${roomId}#config.startWithVideoMuted=true`
                                      : `https://meet.jit.si/${roomId}`;
                                    window.open(url, '_blank');
                                  }}
                                >
                                  {isMe ? "Rejoindre à nouveau" : "Décrocher / Rejoindre"}
                                </Button>
                              </div>
                            ) : msg.text.startsWith("📢 CONTEXT_PARCEL:") ? (
                              <div className={cn(
                                "p-3 rounded-2xl border flex flex-col gap-2",
                                isMe ? "bg-white/10 border-white/20" : "bg-emerald-500/5 border-emerald-500/20"
                              )}>
                                <div className="flex items-center gap-2">
                                  <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <Activity className="size-4 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Données de Parcelle</p>
                                    <p className="text-sm font-bold">{msg.text.split(":")[2]}</p>
                                  </div>
                                </div>
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="w-full rounded-xl h-8 text-[10px] font-black uppercase bg-emerald-500 text-white hover:bg-emerald-600 border-none"
                                  onClick={async () => {
                                    const parts = msg.text.split(":");
                                    if (parts.length >= 3) {
                                      const pId = parts[1];
                                      const pNom = parts[2];
                                      console.log("Forcing analysis load for:", pNom);
                                      setSelectedParcel({ _id: pId, nom: pNom });
                                      try {
                                        setFullParcelDetails(null);
                                        const [details, meteo] = await Promise.all([
                                          parcellesApi.get(pId),
                                          getParcelleMeteo(pId)
                                        ]);
                                        setFullParcelDetails(details);
                                        setParcelMeteo(meteo);
                                      } catch (e) {
                                        console.error("Error loading shared analysis:", e);
                                      }
                                    }
                                  }}
                                >
                                  Voir l'analyse complète
                                </Button>
                              </div>
                            ) : (
                              msg.text
                            )}
                            {msg.fileUrl && (
                              <div className={cn(
                                "mt-3 p-3 rounded-2xl flex items-center gap-3 border transition-colors cursor-pointer",
                                isMe ? "bg-black/20 border-white/10 hover:bg-black/30" : "bg-muted/50 border-border hover:bg-muted"
                              )}>
                                <div className="size-10 rounded-xl bg-background/20 flex items-center justify-center shrink-0">
                                  <FileText className="size-5" />
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-xs font-bold truncate">{msg.fileName || "Document"}</p>
                                  <p className="text-[10px] opacity-70">PDF · 1.2 MB</p>
                                </div>
                                <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-black underline p-2">VOIR</a>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground px-2 uppercase tracking-tighter">
                            {format(new Date(msg.createdAt), 'HH:mm')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className="p-6 border-t bg-card/50 backdrop-blur-md">
                  <div className="flex items-center gap-3 max-w-4xl mx-auto bg-muted/50 p-2 rounded-[30px] border border-border/50 shadow-inner">
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-11 w-11">
                      <Paperclip className="size-5" />
                    </Button>
                    {user?.role === 'agriculteur' && selectedParcel && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleShareParcel}
                        className="shrink-0 rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors h-11 w-11"
                        title="Transmettre les données de la parcelle"
                      >
                        <Activity className="size-5" />
                      </Button>
                    )}
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Décrivez votre problème ou posez une question..."
                      className="flex-1 bg-transparent border-none focus-visible:ring-0 shadow-none h-11 text-sm font-medium"
                    />
                    <Button
                      onClick={handleSend}
                      size="icon"
                      className="shrink-0 rounded-full h-11 w-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30"
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="relative">
                  <div className="size-32 bg-primary/5 rounded-full flex items-center justify-center animate-pulse">
                    <Send className="size-12 text-primary/20" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 size-12 bg-card border-2 border-primary/20 rounded-2xl flex items-center justify-center shadow-xl">
                    <Activity className="size-6 text-primary" />
                  </div>
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-xl font-bold">Sélectionnez une discussion</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Cliquez sur un contact pour démarrer l'échange ou trouver un expert pour vous accompagner.
                  </p>
                </div>
                {user?.role === 'agriculteur' && (
                  <Button variant="outline" className="rounded-2xl border-primary/30 text-primary font-bold px-8 py-6" onClick={() => setViewMode('experts')}>
                    Trouver un nouvel expert
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Panneau droit : Infos analytiques */}
      <div className="w-[380px] border-l bg-card/30 flex flex-col shadow-inner overflow-hidden">
        {fullParcelDetails ? (
          <>
            <div className="relative bg-gradient-primary px-6 py-8 text-primary-foreground">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                <MapPin className="size-3.5" />
                Parcelle Agricole
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{fullParcelDetails.info.nom}</h2>
              <div className="mt-4">
                <StatusBadge
                  ndvi={fullParcelDetails.info.ndviMoyen}
                  size="sm"
                  className="border-white/30 bg-white/20 text-white"
                />
              </div>

              {farmerParcelles.length > 1 && (
                <div className="mt-6">
                  <select
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-[11px] font-bold outline-none transition-all text-white"
                    value={selectedParcel?._id}
                    onChange={(e) => setSelectedParcel(farmerParcelles.find(p => p._id === e.target.value))}
                  >
                    {farmerParcelles.map(p => (
                      <option key={p._id} value={p._id} className="text-foreground">{p.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoTile
                    icon={<Calendar className="size-4" />}
                    label="Créée le"
                    value={formatDate(fullParcelDetails.info.createdAt)}
                  />
                  <InfoTile
                    icon={<Sprout className="size-4" />}
                    label="Culture"
                    value={fullParcelDetails.info.cultureType ?? "—"}
                  />
                  <InfoTile
                    icon={<MapPin className="size-4" />}
                    label="Surface"
                    value={formatHa(fullParcelDetails.info.surface ?? polygonAreaHa(fullParcelDetails.info.geometry))}
                  />
                  <InfoTile
                    icon={<Camera className="size-4" />}
                    label="Dernière Capture"
                    value={fullParcelDetails.latestSentinelImageDate ? formatDate(fullParcelDetails.latestSentinelImageDate) : "—"}
                  />
                </div>

                <Separator className="opacity-50" />

                {/* Indices */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Indices de Vigueur
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <IndexCard
                      label="NDVI"
                      value={formatNumber(fullParcelDetails.info.ndviMoyen, 3)}
                      sub="Végétation"
                      icon={<Leaf className="size-4" />}
                      accent="ndvi"
                    />
                    <IndexCard
                      label="NDWI"
                      value={formatNumber(fullParcelDetails.info.ndwiMoyen, 3)}
                      sub="Hydratation"
                      icon={<Droplets className="size-4" />}
                      accent="ndwi"
                    />
                    <IndexCard
                      label="SAVI"
                      value={formatNumber(fullParcelDetails.info.saviMoyen, 3)}
                      sub="Sol Aride"
                      icon={<Sprout className="size-4" />}
                      accent="savi"
                    />
                    <IndexCard
                      label="GNDVI"
                      value={formatNumber(fullParcelDetails.info.gndviMoyen, 3)}
                      sub="Chlorophylle"
                      icon={<Waves className="size-4" />}
                      accent="gndvi"
                    />
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Météo */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Météo Opérationnelle
                  </h3>
                  {parcelMeteo ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoTile
                          icon={<CloudRain className="size-4 text-sky-500" />}
                          label="Pluie (7j)"
                          value={`${parcelMeteo.rainfallLast7DaysMm.toFixed(1)} mm`}
                        />
                        <InfoTile
                          icon={<ThermometerSun className="size-4 text-amber-500" />}
                          label="ETP Jour"
                          value={parcelMeteo.currentDay?.etp != null ? `${parcelMeteo.currentDay.etp.toFixed(1)} mm/j` : "—"}
                        />
                      </div>
                      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-sky-500/5 p-4">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prévisions (Min/Max)</p>
                        <div className="space-y-2">
                          {[parcelMeteo.currentDay, ...parcelMeteo.next5Days].filter(Boolean).map((day) => (
                            <div key={day!.date} className="flex items-center justify-between text-xs">
                              <span className="font-bold text-muted-foreground">{formatDate(day!.date)}</span>
                              <span className="font-black text-foreground">
                                {day!.tempMin?.toFixed(0)}° / {day!.tempMax?.toFixed(0)}°
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">Données météo en cours de synchronisation...</p>
                  )}
                </div>

                <Separator className="opacity-50" />

                {/* Évolution */}
                <div className="space-y-4 pb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Évolution Temporelle
                  </h3>
                  <div className="h-48 bg-card/50 rounded-2xl p-2 border border-border/50">
                    <NdviChart data={fullParcelDetails.analytics ?? []} />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="relative">
              <div className="size-32 bg-primary/5 rounded-full flex items-center justify-center animate-pulse">
                <LineChart className="size-12 text-primary/20" />
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="text-xl font-bold">Analyse indisponible</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Sélectionnez une discussion ou transmettez une parcelle depuis votre tableau de bord pour voir les analyses ici.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Reusable Helper Components
const InfoTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-2xl border border-border bg-card/50 p-3 hover:bg-card transition-colors duration-200">
    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="mt-1 truncate text-xs font-bold text-foreground">{value}</div>
  </div>
);

const IndexCard = ({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) => {
  const getStyles = () => {
    switch (accent) {
      case "ndvi": return "border-emerald-500/20 bg-emerald-500/5 text-emerald-600";
      case "ndwi": return "border-sky-500/20 bg-sky-500/5 text-sky-600";
      case "savi": return "border-amber-500/20 bg-amber-500/5 text-amber-600";
      case "gndvi": return "border-purple-500/20 bg-purple-500/5 text-purple-600";
      default: return "border-border bg-muted/5 text-foreground";
    }
  };
  const styles = getStyles();
  return (
    <div className={cn("rounded-2xl border p-3 transition-transform hover:scale-[1.02]", styles.split(' ').slice(0, 2).join(' '))}>
      <div className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", styles.split(' ').pop())}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-black tracking-tight text-foreground">{value}</div>
      <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">{sub}</div>
    </div>
  );
};

export default AdvisorPage;
