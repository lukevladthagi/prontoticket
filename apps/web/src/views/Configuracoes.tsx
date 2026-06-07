"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Settings, Plus, ChevronRight, Edit2, Shield, UserCheck, UserCog, UserX, CheckCircle, XCircle, AlertCircle, RefreshCw, MessageSquare } from "lucide-react";
import type { Categoria, GrupoAtendimento, SLA, UserProfile, Unidade, Setor } from "@/shared/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import DebugSLATab from "@/components/DebugSLATab";
import { FixSLATelegram } from "@/components/FixSLATelegram";
import { CorrigirSLAReabertoMV } from "@/components/CorrigirSLAReabertoMV";
import { CorrigirSLASetores } from "@/components/CorrigirSLASetores";
import DiagnosticoProducao from "@/components/DiagnosticoProducao";

interface SetorAdicional {
  id: number;
  user_profile_id: number;
  setor_id: number;
  setor_nome: string;
  created_at: string;
}

export default function ConfiguracoesPage() {
  const { refreshProfile, profile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<'categorias' | 'grupos' | 'slas' | 'usuarios' | 'setores' | 'telegram' | 'whatsapp' | 'diagnostico' | 'diagnostico-setores' | 'diagnostico-dashboard' | 'diagnostico-colunas' | 'fix-setor-solicitante' | 'fix-telegram-null' | 'diagnostico-fechamento' | 'diagnostico-sla-nulo' | 'corrigir-sla-reclassificado' | 'debug-sla' | 'fix-sla-telegram' | 'corrigir-sla-reaberto-mv' | 'fix-manutencao-ti' | 'corrigir-sla-pausado' | 'diagnostico-ticket' | 'corrigir-sla-setores' | 'diagnostico-producao'>('usuarios');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [grupos, setGrupos] = useState<GrupoAtendimento[]>([]);
  const [slas, setSlas] = useState<SLA[]>([]);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoModal, setTipoModal] = useState<'categoria' | 'grupo' | 'sla' | 'setor'>('categoria');
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [editandoUsuario, setEditandoUsuario] = useState<UserProfile | null>(null);
  const [formUsuario, setFormUsuario] = useState({
    nome: "",
    perfil: "",
    unidade_id: null as number | null,
    setor_id: null as number | null,
    ativo: true,
  });
  
  // Estados para Telegram
  const [telegramStatus, setTelegramStatus] = useState<'loading' | 'success' | 'error' | 'not_configured'>('loading');
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [telegramErrorMessage, setTelegramErrorMessage] = useState('');
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);

  // Estados para WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState<'loading' | 'success' | 'error' | 'not_configured'>('loading');
  const [whatsappErrorMessage, setWhatsappErrorMessage] = useState('');

  // Estados para Permissões
  const [categoriasPermissoes, setCategoriasPermissoes] = useState<Record<string, any[]>>({});
  const [salvandoPermissao, setSalvandoPermissao] = useState<string | null>(null);
  const [modalPermissoes, setModalPermissoes] = useState(false);

  // Estados para Diagnóstico
  const [diagnosticoData, setDiagnosticoData] = useState<any>(null);
  const [diagnosticoLoading, setDiagnosticoLoading] = useState(false);

  // Estados para Diagnóstico de Setores
  const [diagnosticoSetoresData, setDiagnosticoSetoresData] = useState<any>(null);
  const [diagnosticoSetoresLoading, setDiagnosticoSetoresLoading] = useState(false);
  const [ticketsSelecionados, setTicketsSelecionados] = useState<number[]>([]);
  const [setorDestinoMover, setSetorDestinoMover] = useState<number | null>(null);
  const [movendoTickets, setMovendoTickets] = useState(false);

  // Estados para Diagnóstico Dashboard
  const [diagnosticoDashboardData, setDiagnosticoDashboardData] = useState<any>(null);
  const [diagnosticoDashboardLoading, setDiagnosticoDashboardLoading] = useState(false);

  // Estados para Diagnóstico de Colunas
  const [diagnosticoColunasData, setDiagnosticoColunasData] = useState<any>(null);
  const [diagnosticoColunasLoading, setDiagnosticoColunasLoading] = useState(false);

  // Estados para Setores Adicionais
  const [modalSetoresAdicionais, setModalSetoresAdicionais] = useState(false);
  const [usuarioSetoresAdicionais, setUsuarioSetoresAdicionais] = useState<UserProfile | null>(null);
  const [setoresAdicionais, setSetoresAdicionais] = useState<SetorAdicional[]>([]);
  const [loadingSetoresAdicionais, setLoadingSetoresAdicionais] = useState(false);

  useEffect(() => {
    refreshProfile();
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'telegram') {
      checkTelegramWebhookStatus();
    } else if (activeTab === 'whatsapp') {
      checkWhatsAppStatus();
    } else if (activeTab === 'diagnostico') {
      loadDiagnostico();
    } else if (activeTab === 'diagnostico-setores') {
      loadDiagnosticoSetores();
    } else if (activeTab === 'diagnostico-dashboard') {
      loadDiagnosticoDashboard();
    } else if (activeTab === 'diagnostico-colunas') {
      loadDiagnosticoColunas();
    }
  }, [activeTab]);

  useEffect(() => {
    if (modalPermissoes) {
      carregarPermissoes();
    }
  }, [modalPermissoes]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [categoriasRes, gruposRes, slasRes, usuariosRes, unidadesRes, setoresRes] = await Promise.all([
        fetch('/api/categorias/all'),
        fetch('/api/grupos'),
        fetch('/api/slas'),
        fetch('/api/user-profiles'),
        fetch('/api/unidades'),
        fetch('/api/setores')
      ]);

      if (categoriasRes.ok) setCategorias(await categoriasRes.json());
      if (gruposRes.ok) setGrupos(await gruposRes.json());
      if (slasRes.ok) setSlas(await slasRes.json());
      if (usuariosRes.ok) setUsuarios(await usuariosRes.json());
      if (unidadesRes.ok) setUnidades(await unidadesRes.json());
      if (setoresRes.ok) setSetores(await setoresRes.json());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarPermissoes = async () => {
    try {
      const response = await fetch('/api/permissoes');
      if (!response.ok) {
        console.error('Erro ao carregar permissões:', response.status);
        setCategoriasPermissoes({});
        return;
      }
      const data = await response.json();
      setCategoriasPermissoes(data.categorias || {});
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      setCategoriasPermissoes({});
    }
  };

  const loadDiagnostico = async () => {
    try {
      setDiagnosticoLoading(true);
      const response = await fetch('/api/diagnostico-chamados/verificar');
      if (response.ok) {
        const data = await response.json();
        setDiagnosticoData(data);
      }
    } catch (error) {
      console.error('Erro ao carregar diagnóstico:', error);
    } finally {
      setDiagnosticoLoading(false);
    }
  };

  const loadDiagnosticoSetores = async (retryCount = 0) => {
    try {
      setDiagnosticoSetoresLoading(true);
      const response = await fetch('/api/diagnostico-setores', {
        credentials: 'include'
      });
      
      if (response.status === 429 && retryCount < 3) {
        // Erro 429 - aguardar e tentar novamente
        const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Erro 429 - aguardando ${waitTime/1000}s antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return loadDiagnosticoSetores(retryCount + 1);
      }
      
      if (response.ok) {
        const data = await response.json();
        setDiagnosticoSetoresData(data);
        setTicketsSelecionados([]);
        setSetorDestinoMover(null);
      } else {
        const errorText = await response.text();
        console.error('Erro ao carregar diagnóstico de setores:', response.status, errorText);
        alert('Erro ao carregar diagnóstico de setores. Status: ' + response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar diagnóstico de setores:', error);
      alert('Erro ao carregar diagnóstico de setores: ' + error);
    } finally {
      setDiagnosticoSetoresLoading(false);
    }
  };

  const loadDiagnosticoDashboard = async () => {
    try {
      setDiagnosticoDashboardLoading(true);
      const response = await fetch('/api/diagnostico-dashboard/verificar', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDiagnosticoDashboardData(data);
      } else {
        const errorText = await response.text();
        console.error('Erro ao carregar diagnóstico do dashboard:', response.status, errorText);
        alert('Erro ao carregar diagnóstico do dashboard. Status: ' + response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar diagnóstico do dashboard:', error);
      alert('Erro ao carregar diagnóstico do dashboard: ' + error);
    } finally {
      setDiagnosticoDashboardLoading(false);
    }
  };

  const loadDiagnosticoColunas = async () => {
    try {
      setDiagnosticoColunasLoading(true);
      const response = await fetch('/api/diagnostico-colunas/verificar', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDiagnosticoColunasData(data);
      } else {
        const errorText = await response.text();
        console.error('Erro ao carregar diagnóstico de colunas:', response.status, errorText);
        alert('Erro ao carregar diagnóstico de colunas. Status: ' + response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar diagnóstico de colunas:', error);
      alert('Erro ao carregar diagnóstico de colunas: ' + error);
    } finally {
      setDiagnosticoColunasLoading(false);
    }
  };

  const handleMoverTickets = async () => {
    if (ticketsSelecionados.length === 0) {
      alert('Selecione pelo menos um ticket');
      return;
    }

    if (!setorDestinoMover) {
      alert('Selecione o setor de destino');
      return;
    }

    try {
      setMovendoTickets(true);
      const response = await fetch('/api/fix-setores/mover-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_ids: ticketsSelecionados,
          setor_destino_id: setorDestinoMover
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✓ ${result.total_movidos} tickets movidos para ${result.setor_destino}`);
        loadDiagnosticoSetores(); // Recarregar dados
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error}`);
      }
    } catch (error) {
      console.error('Erro ao mover tickets:', error);
      alert('Erro ao mover tickets');
    } finally {
      setMovendoTickets(false);
    }
  };

  const toggleTicketSelecionado = (ticketId: number) => {
    setTicketsSelecionados(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const selecionarTodosPorSetor = (setorId: number) => {
    if (!diagnosticoSetoresData) return;
    
    const ticketsDoSetor = diagnosticoSetoresData.tickets_problematicos
      .filter((t: any) => t.setor_destino_id === setorId)
      .map((t: any) => t.id);
    
    setTicketsSelecionados(ticketsDoSetor);
  };

  const togglePermissao = async (funcionalidadeId: number, perfil: string, permitidoAtual: boolean) => {
    const key = `${funcionalidadeId}-${perfil}`;
    setSalvandoPermissao(key);

    try {
      const response = await fetch(`/api/permissoes/${funcionalidadeId}/${perfil}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permitido: !permitidoAtual })
      });

      if (response.ok) {
        setCategoriasPermissoes(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(categoria => {
            updated[categoria] = updated[categoria].map((func: any) => {
              if (func.id === funcionalidadeId) {
                return {
                  ...func,
                  permissoes: func.permissoes.map((p: any) =>
                    p.perfil === perfil ? { ...p, permitido: !permitidoAtual } : p
                  )
                };
              }
              return func;
            });
          });
          return updated;
        });
      } else {
        alert('Erro ao atualizar permissão');
      }
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      alert('Erro ao atualizar permissão');
    } finally {
      setSalvandoPermissao(null);
    }
  };

  const getPermissao = (funcionalidade: any, perfil: string) => {
    const perm = funcionalidade.permissoes.find((p: any) => p.perfil === perfil);
    return perm ? perm.permitido : false;
  };

  const handleNovaCategoria = () => {
    setTipoModal('categoria');
    setItemSelecionado(null);
    setFormData({ nome: '', descricao: '', tipo: 'categoria', categoria_pai_id: null, setor_id: null });
    setModalAberto(true);
  };

  const handleNovaSubcategoria = (categoriaPaiId: number) => {
    setTipoModal('categoria');
    setItemSelecionado(null);
    const categoriaPai = categorias.find(c => c.id === categoriaPaiId);
    setFormData({ 
      nome: '', 
      descricao: '', 
      tipo: 'subcategoria', 
      categoria_pai_id: categoriaPaiId,
      setor_id: categoriaPai?.setor_id || null
    });
    setModalAberto(true);
  };

  const handleNovoItem = (subcategoriaId: number) => {
    setTipoModal('categoria');
    setItemSelecionado(null);
    const subcategoria = categorias.find(c => c.id === subcategoriaId);
    setFormData({ 
      nome: '', 
      descricao: '', 
      tipo: 'item', 
      categoria_pai_id: subcategoriaId,
      setor_id: subcategoria?.setor_id || null
    });
    setModalAberto(true);
  };

  const handleNovoGrupo = () => {
    setTipoModal('grupo');
    setItemSelecionado(null);
    setFormData({ nome: '', descricao: '' });
    setModalAberto(true);
  };

  const handleEditarGrupo = (grupo: GrupoAtendimento) => {
    setTipoModal('grupo');
    setItemSelecionado(grupo);
    setFormData({ nome: grupo.nome, descricao: grupo.descricao || '' });
    setModalAberto(true);
  };

  const handleNovoSLA = () => {
    setTipoModal('sla');
    setItemSelecionado(null);
    setFormData({
      nome: '',
      tipo_chamado: 'Incidente',
      prioridade: 'P1',
      tempo_resposta_minutos: 240,
      tempo_solucao_minutos: 480,
      horario_comercial: true,
      setor_id: null
    });
    setModalAberto(true);
  };

  const handleEditarSLA = (sla: SLA) => {
    setTipoModal('sla');
    setItemSelecionado(sla);
    setFormData({
      nome: sla.nome,
      tipo_chamado: sla.tipo_chamado,
      prioridade: sla.prioridade,
      tempo_resposta_minutos: sla.tempo_resposta_minutos,
      tempo_solucao_minutos: sla.tempo_solucao_minutos,
      setor_id: (sla as any).setor_id || null,
      horario_comercial: sla.horario_comercial
    });
    setModalAberto(true);
  };

  const handleNovoSetor = () => {
    setTipoModal('setor');
    setItemSelecionado(null);
    setFormData({ nome: '', descricao: '', email: '', ramal: '', ativo: true });
    setModalAberto(true);
  };

  const handleEditarSetor = (setor: Setor) => {
    setTipoModal('setor');
    setItemSelecionado(setor);
    setFormData({ 
      nome: setor.nome, 
      descricao: setor.descricao || '', 
      email: setor.email || '', 
      ramal: setor.ramal || '',
      ativo: setor.ativo !== false
    });
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let url = '';
      let method = itemSelecionado ? 'PUT' : 'POST';

      if (tipoModal === 'categoria') {
        url = itemSelecionado 
          ? `/api/categorias/${itemSelecionado.id}` 
          : '/api/categorias';
      } else if (tipoModal === 'grupo') {
        url = itemSelecionado 
          ? `/api/grupos/${itemSelecionado.id}` 
          : '/api/grupos';
      } else if (tipoModal === 'sla') {
        url = itemSelecionado 
          ? `/api/slas/${itemSelecionado.id}` 
          : '/api/slas';
      } else if (tipoModal === 'setor') {
        url = itemSelecionado 
          ? `/api/setores/${itemSelecionado.id}` 
          : '/api/setores';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchData();
        setModalAberto(false);
        setFormData({});
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar');
    }
  };

  const getCategoriasPrincipais = () => {
    return categorias.filter(c => c.tipo === 'categoria');
  };

  const getSubcategorias = (categoriaId: number) => {
    return categorias.filter(c => c.tipo === 'subcategoria' && c.categoria_pai_id === categoriaId);
  };

  const getItens = (subcategoriaId: number) => {
    return categorias.filter(c => c.tipo === 'item' && c.categoria_pai_id === subcategoriaId);
  };

  const handleEditarUsuario = (usuario: UserProfile) => {
    setEditandoUsuario(usuario);
    setFormUsuario({
      nome: usuario.nome,
      perfil: usuario.perfil,
      unidade_id: usuario.unidade_id,
      setor_id: usuario.setor_id,
      ativo: usuario.ativo,
    });
  };

  const handleSalvarUsuario = async () => {
    if (!editandoUsuario) return;

    try {
      const response = await fetch(`/api/user-profiles/${editandoUsuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formUsuario),
      });

      if (response.ok) {
        await fetchData();
        setEditandoUsuario(null);
      } else {
        alert("Erro ao atualizar usuário");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar alterações");
    }
  };

  const getPerfilIcon = (perfil: string) => {
    switch (perfil) {
      case "admin":
        return <Shield className="w-4 h-4 text-purple-600" />;
      case "gestor":
        return <UserCog className="w-4 h-4 text-blue-600" />;
      case "tecnico":
        return <UserCheck className="w-4 h-4 text-green-600" />;
      default:
        return <UserX className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPerfilBadge = (perfil: string) => {
    const classes = {
      admin: "bg-purple-100 text-purple-800",
      gestor: "bg-blue-100 text-blue-800",
      tecnico: "bg-green-100 text-green-800",
      solicitante: "bg-gray-100 text-gray-800",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes[perfil as keyof typeof classes]}`}>
        {perfil.charAt(0).toUpperCase() + perfil.slice(1)}
      </span>
    );
  };

  const handleGerenciarSetores = async (usuario: UserProfile) => {
    setUsuarioSetoresAdicionais(usuario);
    setModalSetoresAdicionais(true);
    setLoadingSetoresAdicionais(true);

    try {
      const response = await fetch(`/api/user-setores-acesso/${usuario.id}`);
      if (response.ok) {
        const data = await response.json();
        setSetoresAdicionais(data);
      }
    } catch (error) {
      console.error('Erro ao carregar setores adicionais:', error);
    } finally {
      setLoadingSetoresAdicionais(false);
    }
  };

  const handleAdicionarSetor = async (setorId: number) => {
    if (!usuarioSetoresAdicionais) return;

    try {
      const response = await fetch(`/api/user-setores-acesso/${usuarioSetoresAdicionais.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setor_id: setorId,
        }),
      });

      if (response.ok) {
        const novoSetor = await response.json();
        setSetoresAdicionais([...setoresAdicionais, novoSetor]);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erro ao adicionar setor');
      }
    } catch (error) {
      console.error('Erro ao adicionar setor:', error);
      alert('Erro ao adicionar setor');
    }
  };

  const handleRemoverSetor = async (id: number) => {
    if (!usuarioSetoresAdicionais) return;

    try {
      const response = await fetch(`/api/user-setores-acesso/${usuarioSetoresAdicionais.id}/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSetoresAdicionais(setoresAdicionais.filter(s => s.id !== id));
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erro ao remover setor');
      }
    } catch (error) {
      console.error('Erro ao remover setor:', error);
      alert('Erro ao remover setor');
    }
  };

  const checkTelegramWebhookStatus = async () => {
    try {
      setTelegramStatus('loading');
      const response = await fetch('/api/telegram/webhook-info');
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.includes('TELEGRAM_BOT_TOKEN não configurado')) {
          setTelegramStatus('not_configured');
          setTelegramErrorMessage('Token do Telegram não configurado');
        } else {
          setTelegramStatus('error');
          setTelegramErrorMessage(data.error || 'Erro ao verificar webhook');
        }
        return;
      }
      
      setWebhookInfo(data.result);
      
      if (data.result.url && data.result.url.includes('/api/telegram/webhook')) {
        setTelegramStatus('success');
      } else {
        setTelegramStatus('error');
        setTelegramErrorMessage('Webhook não está configurado corretamente');
      }
    } catch (error) {
      setTelegramStatus('error');
      setTelegramErrorMessage('Erro ao conectar com a API');
    }
  };

  const configurarTelegramWebhook = async () => {
    try {
      setIsSettingWebhook(true);
      const response = await fetch('/api/telegram/set-webhook');
      const html = await response.text();
      
      if (html.includes('Webhook Configurado com Sucesso')) {
        setTelegramStatus('success');
        await checkTelegramWebhookStatus();
      } else if (html.includes('Token não configurado')) {
        setTelegramStatus('not_configured');
        setTelegramErrorMessage('Configure o TELEGRAM_BOT_TOKEN primeiro em Settings');
      } else {
        setTelegramStatus('error');
        setTelegramErrorMessage('Erro ao configurar webhook');
      }
    } catch (error) {
      setTelegramStatus('error');
      setTelegramErrorMessage('Erro ao configurar webhook');
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      setWhatsappStatus('loading');
      const response = await fetch('/api/whatsapp/status');
      const text = await response.text();
      
      if (text.includes('Secrets não configurados')) {
        setWhatsappStatus('not_configured');
        setWhatsappErrorMessage('Secrets do WhatsApp não configurados');
      } else if (text.includes('WhatsApp Configurado')) {
        setWhatsappStatus('success');
      } else {
        setWhatsappStatus('error');
        setWhatsappErrorMessage('Erro ao verificar status');
      }
    } catch (error) {
      setWhatsappStatus('error');
      setWhatsappErrorMessage('Erro ao conectar com a API');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600">Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-indigo-600 dark:text-indigo-400" size={32} />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <div className="flex min-w-max">
              <button
                onClick={() => setActiveTab('categorias')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'categorias'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Categorias e Itens
              </button>
              <button
                onClick={() => setActiveTab('grupos')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'grupos'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Grupos de Atendimento
              </button>
              <button
                onClick={() => setActiveTab('slas')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'slas'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                SLAs
              </button>
              <button
                onClick={() => setActiveTab('setores')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'setores'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Setores
              </button>
              <button
                onClick={() => setActiveTab('usuarios')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'usuarios'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Usuários
              </button>
              <button
                onClick={() => setActiveTab('telegram')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'telegram'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare size={18} />
                Telegram
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'whatsapp'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare size={18} />
                WhatsApp
              </button>
              <button
                onClick={() => setActiveTab('diagnostico')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Diagnóstico SLA
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-setores')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-setores'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Diagnóstico de Setores
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-dashboard')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-dashboard'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-colunas')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-colunas'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Colunas
              </button>
              <button
                onClick={() => setActiveTab('fix-setor-solicitante')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'fix-setor-solicitante'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Setor Solicitante
              </button>
              <button
                onClick={() => setActiveTab('fix-telegram-null')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'fix-telegram-null'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Telegram User ID
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-fechamento')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-fechamento'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Fechamento Auto
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-sla-nulo')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-sla-nulo'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                SLA Nulo
              </button>
              <button
                onClick={() => setActiveTab('debug-sla')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'debug-sla'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Debug SLA
              </button>
              <button
                onClick={() => setActiveTab('fix-sla-telegram')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'fix-sla-telegram'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                SLA Telegram
              </button>
              <button
                onClick={() => setActiveTab('corrigir-sla-reaberto-mv')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'corrigir-sla-reaberto-mv'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <RefreshCw size={18} />
                SLA Reaberto / MV
              </button>
              <button
                onClick={() => setActiveTab('fix-manutencao-ti')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'fix-manutencao-ti'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Tipo Manutenção
              </button>
              <button
                onClick={() => setActiveTab('corrigir-sla-pausado')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'corrigir-sla-pausado'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <RefreshCw size={18} />
                SLA Pausado
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-ticket')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-ticket'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Diagnóstico Ticket
              </button>
              <button
                onClick={() => setActiveTab('corrigir-sla-setores')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'corrigir-sla-setores'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <RefreshCw size={18} />
                Corrigir SLA Setores
              </button>
              <button
                onClick={() => setActiveTab('diagnostico-producao')}
                className={`px-6 py-4 font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'diagnostico-producao'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={18} />
                Diagnóstico Produção
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Tab: Categorias */}
            {activeTab === 'categorias' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Categorias por Setor</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Organize os tipos de chamados por setor em uma hierarquia de 3 níveis
                    </p>
                  </div>
                  <button
                    onClick={handleNovaCategoria}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
                  >
                    <Plus size={20} />
                    Nova Categoria
                  </button>
                </div>

                {/* Agrupar por Setor */}
                {setores.filter(setor => ['TI', 'Hotelaria', 'Rouparia', 'Manutenção', 'Marketing', 'Comercial'].includes(setor.nome)).map((setor) => {
                  const categoriasDoSetor = getCategoriasPrincipais().filter(c => c.setor_id === setor.id);
                  if (categoriasDoSetor.length === 0) return null;
                  
                  return (
                    <div key={setor.id} className="space-y-3">
                      {/* Cabeçalho do Setor */}
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-lg">
                        <h3 className="text-lg font-bold">{setor.nome}</h3>
                      </div>

                      {/* Categorias do Setor */}
                      <div className="space-y-3 pl-4">
                        {categoriasDoSetor.map((categoria) => {
                          return (
                          <div key={categoria.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          {/* Categoria */}
                          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ChevronRight className="text-indigo-600 dark:text-indigo-400" size={20} />
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{categoria.nome}</h4>
                                {categoria.descricao && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{categoria.descricao}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleNovaSubcategoria(categoria.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                              <Plus size={16} />
                              Subcategoria
                            </button>
                          </div>

                          {/* Subcategorias */}
                          <div className="bg-white dark:bg-gray-800">
                            {getSubcategorias(categoria.id).map((subcategoria) => (
                              <div key={subcategoria.id} className="border-t border-gray-200 dark:border-gray-700">
                                <div className="p-4 pl-12 bg-purple-50 dark:bg-purple-900/30 flex items-center justify-between">
                                  <div>
                                    <h5 className="font-medium text-gray-900 dark:text-white">{subcategoria.nome}</h5>
                                    {subcategoria.descricao && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400">{subcategoria.descricao}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleNovoItem(subcategoria.id)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                                  >
                                    <Plus size={16} />
                                    Item
                                  </button>
                                </div>

                                {/* Itens */}
                                <div className="pl-20">
                                  {getItens(subcategoria.id).map((item) => (
                                    <div key={item.id} className="p-3 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <p className="text-gray-900 dark:text-white">{item.nome}</p>
                                      {item.descricao && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.descricao}</p>
                                      )}
                                    </div>
                                  ))}
                                  {getItens(subcategoria.id).length === 0 && (
                                    <div className="p-3 text-sm text-gray-500 dark:text-gray-400 italic">
                                      Nenhum item cadastrado
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {getSubcategorias(categoria.id).length === 0 && (
                              <div className="p-4 pl-12 text-sm text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-700">
                                Nenhuma subcategoria cadastrada
                              </div>
                            )}
                          </div>
                        </div>
                        );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: Grupos */}
            {activeTab === 'grupos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Grupos de Atendimento</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Defina equipes responsáveis por atender diferentes tipos de chamados
                    </p>
                  </div>
                  <button
                    onClick={handleNovoGrupo}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
                  >
                    <Plus size={20} />
                    Novo Grupo
                  </button>
                </div>

                <div className="grid gap-4">
                  {grupos.map((grupo) => (
                    <div key={grupo.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{grupo.nome}</h3>
                          {grupo.descricao && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{grupo.descricao}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleEditarGrupo(grupo)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {grupos.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <p>Nenhum grupo de atendimento cadastrado</p>
                      <p className="text-sm mt-1">Clique em "Novo Grupo" para começar</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: SLAs */}
            {activeTab === 'slas' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">SLAs Configurados</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Configure os tempos de resposta e solução por prioridade e tipo de chamado
                    </p>
                  </div>
                  <button
                    onClick={handleNovoSLA}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
                  >
                    <Plus size={20} />
                    Novo SLA
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Nome
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Setor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Prioridade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Tempo Resposta
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Tempo Solução
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Horário
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {slas.map((sla) => (
                        <tr key={sla.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 group">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {sla.nome}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {(sla as any).setor_nome || 'Geral'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              sla.prioridade === 'P1' ? 'bg-red-100 text-red-800' :
                              sla.prioridade === 'P2' ? 'bg-orange-100 text-orange-800' :
                              sla.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {sla.prioridade}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {sla.tipo_chamado}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {sla.tempo_resposta_minutos > 0 
                              ? `${Math.floor(sla.tempo_resposta_minutos / 60)}h ${sla.tempo_resposta_minutos % 60}min`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {sla.tempo_solucao_minutos >= 1440 
                              ? `${Math.floor(sla.tempo_solucao_minutos / 1440)}d ${Math.floor((sla.tempo_solucao_minutos % 1440) / 60)}h`
                              : `${Math.floor(sla.tempo_solucao_minutos / 60)}h ${sla.tempo_solucao_minutos % 60}min`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {sla.horario_comercial ? 'Comercial' : '24x7'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => handleEditarSLA(sla)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                            >
                              <Edit2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {slas.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <p>Nenhum SLA cadastrado</p>
                      <p className="text-sm mt-1">Clique em "Novo SLA" para começar</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Setores */}
            {activeTab === 'setores' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Setores do Hospital</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Configure os departamentos para direcionar chamados (TI, RH, DP, Marketing, etc.)
                    </p>
                  </div>
                  <button
                    onClick={handleNovoSetor}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
                  >
                    <Plus size={20} />
                    Novo Setor
                  </button>
                </div>

                <div className="grid gap-4">
                  {setores.map((setor) => (
                    <div key={setor.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{setor.nome}</h3>
                            {setor.ativo ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Ativo
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                Inativo
                              </span>
                            )}
                          </div>
                          {setor.descricao && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{setor.descricao}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {setor.email && (
                              <span>📧 {setor.email}</span>
                            )}
                            {setor.ramal && (
                              <span>📞 Ramal {setor.ramal}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditarSetor(setor)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {setores.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <p>Nenhum setor cadastrado</p>
                      <p className="text-sm mt-1">Clique em "Novo Setor" para começar</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: WhatsApp */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configurar WhatsApp Bot</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure o webhook do WhatsApp via Twilio para receber mensagens dos usuários
                  </p>
                </div>

                {whatsappStatus === 'loading' && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <RefreshCw className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">Verificando configuração...</p>
                    </div>
                  </div>
                )}

                {whatsappStatus === 'not_configured' && (
                  <div className="space-y-6">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">Secrets não configurados</h3>
                          <p className="text-yellow-800 dark:text-yellow-400 text-sm">
                            Configure os secrets do Twilio primeiro para ativar o WhatsApp.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white">📋 Secrets necessários:</h4>
                      <div className="space-y-3">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">TWILIO_ACCOUNT_SID</code>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Account SID do Twilio</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">TWILIO_AUTH_TOKEN</code>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Auth Token do Twilio</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">TWILIO_WHATSAPP_NUMBER</code>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Número WhatsApp (ex: whatsapp:+14155238886)</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">🔧 Como configurar:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                        <li>Clique nos 3 pontinhos (...) → Settings</li>
                        <li>Adicione os 3 secrets acima com valores do Twilio</li>
                        <li>Clique em "Save"</li>
                        <li>Volte e clique em "Verificar Novamente"</li>
                      </ol>
                    </div>

                    <button
                      onClick={checkWhatsAppStatus}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Verificar Novamente
                    </button>
                  </div>
                )}

                {whatsappStatus === 'success' && (
                  <div className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">✅ WhatsApp configurado com sucesso!</h3>
                          <p className="text-green-800 dark:text-green-400 text-sm">
                            Todos os secrets necessários estão configurados.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">🔗 Configure o Webhook no Twilio:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-400 text-sm">
                        <li>Acesse <a href="https://console.twilio.com/" target="_blank" className="underline">Twilio Console</a></li>
                        <li>Vá em: Messaging → Try it out → Send a WhatsApp message</li>
                        <li>Role até "Sandbox settings"</li>
                        <li>Em "When a message comes in", cole a URL:</li>
                      </ol>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-300 dark:border-blue-600 mt-3 mb-3">
                        <code className="text-xs text-blue-900 dark:text-blue-300 break-all">
                          {window.location.origin}/api/whatsapp/webhook
                        </code>
                      </div>
                      <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-400 text-sm" start={5}>
                        <li>Método: POST</li>
                        <li>Salve as configurações</li>
                      </ol>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-3">📱 Teste a Integração:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-purple-800 dark:text-purple-400 text-sm">
                        <li>No celular, abra WhatsApp</li>
                        <li>Envie "join slabs-gas" para +1 415 523 8886</li>
                        <li>Aguarde confirmação</li>
                        <li>Envie uma mensagem de teste</li>
                        <li>O bot deve responder automaticamente!</li>
                      </ol>
                    </div>

                    <button
                      onClick={checkWhatsAppStatus}
                      className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar Status
                    </button>
                  </div>
                )}

                {whatsappStatus === 'error' && (
                  <div className="space-y-6">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <XCircle className="w-6 h-6 text-red-600 dark:text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Erro na configuração</h3>
                          <p className="text-red-800 dark:text-red-400 text-sm">{whatsappErrorMessage}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={checkWhatsAppStatus}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Telegram */}
            {activeTab === 'telegram' && (
              <div className="space-y-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configurar Telegram Bot</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure o webhook do Telegram para receber mensagens dos usuários
                  </p>
                </div>

                {telegramStatus === 'loading' && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <RefreshCw className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">Verificando configuração...</p>
                    </div>
                  </div>
                )}

                {telegramStatus === 'not_configured' && (
                  <div className="space-y-6">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">Token não configurado</h3>
                          <p className="text-yellow-800 dark:text-yellow-400 text-sm">
                            Para ativar o webhook do Telegram, você precisa configurar o <code className="bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded">TELEGRAM_BOT_TOKEN</code> primeiro.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Passos para configurar:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                        <li>Clique nos 3 pontinhos (...) no canto superior direito</li>
                        <li>Selecione "Settings"</li>
                        <li>Procure por <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">TELEGRAM_BOT_TOKEN</code></li>
                        <li>Cole o token que o @BotFather forneceu</li>
                        <li>Clique em "Save"</li>
                        <li>Volte a esta página e clique em "Verificar Novamente"</li>
                      </ol>
                    </div>

                    <button
                      onClick={checkTelegramWebhookStatus}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Verificar Novamente
                    </button>
                  </div>
                )}

                {telegramStatus === 'error' && !telegramErrorMessage.includes('Token') && (
                  <div className="space-y-6">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <XCircle className="w-6 h-6 text-red-600 dark:text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Webhook não configurado</h3>
                          <p className="text-red-800 dark:text-red-400 text-sm">{telegramErrorMessage}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={configurarTelegramWebhook}
                      disabled={isSettingWebhook}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSettingWebhook ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Configurando...
                        </>
                      ) : (
                        'Configurar Webhook'
                      )}
                    </button>
                  </div>
                )}

                {telegramStatus === 'success' && (
                  <div className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">✅ Webhook configurado com sucesso!</h3>
                          <p className="text-green-800 dark:text-green-400 text-sm">
                            O bot do Telegram está pronto para receber mensagens dos usuários.
                          </p>
                        </div>
                      </div>
                    </div>

                    {webhookInfo && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Informações do Webhook:</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">URL:</span>
                            <code className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-xs">
                              {webhookInfo.url}
                            </code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Mensagens Pendentes:</span>
                            <span className="text-gray-900 dark:text-white font-medium">{webhookInfo.pending_update_count}</span>
                          </div>
                          {webhookInfo.last_error_date && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Último Erro:</span>
                              <span className="text-red-600 dark:text-red-400 text-xs">{webhookInfo.last_error_message}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">🎉 Próximos Passos:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-400 text-sm">
                        <li>Abra o Telegram</li>
                        <li>Procure seu bot</li>
                        <li>Envie uma mensagem teste (ex: "Olá" ou "Preciso de ajuda")</li>
                        <li>O bot deve responder usando IA!</li>
                      </ol>
                    </div>

                    <button
                      onClick={checkTelegramWebhookStatus}
                      className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar Status
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Usuários */}
            {activeTab === 'usuarios' && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gerenciamento de Usuários</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure perfis e permissões dos usuários do sistema
                  </p>
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Perfil
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Unidade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Setor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Acesso Adicional
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getPerfilIcon(usuario.perfil)}
                              <span className="font-medium text-gray-900 dark:text-white">
                                {usuario.nome}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {usuario.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getPerfilBadge(usuario.perfil)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {usuario.unidade_id
                              ? unidades.find((u) => u.id === usuario.unidade_id)?.nome || "-"
                              : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {usuario.setor_nome || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {usuario.ativo ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Ativo
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleGerenciarSetores(usuario)}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
                            >
                              <UserCog className="w-4 h-4" />
                              Gerenciar
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleEditarUsuario(usuario)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                              <Edit2 className="w-4 h-4" />
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {usuarios.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 dark:text-gray-500 mb-3">
                        <UserCog className="w-16 h-16 mx-auto mb-2 opacity-50" />
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Nenhum usuário encontrado</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Os usuários aparecerão automaticamente após fazerem login no sistema.
                        Se você acabou de adicionar este recurso, publique o app primeiro.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}


          </div>
        </div>

        {/* Modal Usuário */}
        {editandoUsuario && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editar Usuário</h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome</label>
                  <input
                    type="text"
                    value={formUsuario.nome}
                    onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={editandoUsuario.email}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Perfil <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formUsuario.perfil}
                      onChange={(e) => setFormUsuario({ ...formUsuario, perfil: e.target.value })}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="solicitante">Solicitante</option>
                      <option value="tecnico">Técnico</option>
                      <option value="gestor">Gestor</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setModalPermissoes(true)}
                      className="px-3 py-2.5 border border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-2 whitespace-nowrap"
                      title="Ver permissões por perfil"
                    >
                      <Shield className="w-4 h-4" />
                      Permissões
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Solicitante: abre chamados | Técnico: atende chamados | Gestor: configura sistema | Admin: controle total
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unidade</label>
                  <select
                    value={formUsuario.unidade_id || ""}
                    onChange={(e) =>
                      setFormUsuario({
                        ...formUsuario,
                        unidade_id: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Nenhuma</option>
                    {unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Setor</label>
                  <div className="flex gap-2">
                    <select
                      value={formUsuario.setor_id || ""}
                      onChange={(e) =>
                        setFormUsuario({
                          ...formUsuario,
                          setor_id: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Nenhum</option>
                      {setores.filter(s => s.ativo).map((setor) => (
                        <option key={setor.id} value={setor.id}>
                          {setor.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        handleNovoSetor();
                      }}
                      className="px-3 py-2.5 border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center gap-2 whitespace-nowrap"
                      title="Adicionar novo setor"
                    >
                      <Plus className="w-4 h-4" />
                      Novo
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Selecione o setor do usuário ou clique em "Novo" para adicionar um setor que não está na lista
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formUsuario.ativo}
                      onChange={(e) => setFormUsuario({ ...formUsuario, ativo: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuário ativo</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => setEditandoUsuario(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarUsuario}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {modalAberto && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {tipoModal === 'categoria' && (
                    formData.tipo === 'categoria' ? 'Nova Categoria' :
                    formData.tipo === 'subcategoria' ? 'Nova Subcategoria' :
                    'Novo Item'
                  )}
                  {tipoModal === 'grupo' && (itemSelecionado ? 'Editar Grupo' : 'Novo Grupo')}
                  {tipoModal === 'sla' && (itemSelecionado ? 'Editar SLA' : 'Novo SLA')}
                  {tipoModal === 'setor' && (itemSelecionado ? 'Editar Setor' : 'Novo Setor')}
                </h2>
              </div>

              <form onSubmit={handleSalvar} className="p-6 space-y-4">
                {/* Campos para Categoria */}
                {tipoModal === 'categoria' && (
                  <>
                    {formData.tipo === 'categoria' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Setor <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={formData.setor_id || ''}
                          onChange={(e) => setFormData({ ...formData, setor_id: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Selecione um setor</option>
                          {setores.filter(s => s.ativo).map((setor) => (
                            <option key={setor.id} value={setor.id}>
                              {setor.nome}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Selecione o setor ao qual esta categoria pertence
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nome <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={
                          formData.tipo === 'categoria' ? 'Ex: Rede' :
                          formData.tipo === 'subcategoria' ? 'Ex: Acesso à Internet' :
                          'Ex: Internet sem acesso'
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
                      <textarea
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-505 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Descrição opcional"
                      />
                    </div>
                  </>
                )}

                {/* Campos para Grupo */}
                {tipoModal === 'grupo' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nome <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ex: Suporte Nível 1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
                      <textarea
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Descreva as responsabilidades deste grupo"
                      />
                    </div>
                  </>
                )}

                {/* Campos para Setor */}
                {tipoModal === 'setor' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nome <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ex: Recursos Humanos"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
                      <textarea
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Descreva as responsabilidades deste setor"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="contato@setor.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ramal</label>
                      <input
                        type="text"
                        value={formData.ramal}
                        onChange={(e) => setFormData({ ...formData, ramal: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ex: 2001"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.ativo !== false}
                          onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Setor ativo</span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                        Setores inativos não aparecem nas opções de abertura de chamados
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.atende_ticket === true}
                          onChange={(e) => setFormData({ ...formData, atende_ticket: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Atende tickets</span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                        Setores que atendem tickets aparecem no filtro do Dashboard
                      </p>
                    </div>
                  </>
                )}

                {/* Campos para SLA */}
                {tipoModal === 'sla' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nome <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ex: SLA Crítico - Incidente"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Setor
                      </label>
                      <select
                        value={formData.setor_id || ''}
                        onChange={(e) => setFormData({ ...formData, setor_id: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Geral (todos os setores)</option>
                        {setores.filter(s => s.ativo).map((setor) => (
                          <option key={setor.id} value={setor.id}>
                            {setor.nome}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Deixe em "Geral" para aplicar a todos os setores, ou selecione um setor específico
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tipo <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={formData.tipo_chamado}
                          onChange={(e) => setFormData({ ...formData, tipo_chamado: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="Incidente">Incidente</option>
                          <option value="Requisição">Requisição</option>
                          <option value="Problema">Problema</option>
                          <option value="Mudança">Mudança</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Prioridade <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={formData.prioridade}
                          onChange={(e) => setFormData({ ...formData, prioridade: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="P1">P1 - Crítica</option>
                          <option value="P2">P2 - Alta</option>
                          <option value="P3">P3 - Média</option>
                          <option value="P4">P4 - Baixa</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tempo de Resposta (minutos)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.tempo_resposta_minutos}
                        onChange={(e) => setFormData({ ...formData, tempo_resposta_minutos: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ex: 240"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formData.tempo_resposta_minutos > 0 
                          ? `${Math.floor(formData.tempo_resposta_minutos / 60)}h ${formData.tempo_resposta_minutos % 60}min`
                          : 'Sem SLA de resposta (apenas resolução)'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tempo de Solução (minutos) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.tempo_solucao_minutos}
                        onChange={(e) => setFormData({ ...formData, tempo_solucao_minutos: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ex: 240"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {Math.floor(formData.tempo_solucao_minutos / 60)}h {formData.tempo_solucao_minutos % 60}min
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.horario_comercial}
                          onChange={(e) => setFormData({ ...formData, horario_comercial: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Considerar apenas horário comercial
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                        Se desmarcado, o SLA será calculado 24x7
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setModalAberto(false);
                      setFormData({});
                      setItemSelecionado(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    {itemSelecionado ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Permissões */}
        {modalPermissoes && (profile?.perfil === 'admin' || profile?.perfil === 'gestor') && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Controle de Permissões por Perfil</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure o que cada perfil de usuário pode acessar no sistema
                  </p>
                </div>
                <button
                  onClick={() => setModalPermissoes(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-1">Como funciona</h3>
                        <p className="text-sm text-blue-800">
                          Clique nos ícones ✓ ou ✗ para permitir ou bloquear o acesso de cada perfil às funcionalidades.
                          Admins sempre têm acesso total, independente das configurações.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tabelas de permissões por categoria */}
                  <div className="space-y-6">
                    {Object.entries(categoriasPermissoes).map(([categoria, funcionalidades]) => (
                      <div key={categoria} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                          <h2 className="font-semibold text-gray-900">{categoria}</h2>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Funcionalidade
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Solicitante
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Técnico
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Gestor
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Admin
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {funcionalidades.map((funcionalidade: any) => {
                                const PERFIS = [
                                  { value: 'solicitante', label: 'Solicitante' },
                                  { value: 'tecnico', label: 'Técnico' },
                                  { value: 'gestor', label: 'Gestor' },
                                  { value: 'admin', label: 'Admin' }
                                ];

                                return (
                                  <tr key={funcionalidade.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                      <div className="text-sm font-medium text-gray-900">{funcionalidade.nome}</div>
                                      {funcionalidade.descricao && (
                                        <div className="text-xs text-gray-500 mt-1">{funcionalidade.descricao}</div>
                                      )}
                                    </td>
                                    {PERFIS.map(perfil => {
                                      const permitido = getPermissao(funcionalidade, perfil.value);
                                      const key = `${funcionalidade.id}-${perfil.value}`;
                                      const isSalvando = salvandoPermissao === key;
                                      const isAdmin = perfil.value === 'admin';

                                      return (
                                        <td key={perfil.value} className="px-6 py-4 text-center">
                                          <button
                                            onClick={() => {
                                              if (!isAdmin && !isSalvando) {
                                                togglePermissao(funcionalidade.id, perfil.value, permitido);
                                              }
                                            }}
                                            disabled={isAdmin || isSalvando}
                                            className={`
                                              inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all
                                              ${isAdmin ? 'bg-red-100 cursor-not-allowed' : ''}
                                              ${!isAdmin && permitido ? 'bg-green-100 hover:bg-green-200' : ''}
                                              ${!isAdmin && !permitido ? 'bg-red-100 hover:bg-red-200' : ''}
                                              ${isSalvando ? 'opacity-50 cursor-wait' : ''}
                                            `}
                                            title={
                                              isAdmin
                                                ? 'Admins sempre têm acesso total'
                                                : permitido
                                                ? 'Clique para bloquear'
                                                : 'Clique para permitir'
                                            }
                                          >
                                            {isSalvando ? (
                                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                            ) : permitido || isAdmin ? (
                                              <CheckCircle className="w-5 h-5 text-green-600" />
                                            ) : (
                                              <XCircle className="w-5 h-5 text-red-600" />
                                            )}
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    {Object.keys(categoriasPermissoes).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p>Carregando permissões...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setModalPermissoes(false)}
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Diagnóstico SLA */}
        {activeTab === 'diagnostico' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico do Sistema SLA</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Verifique o status dos cálculos de SLA e identifique possíveis problemas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/corrigir-sla"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Corrigir SLAs
                </a>
                <button
                  onClick={loadDiagnostico}
                  disabled={diagnosticoLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className={diagnosticoLoading ? 'animate-spin' : ''} size={18} />
                  Atualizar
                </button>
              </div>
            </div>

            {diagnosticoLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Carregando diagnóstico...</p>
                </div>
              </div>
            ) : diagnosticoData ? (
              <>
                {/* Cards de estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total de Chamados</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{diagnosticoData.total_chamados || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Chamados Resolvidos</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{diagnosticoData.estatisticas_resolvidos?.total || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">SLA Resolução</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {diagnosticoData.sla_percentual || '--'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <RefreshCw className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Tempo Médio</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {diagnosticoData.tempo_medio_resolucao?.formatado || '--'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informações detalhadas */}
                {diagnosticoData.estatisticas_resolvidos && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Estatísticas de Resolvidos</h3>
                        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                          <li>• Total resolvidos: {diagnosticoData.estatisticas_resolvidos.total}</li>
                          <li>• Com SLA configurado: {diagnosticoData.estatisticas_resolvidos.com_sla_configurado}</li>
                          <li>• Sem prazo de solução: {diagnosticoData.estatisticas_resolvidos.sem_prazo_solucao}</li>
                          <li>• Sem data de resolução: {diagnosticoData.estatisticas_resolvidos.sem_data_resolucao}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alertas de problemas */}
                {diagnosticoData.estatisticas_resolvidos && (diagnosticoData.estatisticas_resolvidos.sem_prazo_solucao > 0 || diagnosticoData.estatisticas_resolvidos.sem_data_resolucao > 0) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">Problemas Detectados</h3>
                        <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-300">
                          {diagnosticoData.estatisticas_resolvidos.sem_prazo_solucao > 0 && (
                            <li>• {diagnosticoData.estatisticas_resolvidos.sem_prazo_solucao} chamado(s) resolvido(s) sem prazo de solução configurado</li>
                          )}
                          {diagnosticoData.estatisticas_resolvidos.sem_data_resolucao > 0 && (
                            <li>• {diagnosticoData.estatisticas_resolvidos.sem_data_resolucao} chamado(s) resolvido(s) sem data de resolução</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabela Detalhada de TODOS os Chamados */}
                {diagnosticoData.todos_chamados_detalhados && diagnosticoData.todos_chamados_detalhados.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Análise Detalhada - Todos os Chamados</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Tabela completa com todas as informações para identificar problemas de configuração
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase sticky left-0 bg-gray-50 dark:bg-gray-900">Número</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Título</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Setor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prioridade</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subcategoria</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SLA Aplicado</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tempo SLA</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prazo Solução</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data Resolução</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {diagnosticoData.todos_chamados_detalhados.map((chamado: any) => {
                            const semCategoria = !chamado.categoria_id && !chamado.subcategoria_id && !chamado.item_id;
                            const semSLA = !chamado.sla_id || !chamado.prazo_solucao;
                            const problematico = semCategoria || semSLA;

                            return (
                              <tr 
                                key={chamado.id} 
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${problematico ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                              >
                                <td className="px-4 py-3 font-mono font-semibold sticky left-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                  {chamado.numero}
                                </td>
                                <td className="px-4 py-3 max-w-xs truncate text-gray-900 dark:text-white" title={chamado.titulo}>
                                  {chamado.titulo}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                                  {chamado.setor_nome || '-'}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                    {chamado.tipo_chamado}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    chamado.prioridade === 'P1' 
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' 
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {chamado.prioridade}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {chamado.categoria_nome ? (
                                    <span className="text-gray-900 dark:text-white">{chamado.categoria_nome}</span>
                                  ) : (
                                    <span className="text-red-600 dark:text-red-400 font-semibold">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                                  {chamado.subcategoria_nome || '-'}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {chamado.item_nome ? (
                                    <span className="font-semibold text-gray-900 dark:text-white">{chamado.item_nome}</span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {chamado.sla_nome ? (
                                    <span className="text-gray-900 dark:text-white">{chamado.sla_nome}</span>
                                  ) : (
                                    <span className="text-red-600 dark:text-red-400 font-semibold">SEM SLA</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {chamado.tempo_solucao_minutos ? (
                                    <span className="font-mono text-gray-900 dark:text-white">{chamado.tempo_solucao_minutos}min</span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    chamado.status === 'Resolvido' || chamado.status === 'Fechado' 
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {chamado.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">
                                  {chamado.prazo_solucao ? (
                                    <span className="text-gray-900 dark:text-white">
                                      {new Date(chamado.prazo_solucao).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-red-600 dark:text-red-400 font-semibold">SEM PRAZO</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                  {chamado.data_resolucao ? (
                                    new Date(chamado.data_resolucao).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Clique em "Atualizar" para carregar o diagnóstico</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Diagnóstico de Setores */}
        {activeTab === 'diagnostico-setores' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico de Setores</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Verifique a distribuição de tickets por setor e identifique possíveis problemas de configuração
                </p>
              </div>
              <button
                onClick={() => loadDiagnosticoSetores()}
                disabled={diagnosticoSetoresLoading}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${diagnosticoSetoresLoading ? 'animate-spin' : ''}`} />
                {diagnosticoSetoresLoading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>

            {diagnosticoSetoresLoading ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <RefreshCw className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">Carregando diagnóstico...</p>
              </div>
            ) : diagnosticoSetoresData ? (
              <>
                {/* Resumo */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 Resumo</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 text-center">
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{diagnosticoSetoresData.tickets_sem_sla?.length || 0}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tickets SEM SLA</div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{diagnosticoSetoresData.setores?.length || 0}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Setores Ativos</div>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 text-center">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{diagnosticoSetoresData.distribuicao?.length || 0}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Setores com Tickets</div>
                    </div>
                  </div>
                </div>

                {/* Distribuição por Setor */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📈 Distribuição de Tickets (Setores com SLA Faltando)</h3>
                  <div className="space-y-2">
                    {diagnosticoSetoresData.distribuicao?.filter((item: any) => item.sem_sla > 0).map((item: any) => (
                      <div key={item.setor_destino_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">Setor {item.setor_destino_id}</span>
                          <span className="ml-2 text-gray-600 dark:text-gray-400">{item.setor_nome || 'Nome não encontrado'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {item.sem_sla} sem SLA de {item.total} tickets
                          </span>
                          <span className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-lg">
                            {Math.round((item.sem_sla / item.total) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {!diagnosticoSetoresData.distribuicao?.some((item: any) => item.sem_sla > 0) && (
                      <div className="p-6 text-center text-green-600 dark:text-green-400 font-semibold">
                        ✅ Todos os tickets têm SLA configurado!
                      </div>
                    )}
                  </div>
                </div>

                {/* Tickets SEM SLA */}
                {diagnosticoSetoresData.tickets_sem_sla?.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-orange-500 dark:border-orange-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">🔧 Tickets Sem SLA Configurado</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Esses tickets não têm prazo de resposta ou resolução definidos
                    </p>
                    
                    {/* Ferramentas de Seleção e Movimentação */}
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Setor de Destino
                          </label>
                          <select
                            value={setorDestinoMover || ''}
                            onChange={(e) => setSetorDestinoMover(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Selecione o setor...</option>
                            {diagnosticoSetoresData.setores?.map((setor: any) => (
                              <option key={setor.id} value={setor.id}>
                                {setor.id} - {setor.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <button
                            onClick={handleMoverTickets}
                            disabled={movendoTickets || ticketsSelecionados.length === 0 || !setorDestinoMover}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {movendoTickets ? 'Movendo...' : `Mover ${ticketsSelecionados.length} ticket(s)`}
                          </button>
                        </div>
                      </div>

                      {/* Botões de Seleção Rápida */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Selecionar por setor:</span>
                        {diagnosticoSetoresData.distribuicao?.filter((d: any) => d.sem_sla > 0).map((item: any) => {
                          const count = diagnosticoSetoresData.tickets_sem_sla?.filter((t: any) => t.setor_destino_id === item.setor_destino_id).length || 0;
                          if (count === 0) return null;
                          return (
                            <button
                              key={item.setor_destino_id}
                              onClick={() => selecionarTodosPorSetor(item.setor_destino_id)}
                              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded"
                            >
                              {item.setor_nome} ({count})
                            </button>
                          );
                        })}
                        {ticketsSelecionados.length > 0 && (
                          <button
                            onClick={() => setTicketsSelecionados([])}
                            className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded"
                          >
                            Limpar Seleção
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabela de Tickets */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left">
                                <input
                                  type="checkbox"
                                  checked={ticketsSelecionados.length === diagnosticoSetoresData.tickets_sem_sla?.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTicketsSelecionados(diagnosticoSetoresData.tickets_sem_sla.map((t: any) => t.id));
                                    } else {
                                      setTicketsSelecionados([]);
                                    }
                                  }}
                                  className="rounded border-gray-300 dark:border-gray-600"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Número</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Setor Atual</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo Problema</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Título</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SLA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {diagnosticoSetoresData.tickets_sem_sla.map((ticket: any) => (
                              <tr 
                                key={ticket.id}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                                  ticketsSelecionados.includes(ticket.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={ticketsSelecionados.includes(ticket.id)}
                                    onChange={() => toggleTicketSelecionado(ticket.id)}
                                    className="rounded border-gray-300 dark:border-gray-600"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                    {ticket.numero}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                    {ticket.setor_destino_id}: {ticket.setor_nome || 'Sem nome'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {ticket.tipo_problema || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs">
                                    {ticket.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 max-w-md">
                                  <div className="text-sm text-gray-700 dark:text-gray-300 truncate" title={ticket.titulo}>
                                    {ticket.titulo?.substring(0, 80) || 'Sem título'}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                  {ticket.categoria_id || '-'} / {ticket.subcategoria_id || '-'} / {ticket.item_id || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Clique em "Atualizar" para carregar o diagnóstico</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Diagnóstico Dashboard */}
        {activeTab === 'diagnostico-dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico do Dashboard</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Verifique se os números do dashboard estão corretos comparando com os valores esperados
                </p>
              </div>
              <button
                onClick={loadDiagnosticoDashboard}
                disabled={diagnosticoDashboardLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${diagnosticoDashboardLoading ? 'animate-spin' : ''}`} />
                {diagnosticoDashboardLoading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>

            {diagnosticoDashboardData ? (
              <div className="space-y-6">
                {/* Informações do Filtro */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Período Analisado</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Setor: <strong>{diagnosticoDashboardData.setor_nome}</strong> (ID: {diagnosticoDashboardData.setor_id})
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Início do mês: {new Date(diagnosticoDashboardData.inicio_mes_filtro).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Valores do Dashboard */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Valores do Dashboard
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Total:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{diagnosticoDashboardData.valores_encontrados.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Abertos:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{diagnosticoDashboardData.valores_encontrados.abertos}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Em Atendimento:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{diagnosticoDashboardData.valores_encontrados.em_atendimento}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Resolvidos:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{diagnosticoDashboardData.valores_encontrados.resolvidos}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">SLA Resposta:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{diagnosticoDashboardData.valores_encontrados.sla_resposta}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">SLA Resolução:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{diagnosticoDashboardData.valores_encontrados.sla_resolucao}</span>
                    </div>
                  </div>
                </div>

                {/* Queries Executadas */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Queries SQL Executadas</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {Object.entries(diagnosticoDashboardData.queries_executadas).map(([key, query]) => (
                      <div key={key} className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">{key.replace(/_/g, ' ')}</h4>
                        <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs text-gray-800 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
                          {String(query)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Listagem de Tickets Abertos */}
                {diagnosticoDashboardData.tickets_abertos_lista && diagnosticoDashboardData.tickets_abertos_lista.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Tickets Abertos ({diagnosticoDashboardData.tickets_abertos_lista.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Número</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data Abertura</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {diagnosticoDashboardData.tickets_abertos_lista.map((ticket: any) => (
                            <tr key={ticket.numero} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">
                                {ticket.numero}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                  {ticket.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                                {new Date(ticket.data_abertura).toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Listagem de Tickets Em Atendimento */}
                {diagnosticoDashboardData.tickets_em_atendimento_lista && diagnosticoDashboardData.tickets_em_atendimento_lista.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Tickets Em Atendimento ({diagnosticoDashboardData.tickets_em_atendimento_lista.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Número</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data Abertura</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {diagnosticoDashboardData.tickets_em_atendimento_lista.map((ticket: any) => (
                            <tr key={ticket.numero} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">
                                {ticket.numero}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                  {ticket.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                                {new Date(ticket.data_abertura).toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Clique em "Atualizar" para carregar o diagnóstico</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Diagnóstico Colunas */}
        {activeTab === 'diagnostico-colunas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico de Colunas</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Verifique a compatibilidade das colunas da tabela chamados
                </p>
              </div>
              <button
                onClick={loadDiagnosticoColunas}
                disabled={diagnosticoColunasLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${diagnosticoColunasLoading ? 'animate-spin' : ''}`} />
                {diagnosticoColunasLoading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>

            {diagnosticoColunasData ? (
              <div className="space-y-6">
                {/* Status de Compatibilidade */}
                <div className={`${diagnosticoColunasData.compatibilidade === 'OK' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'} border rounded-lg p-4`}>
                  <div className="flex items-start gap-3">
                    {diagnosticoColunasData.compatibilidade === 'OK' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <h3 className={`font-semibold ${diagnosticoColunasData.compatibilidade === 'OK' ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'} mb-1`}>
                        {diagnosticoColunasData.compatibilidade === 'OK' ? 'Banco de Dados Compatível' : 'Problemas Encontrados'}
                      </h3>
                      <p className={`text-sm ${diagnosticoColunasData.compatibilidade === 'OK' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                        Total de colunas: {diagnosticoColunasData.total_colunas_existentes} encontradas, {diagnosticoColunasData.total_colunas_esperadas} esperadas
                      </p>
                    </div>
                  </div>
                </div>

                {/* Colunas Faltando */}
                {diagnosticoColunasData.colunas_faltando && diagnosticoColunasData.colunas_faltando.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-red-50 dark:bg-red-900/20 px-6 py-3 border-b border-red-200 dark:border-red-800">
                      <h3 className="font-semibold text-red-900 dark:text-red-200">Colunas Faltando ({diagnosticoColunasData.colunas_faltando.length})</h3>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap gap-2">
                        {diagnosticoColunasData.colunas_faltando.map((col: string) => (
                          <span key={col} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded font-mono text-sm">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Colunas Extras */}
                {diagnosticoColunasData.colunas_extras && diagnosticoColunasData.colunas_extras.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 px-6 py-3 border-b border-yellow-200 dark:border-yellow-800">
                      <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">Colunas Extras ({diagnosticoColunasData.colunas_extras.length})</h3>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap gap-2">
                        {diagnosticoColunasData.colunas_extras.map((col: string) => (
                          <span key={col} className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded font-mono text-sm">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Teste de Query */}
                {diagnosticoColunasData.teste_query && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Teste de Query</h3>
                    </div>
                    <div className="p-6">
                      {diagnosticoColunasData.teste_query.sucesso ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium">Query executada com sucesso</span>
                          </div>
                          {diagnosticoColunasData.teste_query.resultado && (
                            <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs text-gray-800 dark:text-gray-300 overflow-x-auto">
                              {JSON.stringify(diagnosticoColunasData.teste_query.resultado, null, 2)}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <XCircle className="w-5 h-5" />
                            <span className="font-medium">Erro ao executar query</span>
                          </div>
                          <pre className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-xs text-red-800 dark:text-red-300 overflow-x-auto">
                            {diagnosticoColunasData.teste_query.erro}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Clique em "Atualizar" para carregar o diagnóstico</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Fix Setor Solicitante */}
        {activeTab === 'fix-setor-solicitante' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Corrigir Setor Solicitante</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Esta ferramenta preenche automaticamente o campo solicitante_setor dos chamados com base no setor do usuário solicitante
              </p>
            </div>
            <iframe 
              src="/corrigir-setor-solicitante" 
              className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Correção de Setor Solicitante"
            />
          </div>
        )}

        {activeTab === 'fix-telegram-null' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Corrigir Telegram User ID</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Esta ferramenta corrige usuários com telegram_user_id contendo o texto "null" em vez de NULL no banco de dados
              </p>
            </div>
            <iframe 
              src="/corrigir-telegram-null" 
              className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Correção de Telegram User ID"
            />
          </div>
        )}

        {activeTab === 'diagnostico-fechamento' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico de Fechamento Automático</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Visualize e force o fechamento de tickets em "Aguardando Avaliação" há mais de 2 horas sem avaliação
              </p>
            </div>
            <iframe 
              src="/diagnostico-fechamento" 
              className="w-full h-[800px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Diagnóstico de Fechamento Automático"
            />
          </div>
        )}

        {activeTab === 'diagnostico-sla-nulo' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico de SLA Nulo</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Identifique e corrija tickets sem prazos de SLA definidos (aparecendo como N/A nos relatórios)
              </p>
            </div>
            <iframe 
              src="/diagnostico-sla-nulo" 
              className="w-full h-[800px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Diagnóstico de SLA Nulo"
            />
          </div>
        )}

        {activeTab === 'debug-sla' && <DebugSLATab />}

        {activeTab === 'fix-sla-telegram' && <FixSLATelegram />}

        {activeTab === 'corrigir-sla-reaberto-mv' && <CorrigirSLAReabertoMV />}

        {activeTab === 'fix-manutencao-ti' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Corrigir Tipo "Manutenção" do TI</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Remove o tipo de problema "Manutenção" que aparecia incorretamente no TI e corrige os tickets afetados
              </p>
            </div>
            <iframe 
              src="/corrigir-manutencao-ti" 
              className="w-full h-[800px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Corrigir Tipo Manutenção do TI"
            />
          </div>
        )}

        {activeTab === 'corrigir-sla-pausado' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Corrigir SLA de Tickets Pausados</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Corrige tickets com status "Aguardando usuário" ou "Aguardando fornecedor" que estão sem o campo sla_pausado_em preenchido
              </p>
            </div>
            <iframe 
              src="/corrigir-sla-pausado" 
              className="w-full h-[800px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Corrigir SLA Pausado"
            />
          </div>
        )}

        {activeTab === 'diagnostico-ticket' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Diagnóstico de Ticket</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Visualize todos os dados e histórico completo de um ticket específico
              </p>
            </div>
            <iframe 
              src="/diagnostico-ticket" 
              className="w-full h-[800px] border border-gray-200 dark:border-gray-700 rounded-lg"
              title="Diagnóstico de Ticket"
            />
          </div>
        )}

        {activeTab === 'corrigir-sla-setores' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Corrigir SLA - Hotelaria, Manutenção e Rouparia</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Recalcula automaticamente os SLAs de tickets desses setores que estão sem prazo definido
              </p>
            </div>
            <CorrigirSLASetores />
          </div>
        )}

        {activeTab === 'diagnostico-producao' && (
          <div className="space-y-6">
            <DiagnosticoProducao />
          </div>
        )}
      </div>

      {/* Modal Setores Adicionais */}
      {modalSetoresAdicionais && usuarioSetoresAdicionais && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciar Acesso a Setores</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {usuarioSetoresAdicionais.nome} - {usuarioSetoresAdicionais.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Setor principal: <span className="font-semibold">{usuarioSetoresAdicionais.setor_nome || 'Nenhum'}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Setores Adicionais Ativos */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Setores Adicionais</h3>
                {loadingSetoresAdicionais ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    Carregando...
                  </div>
                ) : setoresAdicionais.length > 0 ? (
                  <div className="space-y-2">
                    {setoresAdicionais.map((sa) => (
                      <div
                        key={sa.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{sa.setor_nome}</span>
                        <button
                          onClick={() => handleRemoverSetor(sa.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Nenhum setor adicional configurado
                  </p>
                )}
              </div>

              {/* Adicionar Novo Setor */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Adicionar Acesso</h3>
                <div className="grid grid-cols-2 gap-2">
                  {setores
                    .filter(s => s.ativo)
                    .filter(s => s.id !== usuarioSetoresAdicionais.setor_id)
                    .filter(s => !setoresAdicionais.some(sa => sa.setor_id === s.id))
                    .map((setor) => (
                      <button
                        key={setor.id}
                        onClick={() => handleAdicionarSetor(setor.id)}
                        className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-500 transition-colors text-sm font-medium text-gray-900 dark:text-white"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        {setor.nome}
                      </button>
                    ))}
                </div>
                {setores.filter(s => s.ativo && s.id !== usuarioSetoresAdicionais.setor_id && !setoresAdicionais.some(sa => sa.setor_id === s.id)).length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Todos os setores disponíveis já foram adicionados
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setModalSetoresAdicionais(false);
                  setUsuarioSetoresAdicionais(null);
                  setSetoresAdicionais([]);
                }}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
