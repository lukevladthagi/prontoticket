"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import ChatBox from "@/components/ChatBox";
import HistoricoDetalhado from "@/components/HistoricoDetalhado";
import { ArrowLeft, Clock, User, Star, MessageSquare, UserCheck, Paperclip, Download, FileText, Image } from "lucide-react";
import { useAuth } from "@/lib/auth-shim";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { Chamado, StatusChamado, AvaliacaoChamadoDTO, UserProfile } from "@/shared/types";
import { getTiposProblemaParaSetor } from "@/shared/tipos-problema-setor";
import { formatarDataHoraBrasil } from "@/utils/timezone";

interface Anexo {
  id: number;
  chamado_id: number;
  nome_arquivo: string;
  url: string;
  tipo_arquivo: string;
  tamanho: number;
  autor_id: string;
  created_at: string;
}

export default function ChamadoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [setorDestino, setSetorDestino] = useState<{ nome: string } | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  const [mostrarModalResolucao, setMostrarModalResolucao] = useState(false);
  const [resolvendo, setResolvendo] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [mostrarModalTransferencia, setMostrarModalTransferencia] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [tecnicos, setTecnicos] = useState<UserProfile[]>([]);
  const [transferencia, setTransferencia] = useState({
    novo_tecnico_id: '',
    motivo: '',
  });
  const [mostrarModalReabertura, setMostrarModalReabertura] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [mostrarModalAgendamento, setMostrarModalAgendamento] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [agendamento, setAgendamento] = useState({
    data_agendamento: '',
    observacoes_agendamento: '',
  });
  const [mostrarModalReclassificacao, setMostrarModalReclassificacao] = useState(false);
  const [reclassificando, setReclassificando] = useState(false);
  const [reclassificacao, setReclassificacao] = useState({
    tipo: '',
    tipo_problema: '',
    categoria_id: null as number | null,
    subcategoria_id: null as number | null,
    item_id: null as number | null,
    setor_destino_id: null as number | null,
    impacto: '',
    urgencia: '',
  });
  const [prioridadeAutomaticaReclassificacao, setPrioridadeAutomaticaReclassificacao] = useState<string | null>(null);
  const [tiposProblemaDisponiveis, setTiposProblemaDisponiveis] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [avaliacao, setAvaliacao] = useState<AvaliacaoChamadoDTO>({
    nota: 5,
    resolveu: true,
  });
  const [resolucao, setResolucao] = useState({
    solucao: '',
    adicionarKB: false,
    tituloKB: '',
    palavrasChave: '',
  });
  const [mostrarModalTelegram, setMostrarModalTelegram] = useState(false);
  const [mensagemTelegram, setMensagemTelegram] = useState('');
  const [enviandoTelegram, setEnviandoTelegram] = useState(false);
  const [mostrarModalPausarSLA, setMostrarModalPausarSLA] = useState(false);
  const [motivoPausaSLA, setMotivoPausaSLA] = useState('');
  const [pausandoSLA, setPausandoSLA] = useState(false);
  const [retomandoSLA, setRetomandoSLA] = useState(false);
  const [editandoClassificacao, setEditandoClassificacao] = useState(false);
  const [salvandoClassificacao, setSalvandoClassificacao] = useState(false);
  const [classificacaoEditada, setClassificacaoEditada] = useState({
    tipo_problema: '',
    categoria_id: null as number | null,
  });
  const [mostrarModalProjeto, setMostrarModalProjeto] = useState(false);
  const [marcandoProjeto, setMarcandoProjeto] = useState(false);
  const [dadosProjeto, setDadosProjeto] = useState({
    nome_projeto: '',
    descricao_projeto: '',
    escopo: '',
  });

  useEffect(() => {
    if (id) {
      // Carregar dados principais primeiro
      fetchChamado();
      fetchAnexos();
      
      // Carregar dados secundários com delay para evitar sobrecarga
      setTimeout(() => {
        fetchTecnicos();
        fetchCategorias();
      }, 300);
      
      // Buscar tipos de problema para TI
      const tipos = getTiposProblemaParaSetor('TI');
      setTiposProblemaDisponiveis(tipos);
    }
  }, [id]);

  useEffect(() => {
    if (chamado?.setor_destino_id) {
      fetchSetorDestino(chamado.setor_destino_id);
    }
  }, [chamado?.setor_destino_id]);

  useEffect(() => {
    console.log('User:', user);
    console.log('Profile loading:', profileLoading);
    console.log('Profile:', profile);
  }, [user, profile, profileLoading]);

  const fetchChamado = async () => {
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setChamado(data);
        
        // Preencher dados de reclassificação com os valores atuais
        setReclassificacao({
          tipo: data.tipo || '',
          tipo_problema: data.titulo || '',
          categoria_id: data.categoria_id || null,
          subcategoria_id: data.subcategoria_id || null,
          item_id: data.item_id || null,
          setor_destino_id: data.setor_destino_id || null,
          impacto: data.impacto || '',
          urgencia: data.urgencia || '',
        });
        
        // Mostrar avaliação para o solicitante quando o chamado estiver resolvido ou fechado (sem avaliação)
        if (user && data.solicitante_id === user.id && 
            (data.status === 'Resolvido' || data.status === 'Fechado') && 
            !data.avaliacao_nota) {
          setMostrarAvaliacao(true);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar chamado:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnexos = async () => {
    try {
      const response = await fetch(`/api/anexos/chamado/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnexos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar anexos:", error);
    }
  };

  const fetchTecnicos = async () => {
    try {
      const response = await fetch('/api/user-profiles', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Filtrar apenas técnicos, gestores e admins ativos
        // Excluir contas criadas automaticamente pelo Telegram (email começa com "telegram_")
        const tecnicosDisponiveis = data.filter((u: UserProfile) => 
          u.perfil !== 'solicitante' && u.ativo && !u.email.startsWith('telegram_')
        );
        setTecnicos(tecnicosDisponiveis);
      }
    } catch (error) {
      console.error("Erro ao buscar técnicos:", error);
    }
  };

  const fetchCategorias = async () => {
    try {
      // Buscar apenas categorias da TI para reclassificação
      const response = await fetch('/api/categorias?setor_id=1', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCategorias(data);
      }
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    }
  };

  const fetchSetorDestino = async (setorId: number) => {
    try {
      const response = await fetch(`/api/setores/${setorId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSetorDestino(data);
      }
    } catch (error) {
      console.error("Erro ao buscar setor:", error);
    }
  };



  const formatarTamanhoArquivo = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getIconeArquivo = (tipoArquivo: string) => {
    if (tipoArquivo.startsWith('image/')) {
      return <Image size={20} className="text-blue-600" />;
    }
    return <FileText size={20} className="text-gray-600" />;
  };

  const handleDownloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      alert('Erro ao baixar arquivo. Tente novamente.');
    }
  };

  const handleAvaliar = async () => {
    try {
      console.log('Enviando avaliação:', avaliacao);
      const response = await fetch(`/api/chamados/${id}/avaliacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(avaliacao),
      });

      console.log('Resposta da avaliação:', response.status);
      
      if (response.ok) {
        setMostrarAvaliacao(false);
        
        // Se o usuário confirmou que o problema foi resolvido, fechar automaticamente
        if (avaliacao.resolveu) {
          await fetch(`/api/chamados/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({ status: 'Fechado' }),
          });
        }
        
        fetchChamado();
        alert('Avaliação enviada com sucesso!');
      } else {
        const errorData = await response.text();
        console.error('Erro ao enviar avaliação:', errorData);
        alert(`Erro ao enviar avaliação: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error("Erro ao avaliar chamado:", error);
      alert('Erro de conexão ao enviar avaliação. Verifique sua internet.');
    }
  };

  const handleAssumirChamado = async () => {
    if (!user?.id) return;
    
    setAssumindo(true);
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          tecnico_responsavel_id: user.id,
          status: 'Em atendimento'
        }),
      });

      if (response.ok) {
        await fetchChamado();
      }
    } catch (error) {
      console.error("Erro ao assumir chamado:", error);
    } finally {
      setAssumindo(false);
    }
  };

  const handleResolverChamado = async () => {
    if (!resolucao.solucao.trim()) {
      alert('Por favor, descreva a solução aplicada.');
      return;
    }

    setResolvendo(true);
    try {
      // Atualizar chamado com a solução
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Resolvido',
          solucao: resolucao.solucao,
        }),
      });

      if (response.ok) {
        // Se marcou para adicionar ao KB, criar artigo
        if (resolucao.adicionarKB && chamado) {
          await fetch('/api/artigos-kb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              titulo: resolucao.tituloKB || chamado.titulo,
              conteudo: `**Problema:**\n${chamado.descricao}\n\n**Solução:**\n${resolucao.solucao}`,
              categoria_id: chamado.categoria_id,
              palavras_chave: resolucao.palavrasChave,
            }),
          });
        }

        setMostrarModalResolucao(false);
        setResolucao({
          solucao: '',
          adicionarKB: false,
          tituloKB: '',
          palavrasChave: '',
        });
        await fetchChamado();
      }
    } catch (error) {
      console.error("Erro ao resolver chamado:", error);
      alert('Erro ao resolver chamado. Tente novamente.');
    } finally {
      setResolvendo(false);
    }
  };

  const handleFecharChamado = async () => {
    if (!confirm('Tem certeza que deseja fechar este chamado? Esta ação não poderá ser desfeita.')) {
      return;
    }

    setFechando(true);
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Fechado',
        }),
      });

      if (response.ok) {
        await fetchChamado();
      }
    } catch (error) {
      console.error("Erro ao fechar chamado:", error);
      alert('Erro ao fechar chamado. Tente novamente.');
    } finally {
      setFechando(false);
    }
  };

  const handleTransferirChamado = async () => {
    if (!transferencia.novo_tecnico_id) {
      alert('Por favor, selecione um técnico.');
      return;
    }

    if (chamado?.tecnico_responsavel_id === transferencia.novo_tecnico_id) {
      alert('O chamado já está atribuído a este técnico.');
      return;
    }

    setTransferindo(true);
    try {
      const response = await fetch(`/api/chamados/${id}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(transferencia),
      });

      if (response.ok) {
        setMostrarModalTransferencia(false);
        setTransferencia({
          novo_tecnico_id: '',
          motivo: '',
        });
        await fetchChamado();
        alert('Chamado transferido com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao transferir chamado.');
      }
    } catch (error) {
      console.error("Erro ao transferir chamado:", error);
      alert('Erro ao transferir chamado. Tente novamente.');
    } finally {
      setTransferindo(false);
    }
  };

  const handleReabrirChamado = async () => {
    setReabrindo(true);
    try {
      const response = await fetch(`/api/chamados/${id}/reabrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ motivo: motivoReabertura }),
      });

      if (response.ok) {
        setMostrarModalReabertura(false);
        setMotivoReabertura('');
        await fetchChamado();
        alert('Chamado reaberto com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao reabrir chamado.');
      }
    } catch (error) {
      console.error("Erro ao reabrir chamado:", error);
      alert('Erro ao reabrir chamado. Tente novamente.');
    } finally {
      setReabrindo(false);
    }
  };

  const handleEnviarMensagemTelegram = async () => {
    if (!mensagemTelegram.trim()) {
      alert('Por favor, digite uma mensagem.');
      return;
    }

    setEnviandoTelegram(true);
    try {
      const response = await fetch(`/api/telegram-messages/${id}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ mensagem: mensagemTelegram }),
      });

      if (response.ok) {
        setMostrarModalTelegram(false);
        setMensagemTelegram('');
        alert('Mensagem enviada com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao enviar mensagem.');
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setEnviandoTelegram(false);
    }
  };

  const handleAgendarChamado = async () => {
    if (!agendamento.data_agendamento) {
      alert('Por favor, selecione data e hora para o agendamento.');
      return;
    }

    setAgendando(true);
    try {
      const response = await fetch(`/api/chamados/${id}/agendar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(agendamento),
      });

      if (response.ok) {
        setMostrarModalAgendamento(false);
        setAgendamento({
          data_agendamento: '',
          observacoes_agendamento: '',
        });
        await fetchChamado();
        alert('Chamado agendado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao agendar chamado.');
      }
    } catch (error) {
      console.error("Erro ao agendar chamado:", error);
      alert('Erro ao agendar chamado. Tente novamente.');
    } finally {
      setAgendando(false);
    }
  };

  const handleCancelarAgendamento = async () => {
    if (!confirm('Tem certeza que deseja cancelar o agendamento deste chamado?')) {
      return;
    }

    try {
      const response = await fetch(`/api/chamados/${id}/agendar`, {
        method: "DELETE",
        credentials: 'include',
      });

      if (response.ok) {
        await fetchChamado();
        alert('Agendamento cancelado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao cancelar agendamento.');
      }
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      alert('Erro ao cancelar agendamento. Tente novamente.');
    }
  };

  const handleReclassificarChamado = async () => {
    setReclassificando(true);
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(reclassificacao),
      });

      if (response.ok) {
        setMostrarModalReclassificacao(false);
        await fetchChamado();
        alert('Chamado reclassificado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao reclassificar chamado.');
      }
    } catch (error) {
      console.error("Erro ao reclassificar chamado:", error);
      alert('Erro ao reclassificar chamado. Tente novamente.');
    } finally {
      setReclassificando(false);
    }
  };

  const handlePausarSLA = async () => {
    if (!motivoPausaSLA.trim()) {
      alert('Por favor, informe o motivo da pausa.');
      return;
    }

    setPausandoSLA(true);
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Aguardando usuário',
          sla_pausado_motivo: motivoPausaSLA,
        }),
      });

      if (response.ok) {
        setMostrarModalPausarSLA(false);
        setMotivoPausaSLA('');
        await fetchChamado();
        alert('SLA pausado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao pausar SLA.');
      }
    } catch (error) {
      console.error("Erro ao pausar SLA:", error);
      alert('Erro ao pausar SLA. Tente novamente.');
    } finally {
      setPausandoSLA(false);
    }
  };

  const handleRetomar = async () => {
    if (!confirm('Deseja retomar o atendimento deste chamado? O contador de SLA voltará a funcionar.')) {
      return;
    }

    setRetomandoSLA(true);
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Em atendimento',
        }),
      });

      if (response.ok) {
        await fetchChamado();
        alert('Atendimento retomado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao retomar atendimento.');
      }
    } catch (error) {
      console.error("Erro ao retomar atendimento:", error);
      alert('Erro ao retomar atendimento. Tente novamente.');
    } finally {
      setRetomandoSLA(false);
    }
  };

  const handleSalvarClassificacao = async () => {
    setSalvandoClassificacao(true);
    try {
      const response = await fetch(`/api/chamados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          tipo_problema: classificacaoEditada.tipo_problema,
          categoria_id: classificacaoEditada.categoria_id,
        }),
      });

      if (response.ok) {
        setEditandoClassificacao(false);
        await fetchChamado();
        alert('Classificação atualizada com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao atualizar classificação.');
      }
    } catch (error) {
      console.error("Erro ao atualizar classificação:", error);
      alert('Erro ao atualizar classificação. Tente novamente.');
    } finally {
      setSalvandoClassificacao(false);
    }
  };

  const handleMarcarComoProjeto = async () => {
    if (!dadosProjeto.nome_projeto.trim()) {
      alert('Por favor, informe o nome do projeto.');
      return;
    }

    setMarcandoProjeto(true);
    try {
      const response = await fetch(`/api/chamados/${id}/marcar-como-projeto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(dadosProjeto),
      });

      if (response.ok) {
        const result = await response.json();
        setMostrarModalProjeto(false);
        setDadosProjeto({
          nome_projeto: '',
          descricao_projeto: '',
          escopo: '',
        });
        await fetchChamado();
        alert(`Chamado transformado em projeto com sucesso!\n\nProjeto: ${result.projeto_nome} (ID: ${result.projeto_id})`);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao marcar como projeto.');
      }
    } catch (error) {
      console.error("Erro ao marcar como projeto:", error);
      alert('Erro ao marcar como projeto. Tente novamente.');
    } finally {
      setMarcandoProjeto(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (!chamado) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Chamado não encontrado</h2>
        </div>
      </Layout>
    );
  }

  const statusColors: Record<StatusChamado, string> = {
    'Novo': 'bg-blue-500',
    'Em triagem': 'bg-purple-500',
    'Em atendimento': 'bg-indigo-500',
    'Aguardando usuário': 'bg-yellow-500',
    'Aguardando fornecedor': 'bg-orange-500',
    'Resolvido': 'bg-green-500',
    'Fechado': 'bg-gray-500',
    'Cancelado': 'bg-red-500',
  };

  const prioridadeColors = {
    P1: 'bg-red-100 text-red-700 border-red-200',
    P2: 'bg-orange-100 text-orange-700 border-orange-200',
    P3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    P4: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/chamados")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{chamado.numero}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{chamado.titulo}</p>
          </div>
          
          {/* Botões de Ação */}
          <div className="flex gap-3">
            {/* Botão Assumir Chamado */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && (
              (!chamado.tecnico_responsavel_id || (chamado.tecnico_responsavel_id === user.id && chamado.status === 'Novo'))
            ) && chamado.status !== 'Fechado' && chamado.status !== 'Cancelado' && chamado.status !== 'Em atendimento' && (
              <button
                onClick={handleAssumirChamado}
                disabled={assumindo}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserCheck size={20} />
                {assumindo ? 'Assumindo...' : 'Assumir Chamado'}
              </button>
            )}

            {/* Botão Pausar SLA */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status === 'Em atendimento' && (
              <button
                onClick={() => setMostrarModalPausarSLA(true)}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                Pausar SLA
              </button>
            )}

            {/* Botão Retomar Atendimento */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && (chamado.status === 'Aguardando usuário' || chamado.status === 'Aguardando fornecedor') && (
              <button
                onClick={handleRetomar}
                disabled={retomandoSLA}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                {retomandoSLA ? 'Retomando...' : 'Retomar Atendimento'}
              </button>
            )}

            {/* Botão Resolver Chamado */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status === 'Em atendimento' && (
              <button
                onClick={() => setMostrarModalResolucao(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Resolver Chamado
              </button>
            )}

            {/* Botão Fechar Chamado */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status === 'Resolvido' && (
              <button
                onClick={handleFecharChamado}
                disabled={fechando}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                {fechando ? 'Fechando...' : 'Fechar Chamado'}
              </button>
            )}

            {/* Botão Transferir Chamado */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status !== 'Fechado' && chamado.status !== 'Cancelado' && (
              <button
                onClick={() => setMostrarModalTransferencia(true)}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"></path><path d="m15 9 6-6"></path><path d="M9 21h10"></path></svg>
                Transferir
              </button>
            )}

            {/* Botão Agendar Chamado */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status !== 'Fechado' && chamado.status !== 'Cancelado' && !chamado.agendado && (
              <button
                onClick={() => setMostrarModalAgendamento(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <Clock size={20} />
                Agendar
              </button>
            )}

            {/* Botão Enviar Mensagem Telegram */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.telegram_chat_id && chamado.status !== 'Fechado' && chamado.status !== 'Cancelado' && (
              <button
                onClick={() => setMostrarModalTelegram(true)}
                className="flex items-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <MessageSquare size={20} />
                Enviar Telegram
              </button>
            )}

            {/* Botão Reclassificar Chamado - apenas para tickets da TI */}
            {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status !== 'Fechado' && chamado.status !== 'Cancelado' && chamado.setor_destino_id === 1 && (
              <button
                onClick={() => setMostrarModalReclassificacao(true)}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4 7.55 4.24"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" x2="12" y1="22" y2="12"></line></svg>
                Reclassificar
              </button>
            )}

            {/* Botão Marcar como Projeto - disponível apenas para TI que não é projeto */}
            {user && !profileLoading && profile && ['tecnico', 'gestor', 'admin'].includes(profile.perfil) && chamado.setor_destino_id === 1 && !chamado.is_projeto && chamado.status !== 'Fechado' && chamado.status !== 'Cancelado' && chamado.status !== 'Resolvido' && (
              <button
                onClick={() => {
                  setDadosProjeto({
                    nome_projeto: `Projeto - ${chamado.titulo}`,
                    descricao_projeto: chamado.descricao,
                    escopo: '',
                  });
                  setMostrarModalProjeto(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"></path><path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"></path><path d="M15 2v5h5"></path></svg>
                Marcar como Projeto
              </button>
            )}

            {/* Indicador de Projeto */}
            {chamado.is_projeto && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"></path>
                      <path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"></path>
                      <path d="M15 2v5h5"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-2">
                      ✓ Chamado Convertido em Projeto
                    </h3>
                    <p className="text-purple-700 dark:text-purple-300 mb-3">
                      Este chamado foi transformado em projeto e agora está sendo gerenciado pela equipe de projetos.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-purple-900 dark:text-purple-100">ID do Projeto:</span>
                      <span className="px-3 py-1 bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 rounded-lg font-mono font-bold">
                        #{chamado.projeto_id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botão Reabrir Chamado - disponível para solicitante e técnicos em chamados Resolvidos ou Fechados */}
            {user && (chamado.status === 'Resolvido' || chamado.status === 'Fechado') && (
              <button
                onClick={() => setMostrarModalReabertura(true)}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
                Reabrir Chamado
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conteúdo Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes do Chamado */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detalhes</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Descrição</label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">{chamado.descricao}</p>
                </div>
                
                {chamado.ambiente && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ambiente</label>
                    <p className="text-gray-900 dark:text-gray-200 mt-1">{chamado.ambiente}</p>
                  </div>
                )}

                {chamado.passos_reproduzir && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Passos para Reproduzir</label>
                    <p className="text-gray-900 dark:text-gray-200 mt-1 whitespace-pre-wrap">{chamado.passos_reproduzir}</p>
                  </div>
                )}

                {chamado.solucao && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <label className="text-sm font-medium text-green-900 dark:text-green-300">Solução</label>
                    <p className="text-green-800 dark:text-green-200 mt-1">{chamado.solucao}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Anexos e Evidências */}
            {anexos.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Paperclip size={20} />
                  Anexos e Evidências ({anexos.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {anexos.map((anexo) => {
                    const isImage = anexo.tipo_arquivo.startsWith('image/');
                    const fileUrl = `/api/files/${anexo.url}`;
                    
                    return (
                      <div key={anexo.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                        {isImage && (
                          <div className="w-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-4">
                            <img 
                              src={fileUrl}
                              alt={anexo.nome_arquivo}
                              className="max-w-full max-h-64 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(fileUrl, '_blank')}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                          <div 
                            className="flex-shrink-0 cursor-pointer"
                            onClick={() => window.open(fileUrl, '_blank')}
                          >
                            {getIconeArquivo(anexo.tipo_arquivo)}
                          </div>
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => window.open(fileUrl, '_blank')}
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {anexo.nome_arquivo}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatarTamanhoArquivo(anexo.tamanho)} • {formatarDataHoraBrasil(anexo.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(fileUrl, anexo.nome_arquivo);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Baixar arquivo"
                          >
                            <Download size={16} className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal de Agendamento */}
            {mostrarModalAgendamento && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Agendar Atendimento</h3>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Agende uma data e hora específica para realizar o atendimento deste chamado. O solicitante será notificado sobre o agendamento.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Data e Hora do Agendamento *
                    </label>
                    <input
                      type="datetime-local"
                      value={agendamento.data_agendamento}
                      onChange={(e) => setAgendamento({ ...agendamento, data_agendamento: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Observações (opcional)
                    </label>
                    <textarea
                      value={agendamento.observacoes_agendamento}
                      onChange={(e) => setAgendamento({ ...agendamento, observacoes_agendamento: e.target.value })}
                      placeholder="Adicione observações sobre o agendamento..."
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleAgendarChamado}
                      disabled={agendando || !agendamento.data_agendamento}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {agendando ? 'Agendando...' : 'Confirmar Agendamento'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalAgendamento(false);
                        setAgendamento({
                          data_agendamento: '',
                          observacoes_agendamento: '',
                        });
                      }}
                      disabled={agendando}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Reabertura */}
            {mostrarModalReabertura && (
              <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-orange-200 dark:border-orange-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Reabrir Chamado
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <p className="text-sm text-orange-800 dark:text-orange-300">
                        {chamado.status === 'Resolvido' 
                          ? 'O chamado será reaberto pois a solução aplicada não resolveu o problema. O técnico será notificado para reavaliar.' 
                          : `Este chamado será reaberto e ${chamado.tecnico_responsavel_id ? 'voltará para o status "Em atendimento"' : 'voltará para o status "Novo"'}.`}
                        {chamado.tecnico_responsavel_id && ' O técnico responsável será notificado.'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        {chamado.status === 'Resolvido' 
                          ? 'Por que a solução não funcionou? *' 
                          : 'Motivo da Reabertura (opcional)'}
                      </label>
                      <textarea
                        value={motivoReabertura}
                        onChange={(e) => setMotivoReabertura(e.target.value)}
                        placeholder={chamado.status === 'Resolvido' 
                          ? 'Ex: O problema ainda persiste, a impressora continua sem funcionar...' 
                          : 'Explique o motivo da reabertura...'}
                        rows={4}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleReabrirChamado}
                        disabled={reabrindo || (chamado.status === 'Resolvido' && !motivoReabertura.trim())}
                        className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reabrindo ? 'Reabrindo...' : 'Confirmar Reabertura'}
                      </button>
                      <button
                        onClick={() => {
                          setMostrarModalReabertura(false);
                          setMotivoReabertura('');
                        }}
                        disabled={reabrindo}
                        className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Reclassificação */}
            {mostrarModalReclassificacao && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-amber-200 dark:border-amber-800 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Reclassificar Chamado</h3>
                
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Atualize a classificação do chamado caso tenha sido categorizado incorretamente. As alterações serão registradas no histórico.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Tipo
                    </label>
                    <select
                      value={reclassificacao.tipo}
                      onChange={(e) => setReclassificacao({ ...reclassificacao, tipo: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Selecione o tipo</option>
                      <option value="Incidente">Incidente</option>
                      <option value="Requisição">Requisição</option>
                      <option value="Problema">Problema</option>
                      <option value="Mudança">Mudança</option>
                    </select>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                      🔧 Qual o tipo de problema ou solicitação? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={reclassificacao.tipo_problema}
                      onChange={(e) => {
                        const tipoProblemaCompleto = e.target.value;
                        setReclassificacao({ 
                          ...reclassificacao, 
                          tipo_problema: tipoProblemaCompleto,
                          categoria_id: null,
                          subcategoria_id: null,
                          item_id: null
                        });
                        setSubcategorias([]);
                        setItens([]);
                      }}
                      className="w-full px-4 py-2.5 border border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Selecione o tipo...</option>
                      {tiposProblemaDisponiveis.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                      Escolha o tipo mais adequado ao seu problema ou solicitação
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Categoria
                      </label>
                      <select
                        value={reclassificacao.categoria_id || ''}
                        onChange={async (e) => {
                          const categoriaId = e.target.value ? parseInt(e.target.value) : null;
                          setReclassificacao({ ...reclassificacao, categoria_id: categoriaId, subcategoria_id: null, item_id: null });
                          setSubcategorias([]);
                          setItens([]);

                          // Verificar se a categoria tem prioridade automática
                          const categoria = categorias.find(c => c.id === categoriaId);
                          if (categoria?.prioridade_automatica) {
                            setPrioridadeAutomaticaReclassificacao(categoria.prioridade_automatica);
                          } else {
                            setPrioridadeAutomaticaReclassificacao(null);
                          }

                          if (categoriaId) {
                            try {
                              const response = await fetch(`/api/categorias/${categoriaId}/subcategorias`);
                              if (response.ok) {
                                const data = await response.json();
                                setSubcategorias(data);
                                
                                if (data.length === 0) {
                                  const responseItens = await fetch(`/api/categorias/${categoriaId}/itens`);
                                  if (responseItens.ok) {
                                    const itensData = await responseItens.json();
                                    setItens(itensData);
                                  }
                                }
                              }
                            } catch (error) {
                              console.error("Erro ao buscar subcategorias:", error);
                            }
                          }
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      >
                        <option value="">Selecione...</option>
                        {categorias
                          .filter(c => {
                            const tipoProblemaSelecionado = reclassificacao.tipo_problema ? reclassificacao.tipo_problema.split(' (ex:')[0].trim() : '';
                            return c.tipo === 'categoria' && c.tipo_problema === tipoProblemaSelecionado;
                          })
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.nome}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Subcategoria
                      </label>
                      <select
                        value={reclassificacao.subcategoria_id || ''}
                        onChange={async (e) => {
                          const subcategoriaId = e.target.value ? parseInt(e.target.value) : null;
                          setReclassificacao({ ...reclassificacao, subcategoria_id: subcategoriaId, item_id: null });
                          setItens([]);

                          // Verificar se a subcategoria tem prioridade automática
                          const subcategoria = subcategorias.find(c => c.id === subcategoriaId);
                          if (subcategoria?.prioridade_automatica) {
                            setPrioridadeAutomaticaReclassificacao(subcategoria.prioridade_automatica);
                          } else {
                            // Se não tem na subcategoria, manter a da categoria pai (se houver)
                            const categoria = categorias.find(c => c.id === reclassificacao.categoria_id);
                            setPrioridadeAutomaticaReclassificacao(categoria?.prioridade_automatica || null);
                          }

                          if (subcategoriaId) {
                            try {
                              const responseItens = await fetch(`/api/categorias/${subcategoriaId}/itens`);
                              if (responseItens.ok) {
                                const itensData = await responseItens.json();
                                setItens(itensData);
                              }
                            } catch (error) {
                              console.error("Erro ao buscar itens:", error);
                            }
                          }
                        }}
                        disabled={!subcategorias.length}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500"
                      >
                        <option value="">Selecione...</option>
                        {subcategorias.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Item
                      </label>
                      <select
                        value={reclassificacao.item_id || ''}
                        onChange={(e) => {
                          const itemId = e.target.value ? parseInt(e.target.value) : null;
                          setReclassificacao({ ...reclassificacao, item_id: itemId });
                          
                          // Verificar se o item tem prioridade automática
                          const item = itens.find(i => i.id === itemId);
                          if (item?.prioridade_automatica) {
                            setPrioridadeAutomaticaReclassificacao(item.prioridade_automatica);
                          } else {
                            // Se não tem no item, manter da subcategoria ou categoria
                            const subcategoria = subcategorias.find(c => c.id === reclassificacao.subcategoria_id);
                            const categoria = categorias.find(c => c.id === reclassificacao.categoria_id);
                            setPrioridadeAutomaticaReclassificacao(subcategoria?.prioridade_automatica || categoria?.prioridade_automatica || null);
                          }
                        }}
                        disabled={!itens.length}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500"
                      >
                        <option value="">Selecione...</option>
                        {itens.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {prioridadeAutomaticaReclassificacao ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                        🎯 Prioridade Automática: {prioridadeAutomaticaReclassificacao}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        Esta categoria possui prioridade fixa definida pelo sistema para prevenir manipulação. Os campos de impacto e urgência não se aplicam.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Impacto
                        </label>
                        <select
                          value={reclassificacao.impacto}
                          onChange={(e) => setReclassificacao({ ...reclassificacao, impacto: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                          <option value="">Selecione</option>
                          <option value="Baixo">Baixo</option>
                          <option value="Médio">Médio</option>
                          <option value="Alto">Alto</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Urgência
                        </label>
                        <select
                          value={reclassificacao.urgencia}
                          onChange={(e) => setReclassificacao({ ...reclassificacao, urgencia: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                          <option value="">Selecione</option>
                          <option value="Baixa">Baixa</option>
                          <option value="Média">Média</option>
                          <option value="Alta">Alta</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleReclassificarChamado}
                      disabled={reclassificando}
                      className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reclassificando ? 'Reclassificando...' : 'Confirmar Reclassificação'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalReclassificacao(false);
                        // Reset to current values
                        setReclassificacao({
                          tipo: chamado.tipo || '',
                          tipo_problema: chamado.titulo || '',
                          categoria_id: chamado.categoria_id || null,
                          subcategoria_id: chamado.subcategoria_id || null,
                          item_id: chamado.item_id || null,
                          setor_destino_id: chamado.setor_destino_id || null,
                          impacto: chamado.impacto || '',
                          urgencia: chamado.urgencia || '',
                        });
                      }}
                      disabled={reclassificando}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Envio Telegram */}
            {mostrarModalTelegram && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Enviar Mensagem via Telegram</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Mensagem *
                    </label>
                    <textarea
                      value={mensagemTelegram}
                      onChange={(e) => setMensagemTelegram(e.target.value)}
                      placeholder="Digite a mensagem que deseja enviar ao solicitante via Telegram..."
                      rows={5}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
                    <p className="text-sm text-sky-700 dark:text-sky-300">
                      Esta mensagem será enviada diretamente para o Telegram do solicitante.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleEnviarMensagemTelegram}
                      disabled={enviandoTelegram || !mensagemTelegram.trim()}
                      className="flex-1 px-4 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enviandoTelegram ? 'Enviando...' : 'Enviar Mensagem'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalTelegram(false);
                        setMensagemTelegram('');
                      }}
                      disabled={enviandoTelegram}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Pausar SLA */}
            {mostrarModalPausarSLA && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Pausar SLA</h3>
                
                <div className="space-y-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      O contador de SLA será pausado e o status mudará para "Aguardando usuário". Informe o motivo da pausa.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Motivo da Pausa *
                    </label>
                    <textarea
                      value={motivoPausaSLA}
                      onChange={(e) => setMotivoPausaSLA(e.target.value)}
                      placeholder="Ex: Dependência de fornecedor, aguardando aprovação, aguardando peça..."
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handlePausarSLA}
                      disabled={pausandoSLA || !motivoPausaSLA.trim()}
                      className="flex-1 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {pausandoSLA ? 'Pausando...' : 'Confirmar Pausa'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalPausarSLA(false);
                        setMotivoPausaSLA('');
                      }}
                      disabled={pausandoSLA}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Transferência */}
            {mostrarModalTransferencia && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Transferir Chamado</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Técnico Destino *
                    </label>
                    <select
                      value={transferencia.novo_tecnico_id}
                      onChange={(e) => setTransferencia({ ...transferencia, novo_tecnico_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Selecione um técnico</option>
                      {tecnicos.map((tecnico) => (
                        <option key={tecnico.user_id} value={tecnico.user_id}>
                          {tecnico.nome} - {tecnico.perfil}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Motivo da Transferência (opcional)
                    </label>
                    <textarea
                      value={transferencia.motivo}
                      onChange={(e) => setTransferencia({ ...transferencia, motivo: e.target.value })}
                      placeholder="Explique o motivo da transferência..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleTransferirChamado}
                      disabled={transferindo || !transferencia.novo_tecnico_id}
                      className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {transferindo ? 'Transferindo...' : 'Confirmar Transferência'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalTransferencia(false);
                        setTransferencia({
                          novo_tecnico_id: '',
                          motivo: '',
                        });
                      }}
                      disabled={transferindo}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Resolução */}
            {mostrarModalResolucao && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Resolver Chamado</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Descrição da Solução *
                    </label>
                    <textarea
                      value={resolucao.solucao}
                      onChange={(e) => setResolucao({ ...resolucao, solucao: e.target.value })}
                      placeholder="Descreva detalhadamente como o problema foi resolvido..."
                      rows={5}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resolucao.adicionarKB}
                        onChange={(e) => setResolucao({ ...resolucao, adicionarKB: e.target.checked })}
                        className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-blue-900 block">Adicionar ao Banco de Conhecimento</span>
                        <span className="text-sm text-blue-700">Esta solução será útil para outros técnicos no futuro</span>
                      </div>
                    </label>

                    {resolucao.adicionarKB && (
                      <div className="mt-4 space-y-3 pl-7">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Título do Artigo (opcional)
                          </label>
                          <input
                            type="text"
                            value={resolucao.tituloKB}
                            onChange={(e) => setResolucao({ ...resolucao, tituloKB: e.target.value })}
                            placeholder={chamado?.titulo || "Será usado o título do chamado"}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Palavras-chave (separadas por vírgula)
                          </label>
                          <input
                            type="text"
                            value={resolucao.palavrasChave}
                            onChange={(e) => setResolucao({ ...resolucao, palavrasChave: e.target.value })}
                            placeholder="ex: impressora, rede, windows, erro"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleResolverChamado}
                      disabled={resolvendo || !resolucao.solucao.trim()}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resolvendo ? 'Resolvendo...' : 'Confirmar Resolução'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalResolucao(false);
                        setResolucao({
                          solucao: '',
                          adicionarKB: false,
                          tituloKB: '',
                          palavrasChave: '',
                        });
                      }}
                      disabled={resolvendo}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Avaliação - Apenas para o solicitante */}
            {mostrarAvaliacao && user && chamado.solicitante_id === user.id && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Avalie o Atendimento</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Como você avalia o atendimento?
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((nota) => (
                        <button
                          key={nota}
                          onClick={() => setAvaliacao({ ...avaliacao, nota })}
                          className={`p-3 rounded-lg transition-all ${
                            avaliacao.nota >= nota
                              ? 'text-yellow-500 scale-110'
                              : 'text-gray-300 hover:text-yellow-400'
                          }`}
                        >
                          <Star size={32} fill={avaliacao.nota >= nota ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      O problema foi resolvido?
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setAvaliacao({ ...avaliacao, resolveu: true })}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                          avaliacao.resolveu
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setAvaliacao({ ...avaliacao, resolveu: false })}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                          !avaliacao.resolveu
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      De 0 a 10, o quanto você recomendaria nossos serviços?
                    </label>
                    <div className="grid grid-cols-11 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((valor) => (
                        <button
                          key={valor}
                          onClick={() => setAvaliacao({ ...avaliacao, nps: valor })}
                          className={`p-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                            avaliacao.nps === valor
                              ? valor <= 6
                                ? 'border-red-500 bg-red-500 text-white'
                                : valor <= 8
                                ? 'border-yellow-500 bg-yellow-500 text-white'
                                : 'border-green-500 bg-green-500 text-white'
                              : 'border-gray-300 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {valor}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Muito improvável</span>
                      <span>Muito provável</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Comentário (opcional)
                    </label>
                    <textarea
                      value={avaliacao.comentario || ''}
                      onChange={(e) => setAvaliacao({ ...avaliacao, comentario: e.target.value })}
                      placeholder="Deixe seu feedback..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <button
                    onClick={handleAvaliar}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Enviar Avaliação
                  </button>
                </div>
              </div>
            )}

            {/* Histórico Detalhado */}
            <HistoricoDetalhado chamadoId={parseInt(id!)} />

            {/* Chat em Tempo Real */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare size={20} />
                Chat em Tempo Real
              </h2>
              <ChatBox chamadoId={parseInt(id!)} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <div className="mt-1">
                  {chamado.sla_pausado_motivo ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="font-medium text-gray-900 dark:text-white">Chamado pausado</span>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">Motivo:</p>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">{chamado.sla_pausado_motivo}</p>
                        {chamado.sla_pausado_em && (
                          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                            Pausado em: {formatarDataHoraBrasil(chamado.sla_pausado_em)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[chamado.status]}`} />
                      <span className="font-medium text-gray-900 dark:text-white">{chamado.status}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo</label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">{chamado.tipo}</p>
              </div>

              {setorDestino && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Setor de Destino</label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">{setorDestino.nome}</p>
                </div>
              )}

              {chamado.prioridade && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Prioridade</label>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${prioridadeColors[chamado.prioridade]}`}>
                      {chamado.prioridade}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Solicitante</label>
                <div className="flex items-center gap-2 mt-1">
                  <User size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-900 dark:text-gray-200 font-medium">{chamado.solicitante_nome}</p>
                    {chamado.solicitante_setor && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{chamado.solicitante_setor}</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">{chamado.solicitante_email}</p>
                  </div>
                </div>
              </div>

              {chamado.tecnico_responsavel_id && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Técnico Responsável</label>
                  <div className="flex items-center gap-2 mt-1">
                    <UserCheck size={16} className="text-green-600" />
                    <span className="text-gray-900 dark:text-gray-200 font-medium">Em atendimento</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Criado em</label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={16} className="text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-200">
                    {formatarDataHoraBrasil(chamado.data_abertura)}
                  </span>
                </div>
              </div>

              {chamado.agendado && chamado.data_agendamento && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-500">Agendamento</label>
                    {user && !profileLoading && profile && (profile.perfil !== 'solicitante' || (profile.setor_id && profile.setor_id === chamado.setor_destino_id)) && chamado.status !== 'Fechado' && (
                      <button
                        onClick={handleCancelarAgendamento}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-900">
                      <Clock size={16} className="text-blue-600" />
                      <span className="font-medium">
                        {formatarDataHoraBrasil(chamado.data_agendamento)}
                      </span>
                    </div>
                    {chamado.observacoes_agendamento && (
                      <p className="text-sm text-blue-700 mt-2">
                        {chamado.observacoes_agendamento}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {chamado.avaliacao_nota && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Avaliação do Solicitante</label>
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((nota) => (
                      <Star
                        key={nota}
                        size={20}
                        className={nota <= chamado.avaliacao_nota! ? 'text-yellow-400' : 'text-gray-300'}
                        fill={nota <= chamado.avaliacao_nota! ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {chamado.avaliacao_resolveu ? '✓ Problema resolvido' : '✗ Problema não resolvido'}
                  </p>
                  {chamado.avaliacao_comentario && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 italic">"{chamado.avaliacao_comentario}"</p>
                  )}
                </div>
              )}

              {/* Seção de Edição de Classificação - Apenas para TI */}
              {user && !profileLoading && profile && profile.perfil !== 'solicitante' && chamado.setor_destino_id === 1 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Classificação</label>
                    {!editandoClassificacao && (
                      <button
                        onClick={() => {
                          setEditandoClassificacao(true);
                          setClassificacaoEditada({
                            tipo_problema: chamado.tipo_problema || '',
                            categoria_id: chamado.categoria_id || null,
                          });
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                      >
                        Editar
                      </button>
                    )}
                  </div>

                  {!editandoClassificacao ? (
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tipo de Problema:</p>
                        <p className="text-sm text-gray-900 dark:text-gray-200">
                          {chamado.tipo_problema || <span className="text-red-500">Não classificado</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Categoria:</p>
                        <p className="text-sm text-gray-900 dark:text-gray-200">
                          {chamado.categoria_id ? (
                            categorias.find(c => c.id === chamado.categoria_id)?.nome || `ID: ${chamado.categoria_id}`
                          ) : (
                            <span className="text-red-500">Não classificado</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          Tipo de Problema
                        </label>
                        <select
                          value={classificacaoEditada.tipo_problema}
                          onChange={(e) => {
                            setClassificacaoEditada({
                              ...classificacaoEditada,
                              tipo_problema: e.target.value,
                              categoria_id: null,
                            });
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Selecione...</option>
                          {tiposProblemaDisponiveis.map((tipo) => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </div>

                      {classificacaoEditada.tipo_problema && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                            Categoria
                          </label>
                          <select
                            value={classificacaoEditada.categoria_id || ''}
                            onChange={(e) => {
                              setClassificacaoEditada({
                                ...classificacaoEditada,
                                categoria_id: e.target.value ? parseInt(e.target.value) : null,
                              });
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Selecione...</option>
                            {categorias
                              .filter(c => {
                                const tipoProblemaSelecionado = classificacaoEditada.tipo_problema.split(' (ex:')[0].trim();
                                return c.tipo === 'categoria' && c.tipo_problema === tipoProblemaSelecionado;
                              })
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.nome}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSalvarClassificacao}
                          disabled={salvandoClassificacao || !classificacaoEditada.tipo_problema}
                          className="flex-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {salvandoClassificacao ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => {
                            setEditandoClassificacao(false);
                            setClassificacaoEditada({
                              tipo_problema: '',
                              categoria_id: null,
                            });
                          }}
                          disabled={salvandoClassificacao}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal Marcar como Projeto */}
          {mostrarModalProjeto && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full border border-purple-200 dark:border-purple-800 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Marcar Chamado como Projeto
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <p className="text-sm text-purple-800 dark:text-purple-300">
                      Este chamado será convertido em um projeto e removido da lista de tickets. O contador de SLA será interrompido e o projeto aparecerá na área de Projetos.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Nome do Projeto *
                    </label>
                    <input
                      type="text"
                      value={dadosProjeto.nome_projeto}
                      onChange={(e) => setDadosProjeto({ ...dadosProjeto, nome_projeto: e.target.value })}
                      placeholder="Nome descritivo do projeto"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Descrição do Projeto
                    </label>
                    <textarea
                      value={dadosProjeto.descricao_projeto}
                      onChange={(e) => setDadosProjeto({ ...dadosProjeto, descricao_projeto: e.target.value })}
                      placeholder="Descrição detalhada do projeto"
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Escopo Inicial
                    </label>
                    <textarea
                      value={dadosProjeto.escopo}
                      onChange={(e) => setDadosProjeto({ ...dadosProjeto, escopo: e.target.value })}
                      placeholder="Defina o escopo inicial do projeto"
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleMarcarComoProjeto}
                      disabled={marcandoProjeto || !dadosProjeto.nome_projeto.trim()}
                      className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {marcandoProjeto ? 'Convertendo...' : 'Confirmar Conversão'}
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalProjeto(false);
                        setDadosProjeto({
                          nome_projeto: '',
                          descricao_projeto: '',
                          escopo: '',
                        });
                      }}
                      disabled={marcandoProjeto}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
