"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Edit2, 
  X,
  RefreshCw
} from "lucide-react";

interface Chamado {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  prioridade: string;
  setor_destino_id: number;
  data_abertura: string;
  data_primeira_resposta: string | null;
  data_resolucao: string | null;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  sla_id: number | null;
  tempo_resposta_minutos: number | null;
  tempo_solucao_minutos: number | null;
  sla_descricao: string | null;
  solicitante_nome: string;
  status_atendimento: string;
  status_resolucao: string;
  tempo_restante_atendimento: number | null;
  tempo_restante_resolucao: number | null;
}

const setoresMap: Record<number, string> = {
  1: "TI",
  2: "RH",
  4: "Marketing",
  7: "Manutenção",
  8: "Hotelaria",
  9: "Comercial",
  13: "Rouparia",
  14: "Call Center",
};

export default function AnaliseSLA() {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [itensPorPagina, setItensPorPagina] = useState(50);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [novosPrazos, setNovosPrazos] = useState<{
    prazo_resposta: string;
    prazo_solucao: string;
    motivo: string;
  }>({ prazo_resposta: "", prazo_solucao: "", motivo: "" });
  const [recalculando, setRecalculando] = useState(false);
  const [ticketsSelecionados, setTicketsSelecionados] = useState<number[]>([]);
  const [corrigindoPausados, setCorrigindoPausados] = useState(false);

  const toggleSelecionarTodos = () => {
    if (ticketsSelecionados.length === chamados.length) {
      setTicketsSelecionados([]);
    } else {
      setTicketsSelecionados(chamados.map(c => c.id));
    }
  };

  const toggleSelecionarTicket = (id: number) => {
    if (ticketsSelecionados.includes(id)) {
      setTicketsSelecionados(ticketsSelecionados.filter(tid => tid !== id));
    } else {
      setTicketsSelecionados([...ticketsSelecionados, id]);
    }
  };

  const recalcularSelecionados = async () => {
    if (ticketsSelecionados.length === 0) {
      setMessage({ type: "error", text: "Selecione pelo menos um ticket" });
      return;
    }

    if (!confirm(`Deseja recalcular o SLA de ${ticketsSelecionados.length} ticket(s) selecionado(s)?\n\nOs prazos serão recalculados com base na data de abertura e categoria atual.`)) {
      return;
    }

    setRecalculando(true);
    setMessage(null);

    try {
      const response = await fetch("/api/analise-sla/recalcular-selecionados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_ids: ticketsSelecionados }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: `✅ ${data.message} (${data.tickets_atualizados} ticket(s) recalculado(s))`,
        });
        setTicketsSelecionados([]);
        carregarChamados();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao recalcular SLAs" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRecalculando(false);
    }
  };

  const carregarChamados = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.append("status", filtroStatus);
      if (filtroSetor) params.append("setor", filtroSetor);
      if (busca) params.append("busca", busca);
      if (dataInicio) params.append("data_inicio", dataInicio);
      if (dataFim) params.append("data_fim", dataFim);
      params.append("limite", itensPorPagina.toString());
      params.append("pagina", paginaAtual.toString());

      const response = await fetch(`/api/analise-sla?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setChamados(data.chamados || []);
        setTotalRegistros(data.total || 0);
        setTotalPaginas(data.totalPaginas || 0);
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao carregar dados" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = (chamado: Chamado) => {
    setEditandoId(chamado.id);
    setNovosPrazos({
      prazo_resposta: chamado.prazo_resposta || "",
      prazo_solucao: chamado.prazo_solucao || "",
      motivo: "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNovosPrazos({ prazo_resposta: "", prazo_solucao: "", motivo: "" });
  };

  const salvarSLA = async (chamadoId: number) => {
    if (!novosPrazos.motivo.trim()) {
      setMessage({ type: "error", text: "Informe o motivo da alteração" });
      return;
    }

    try {
      const response = await fetch(`/api/analise-sla/${chamadoId}/sla`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novosPrazos),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message });
        cancelarEdicao();
        carregarChamados();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao atualizar SLA" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const recalcularSLAIndividual = async (chamadoId: number, numeroTicket: string) => {
    if (!confirm(`Deseja recalcular o SLA do ticket ${numeroTicket}?\n\nOs prazos serão recalculados com base na data de abertura e categoria atual.`)) {
      return;
    }

    setMessage(null);
    try {
      const response = await fetch(`/api/analise-sla/${chamadoId}/recalcular`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message });
        carregarChamados();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao recalcular SLA" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const corrigirTicketsPausados = async () => {
    if (!confirm("Deseja corrigir todos os tickets pausados sem marcação de data?\n\nSerá definida a data/hora de pausa com base no histórico do ticket.")) {
      return;
    }

    setCorrigindoPausados(true);
    setMessage(null);

    try {
      const response = await fetch("/api/corrigir-sla-pausado/corrigir-todos", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: `✅ ${data.message} (${data.corrigidos} ticket(s) corrigido(s))`,
        });
        carregarChamados();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao corrigir tickets pausados" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setCorrigindoPausados(false);
    }
  };

  const recalcularSLALote = async (setorId?: number, apenasNulos: boolean = false) => {
    const setorNome = setorId ? setoresMap[setorId] : "todos os setores";
    const tipoRecalculo = apenasNulos ? "apenas tickets sem SLA" : "todos os tickets";
    
    if (!confirm(`Deseja recalcular SLA para ${tipoRecalculo} do setor ${setorNome}?\n\nEsta operação pode levar alguns segundos.`)) {
      return;
    }

    setRecalculando(true);
    setMessage(null);

    try {
      const response = await fetch("/api/analise-sla/recalcular-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setor_id: setorId,
          apenas_nulos: apenasNulos,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: `✅ ${data.message} (${data.tickets_atualizados} de ${data.total_encontrados})`,
        });
        carregarChamados();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao recalcular SLAs" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRecalculando(false);
    }
  };

  const formatarTempo = (minutos: number | null) => {
    if (minutos === null) return "N/A";
    
    const abs = Math.abs(minutos);
    const horas = Math.floor(abs / 60);
    const mins = abs % 60;

    if (horas > 0) {
      return `${horas}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getBadgeStatusAtendimento = (status: string) => {
    switch (status) {
      case "Dentro":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "Fora":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      case "No Prazo":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "Atrasado":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
      case "Pausado":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300";
    }
  };

  useEffect(() => {
    setPaginaAtual(1); // Reset para primeira página quando filtros mudam
  }, [filtroStatus, filtroSetor, busca, dataInicio, dataFim, itensPorPagina]);

  useEffect(() => {
    carregarChamados();
  }, [filtroStatus, filtroSetor, busca, dataInicio, dataFim, paginaAtual, itensPorPagina]);

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Análise de SLA</h1>
          <p className="text-muted-foreground mt-2">
            Visualize e ajuste os prazos de atendimento e resolução dos chamados
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Filtros */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Buscar</label>
              <input
                type="text"
                placeholder="Número, título ou descrição..."
                className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select
                className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="Novo">Novo</option>
                <option value="Em atendimento">Em atendimento</option>
                <option value="Aguardando Avaliação">Aguardando Avaliação</option>
                <option value="Aguardando usuário">Aguardando usuário</option>
                <option value="Aguardando fornecedor">Aguardando fornecedor</option>
                <option value="Fechado">Fechado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Setor</label>
              <select
                className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(setoresMap).map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Data Início</label>
              <input
                type="date"
                className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Data Fim</label>
              <input
                type="date"
                className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Por página</label>
              <select
                className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                value={itensPorPagina}
                onChange={(e) => setItensPorPagina(parseInt(e.target.value))}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca("");
                  setFiltroStatus("");
                  setFiltroSetor("");
                  setDataInicio("");
                  setDataFim("");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {totalRegistros > 0 && (
                <>
                  Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a{" "}
                  {Math.min(paginaAtual * itensPorPagina, totalRegistros)} de {totalRegistros} tickets
                  {ticketsSelecionados.length > 0 && (
                    <span className="ml-2 text-primary font-semibold">
                      • {ticketsSelecionados.length} selecionado(s)
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              {ticketsSelecionados.length > 0 && (
                <Button
                  onClick={recalcularSelecionados}
                  disabled={recalculando}
                  variant="default"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {recalculando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Recalcular Selecionados ({ticketsSelecionados.length})
                </Button>
              )}
              <Button
                onClick={corrigirTicketsPausados}
                disabled={loading || recalculando || corrigindoPausados}
                variant="outline"
                size="sm"
                className="bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              >
                {corrigindoPausados ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <AlertCircle className="h-4 w-4 mr-2" />
                )}
                Corrigir SLA Pausado
              </Button>
              <Button
                onClick={() => recalcularSLALote(filtroSetor ? parseInt(filtroSetor) : undefined, true)}
                disabled={loading || recalculando || corrigindoPausados}
                variant="outline"
                size="sm"
                className="bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
              >
                {recalculando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Recalcular Sem SLA{filtroSetor ? ` (${setoresMap[parseInt(filtroSetor)]})` : ""}
              </Button>
              <Button
                onClick={() => recalcularSLALote(filtroSetor ? parseInt(filtroSetor) : undefined, false)}
                disabled={loading || recalculando || corrigindoPausados}
                variant="outline"
                size="sm"
                className="bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30"
              >
                {recalculando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Recalcular Todos{filtroSetor ? ` (${setoresMap[parseInt(filtroSetor)]})` : ""}
              </Button>
              <Button onClick={carregarChamados} disabled={loading} variant="outline" size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Atualizar
              </Button>
            </div>
          </div>
        </Card>

        {/* Resumo */}
        {chamados.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total de Chamados</p>
              <p className="text-2xl font-bold text-foreground">{totalRegistros}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Atendimento - Dentro</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {chamados.filter((c) => c.status_atendimento === "Dentro").length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Atendimento - Fora</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {chamados.filter((c) => c.status_atendimento === "Fora").length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Resolução - Fora</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {chamados.filter((c) => c.status_resolucao === "Fora").length}
              </p>
            </Card>
          </div>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : chamados.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">Nenhum chamado encontrado</p>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-background">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-3 text-center text-foreground font-semibold w-12">
                    <input
                      type="checkbox"
                      checked={chamados.length > 0 && ticketsSelecionados.length === chamados.length}
                      onChange={toggleSelecionarTodos}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">Número</th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">Título</th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">Status</th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">Prioridade</th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">Setor</th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">
                    SLA Atendimento
                  </th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">
                    Status Atend.
                  </th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">
                    SLA Resolução
                  </th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">
                    Status Resol.
                  </th>
                  <th className="border border-border p-3 text-left text-foreground font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {chamados.map((chamado) => (
                  <tr key={chamado.id} className="hover:bg-muted/50">
                    <td className="border border-border p-3 text-center">
                      <input
                        type="checkbox"
                        checked={ticketsSelecionados.includes(chamado.id)}
                        onChange={() => toggleSelecionarTicket(chamado.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="border border-border p-3 text-foreground font-mono text-sm">
                      {chamado.numero}
                    </td>
                    <td className="border border-border p-3 text-foreground">
                      <div className="max-w-xs truncate">{chamado.titulo}</div>
                    </td>
                    <td className="border border-border p-3 text-foreground text-sm">{chamado.status}</td>
                    <td className="border border-border p-3 text-foreground text-sm">{chamado.prioridade}</td>
                    <td className="border border-border p-3 text-foreground text-sm">
                      {setoresMap[chamado.setor_destino_id] || "N/A"}
                    </td>
                    <td className="border border-border p-3 text-foreground text-sm">
                      {editandoId === chamado.id ? (
                        <input
                          type="datetime-local"
                          className="w-full border border-border rounded px-2 py-1 text-xs bg-background"
                          value={novosPrazos.prazo_resposta}
                          onChange={(e) =>
                            setNovosPrazos({ ...novosPrazos, prazo_resposta: e.target.value })
                          }
                        />
                      ) : chamado.prazo_resposta ? (
                        <>
                          <div>{new Date(chamado.prazo_resposta).toLocaleString("pt-BR")}</div>
                          {chamado.tempo_restante_atendimento !== null && !chamado.data_primeira_resposta && (
                            <div className="text-xs text-muted-foreground">
                              {chamado.status_atendimento === "Dentro" ? "Faltam" : 
                               chamado.status_atendimento === "Pausado" ? "Pausado -" : 
                               "Fora há"}{" "}
                              {formatarTempo(chamado.tempo_restante_atendimento)}
                            </div>
                          )}
                        </>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="border border-border p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getBadgeStatusAtendimento(chamado.status_atendimento)}`}>
                        {chamado.status_atendimento}
                      </span>
                    </td>
                    <td className="border border-border p-3 text-foreground text-sm">
                      {editandoId === chamado.id ? (
                        <input
                          type="datetime-local"
                          className="w-full border border-border rounded px-2 py-1 text-xs bg-background"
                          value={novosPrazos.prazo_solucao}
                          onChange={(e) =>
                            setNovosPrazos({ ...novosPrazos, prazo_solucao: e.target.value })
                          }
                        />
                      ) : chamado.prazo_solucao ? (
                        <>
                          <div>{new Date(chamado.prazo_solucao).toLocaleString("pt-BR")}</div>
                          {chamado.tempo_restante_resolucao !== null && !chamado.data_resolucao && (
                            <div className="text-xs text-muted-foreground">
                              {chamado.status_resolucao === "Dentro" ? "Faltam" : 
                               chamado.status_resolucao === "Pausado" ? "Pausado -" : 
                               "Fora há"}{" "}
                              {formatarTempo(chamado.tempo_restante_resolucao)}
                            </div>
                          )}
                        </>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="border border-border p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getBadgeStatusAtendimento(chamado.status_resolucao)}`}>
                        {chamado.status_resolucao}
                      </span>
                    </td>
                    <td className="border border-border p-3">
                      {editandoId === chamado.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Motivo da alteração..."
                            className="w-full border border-border rounded px-2 py-1 text-xs bg-background"
                            value={novosPrazos.motivo}
                            onChange={(e) => setNovosPrazos({ ...novosPrazos, motivo: e.target.value })}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => salvarSLA(chamado.id)} className="text-xs h-7">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelarEdicao}
                              className="text-xs h-7"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => iniciarEdicao(chamado)}
                            className="text-xs h-7"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Alterar SLA
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => recalcularSLAIndividual(chamado.id, chamado.numero)}
                            className="text-xs h-7 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Recalcular
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual === 1}
                  onClick={() => setPaginaAtual(1)}
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual === 1}
                  onClick={() => setPaginaAtual(paginaAtual - 1)}
                >
                  Anterior
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let pageNum;
                    if (totalPaginas <= 5) {
                      pageNum = i + 1;
                    } else if (paginaAtual <= 3) {
                      pageNum = i + 1;
                    } else if (paginaAtual >= totalPaginas - 2) {
                      pageNum = totalPaginas - 4 + i;
                    } else {
                      pageNum = paginaAtual - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={paginaAtual === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaginaAtual(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual === totalPaginas}
                  onClick={() => setPaginaAtual(paginaAtual + 1)}
                >
                  Próxima
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual === totalPaginas}
                  onClick={() => setPaginaAtual(totalPaginas)}
                >
                  Última
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
