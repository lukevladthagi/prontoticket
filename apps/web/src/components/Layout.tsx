"use client";

import { useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router-shim";
import { useAuth } from "@/lib/auth-shim";
import { 
  LayoutDashboard, 
  Ticket, 
  FolderKanban, 
  FileText, 
  Package, 
  BookOpen, 
  Bell, 
  User, 
  LogOut,
  Menu,
  X,
  Settings,
  Boxes,
  ChevronDown,
  BarChart3,
  Trophy,
  Calendar,
  Wrench,
  Sun,
  Moon,
  Users,
  Star,
  TrendingUp,
  Tags,
  Building2,
  Clock
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useTheme } from "@/hooks/useTheme";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserProfile } from "@/hooks/useUserProfile";
import NewTicketAlert from "@/components/NewTicketAlert";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projetosOpen, setProjetosOpen] = useState(false);
  const [chamadosOpen, setChamadosOpen] = useState(false);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const { can } = usePermissions();
  const { profile, loading } = useUserProfile();
  const isAdmin = profile?.perfil === "admin";
  const isSetorTi = Number(profile?.setor_id) === 1;
  const canAccess = (permission?: string) => {
    if (!permission) return true;
    if (permission === "gamificacao") {
      return !loading && (isAdmin || isSetorTi || can(permission));
    }
    return can(permission);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const allNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "chamados_visualizar_todos" },
    { 
      name: "Chamados", 
      href: "/chamados", 
      icon: Ticket,
      permission: "chamados_criar",
      submenu: [
        { name: "Análise de SLA", href: "/analise-sla", icon: Clock, permission: "chamados_visualizar_todos" },
        { name: "Limpar Prazo de Atendimento", href: "/limpar-prazo-resposta", icon: Wrench, permission: "configuracoes" },
        { name: "Chamados Recorrentes", href: "/chamados-recorrentes", icon: LayoutDashboard, permission: "chamados_recorrentes" },
        { name: "Filas de Atendimento", href: "/filas", icon: Users, permission: "configuracoes" },
        { name: "Calendário de Manutenção", href: "/calendario-manutencao", icon: Calendar, permission: "manutencoes_preventivas" },
        { name: "Cronograma de Manutenção", href: "/cronograma-manutencao", icon: Wrench, permission: "manutencoes_preventivas" },
        { name: "Senhas TI", href: "/senhas-ti", icon: Settings, permission: "senhas_ti" },
        { name: "Corrigir Categorias Telegram", href: "/corrigir-categorias-telegram", icon: Tags, permission: "configuracoes" },
      ]
    },
    { 
      name: "Projetos", 
      href: "/projetos", 
      icon: FolderKanban,
      permission: "projetos_visualizar",
      submenu: [
        { name: "Dashboard de Projetos", href: "/projetos/dashboard", icon: BarChart3, permission: "projetos_visualizar" },
      ]
    },
    { name: "Contratos", href: "/contratos", icon: FileText, permission: "contratos_visualizar" },
    { name: "Ativos", href: "/ativos", icon: Package, permission: "ativos_visualizar" },
    { name: "Estoque", href: "/estoque", icon: Boxes, permission: "estoque_visualizar" },
    { name: "Base de Conhecimento", href: "/base-conhecimento", icon: BookOpen, permission: "base_conhecimento" },
    { name: "Gamificação", href: "/gamificacao", icon: Trophy, permission: "gamificacao" },
    { 
      name: "Relatórios", 
      href: "/relatorios", 
      icon: BarChart3,
      permission: "chamados_visualizar_todos",
      submenu: [
        { name: "Relatório de Tickets", href: "/relatorio-tickets", icon: FileText, permission: "chamados_visualizar_todos" },
        { name: "Relatório de Avaliações", href: "/relatorio-avaliacoes", icon: Star, permission: "chamados_visualizar_todos" },
        { name: "Relatório de Classificação", href: "/relatorio-classificacao", icon: TrendingUp, permission: "chamados_visualizar_todos" },
        { name: "Relatório de Setores", href: "/relatorio-setores", icon: Building2, permission: "chamados_visualizar_todos" },
        { name: "Relatório de Gamificação", href: "/relatorio-gamificacao", icon: Trophy, permission: "gamificacao" },
      ]
    },
    { name: "Configurações", href: "/configuracoes", icon: Settings, permission: "configuracoes" },
  ];

  // Filter navigation based on permissions
  // Aguarda o perfil carregar antes de filtrar por setor
  const navigation = allNavigation.filter(item => {
    // Gamificacao fica disponivel para admins e para usuarios do setor TI.
    if (item.permission === "gamificacao" && !canAccess("gamificacao")) {
      return false;
    }
    
    // Base de Conhecimento só para setor TI (id = 1) e Call Center (id = 14) - mas só filtra se o perfil já estiver carregado
    if (item.name === "Base de Conhecimento" && !loading && profile?.setor_id !== 1 && profile?.setor_id !== 14) {
      return false;
    }
    
    return canAccess(item.permission);
  }).map(item => {
    if (item.submenu) {
      return {
        ...item,
        submenu: item.submenu.filter(subItem => {
          // Senhas TI só para setor TI (id = 1) - mas só filtra se o perfil já estiver carregado
          if (subItem.name === "Senhas TI" && !loading && profile?.setor_id !== 1) {
            return false;
          }
          if (subItem.permission === "gamificacao") {
            return canAccess("gamificacao");
          }
          return canAccess(subItem.permission);
        })
      };
    }
    return item;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Alerta de Novos Tickets */}
      <NewTicketAlert />
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-0 left-0 right-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {sidebarOpen ? <X size={20} className="dark:text-gray-300" /> : <Menu size={20} className="dark:text-gray-300" />}
              </button>
              <Link to="/dashboard" className="flex items-center gap-3">
                <img 
                  src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/b4d52216-85e6-4a21-b93e-45671531bdd3/86fdd990-c095-4ef1-b897-339ebbb5a323.png" 
                  alt="Hospital Prontocardio" 
                  className="h-10 w-auto"
                />
                <span className="text-lg font-semibold text-gray-900 dark:text-white hidden sm:block">
                  ProntoTicket - Hospital Prontocardio
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/notificacoes"
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Bell size={20} className="text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </Link>
              
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
              >
                {theme === "light" ? (
                  <Moon size={20} className="text-gray-600" />
                ) : (
                  <Sun size={20} className="text-yellow-400" />
                )}
              </button>
              
              <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.google_user_data.name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                </div>
                <div className="relative group">
                  <button className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-medium">
                    {user?.google_user_data.name?.[0] || user?.email[0].toUpperCase()}
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <Link
                      to="/perfil"
                      className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <User size={16} />
                      Meu Perfil
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-red-600 dark:text-red-400 border-t border-gray-100 dark:border-gray-700"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-20 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.submenu?.some(sub => location.pathname.startsWith(sub.href)));
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isSubmenuOpen = item.name === "Projetos" ? projetosOpen : 
                                  item.name === "Chamados" ? chamadosOpen :
                                  item.name === "Relatórios" ? relatoriosOpen : false;
            
            return (
              <div key={item.name}>
                {hasSubmenu ? (
                  <div>
                    <button
                      onClick={() => {
                        if (item.name === "Projetos") {
                          setProjetosOpen(!projetosOpen);
                        } else if (item.name === "Chamados") {
                          setChamadosOpen(!chamadosOpen);
                        } else if (item.name === "Relatórios") {
                          setRelatoriosOpen(!relatoriosOpen);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={18} />
                        {item.name}
                      </div>
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform ${isSubmenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isSubmenuOpen && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.name !== "Relatórios" && (
                          <Link
                            to={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              location.pathname === item.href
                                ? "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                          >
                            {item.name === "Projetos" ? <FolderKanban size={16} /> : <Ticket size={16} />}
                            {item.name === "Projetos" ? "Kanban" : "Lista de Chamados"}
                          </Link>
                        )}
                        {item.submenu.map((subItem) => {
                          const isSubActive = location.pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isSubActive
                                  ? "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                              }`}
                            >
                              <subItem.icon size={16} />
                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <item.icon size={18} />
                    {item.name}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

