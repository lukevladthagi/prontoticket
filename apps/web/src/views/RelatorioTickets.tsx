"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { FileText, Download, FileSpreadsheet, Calendar } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TicketRelatorio {
  id: number;
  numero: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  status: string;
  data_abertura: string;
  data_primeira_resposta: string | null;
  data_resolucao: string | null;
  data_fechamento: string | null;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  tempo_resposta_minutos: number;
  tempo_solucao_minutos: number;
  setor_nome: string;
  solicitante_nome: string;
  tecnico_nome: string | null;
  categoria_nome: string | null;
  subcategoria_nome: string | null;
  item_nome: string | null;
  status_sla_atendimento: string;
  status_sla_resolucao: string;
  tempo_atendimento_decorrido: number | null;
  tempo_resolucao_decorrido: number | null;
}

interface Setor {
  id: number;
  nome: string;
}

export default function RelatorioTickets() {
  const [tickets, setTickets] = useState<TicketRelatorio[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(false);
  const [setorSelecionado, setSetorSelecionado] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    carregarSetores();
  }, []);

  const carregarSetores = async () => {
    try {
      const response = await fetch("/api/setores", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSetores(data.filter((s: Setor) => s.nome !== "Geral"));
      }
    } catch (error) {
      console.error("Erro ao carregar setores:", error);
    }
  };

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (setorSelecionado !== "todos") params.append("setor_id", setorSelecionado);
      if (dataInicio) params.append("data_inicio", dataInicio);
      if (dataFim) params.append("data_fim", dataFim);

      console.log('Gerando relatório com params:', params.toString());
      
      const response = await fetch(`/api/relatorio-tickets?${params}`, {
        credentials: "include",
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dados recebidos:', data.length, 'tickets');
        setTickets(data);
      } else {
        const errorText = await response.text();
        console.error('Erro na resposta:', response.status, errorText);
        alert(`Erro ao gerar relatório: ${errorText || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert(`Erro ao gerar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string | null) => {
    if (!data) return "-";
    const d = new Date(data);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatarTempo = (minutos: number | null) => {
    if (!minutos) return "-";
    if (minutos < 60) return `${minutos}min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas < 24) return `${horas}h ${mins}min`;
    const dias = Math.floor(horas / 24);
    const h = horas % 24;
    return `${dias}d ${h}h ${mins}min`;
  };

  const exportarExcel = () => {
    const dadosExcel = tickets.map(t => ({
      "Número": t.numero,
      "Título": t.titulo,
      "Tipo": t.tipo,
      "Prioridade": t.prioridade,
      "Status": t.status,
      "Setor": t.setor_nome,
      "Solicitante": t.solicitante_nome,
      "Técnico": t.tecnico_nome || "-",
      "Categoria": t.categoria_nome || "-",
      "Subcategoria": t.subcategoria_nome || "-",
      "Item": t.item_nome || "-",
      "Data Abertura": formatarData(t.data_abertura),
      "Data 1ª Resposta": formatarData(t.data_primeira_resposta),
      "Data Resolução": formatarData(t.data_resolucao),
      "Data Fechamento": formatarData(t.data_fechamento),
      "SLA Atendimento (min)": t.tempo_resposta_minutos || "-",
      "SLA Resolução (min)": t.tempo_solucao_minutos || "-",
      "Tempo Atendimento": formatarTempo(t.tempo_atendimento_decorrido),
      "Tempo Resolução": formatarTempo(t.tempo_resolucao_decorrido),
      "Status SLA Atendimento": t.status_sla_atendimento,
      "Status SLA Resolução": t.status_sla_resolucao,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Tickets");
    
    const filename = `relatorio_tickets_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportarPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(16);
    doc.text('Relatório Detalhado de Tickets', 14, 15);
    
    doc.setFontSize(10);
    const filtros: string[] = [];
    if (setorSelecionado !== "todos") {
      const setor = setores.find(s => s.id.toString() === setorSelecionado);
      if (setor) filtros.push(`Setor: ${setor.nome}`);
    }
    if (dataInicio) filtros.push(`De: ${new Date(dataInicio).toLocaleDateString('pt-BR')}`);
    if (dataFim) filtros.push(`Até: ${new Date(dataFim).toLocaleDateString('pt-BR')}`);
    
    if (filtros.length > 0) {
      doc.text(filtros.join(' | '), 14, 22);
    }

    const dadosPDF = tickets.map(t => [
      t.numero,
      t.titulo.substring(0, 30) + (t.titulo.length > 30 ? '...' : ''),
      t.prioridade,
      t.status,
      t.tecnico_nome || '-',
      formatarData(t.data_abertura),
      formatarData(t.data_resolucao),
      formatarTempo(t.tempo_resposta_minutos),
      formatarTempo(t.tempo_solucao_minutos),
      t.status_sla_atendimento,
      t.status_sla_resolucao,
    ]);

    autoTable(doc, {
      head: [[
        'Número',
        'Título',
        'Prior.',
        'Status',
        'Técnico',
        'Abertura',
        'Resolução',
        'SLA Atend.',
        'SLA Resol.',
        'Status Atend.',
        'Status Resol.'
      ]],
      body: dadosPDF,
      startY: filtros.length > 0 ? 26 : 20,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        1: { cellWidth: 40 }
      }
    });

    const filename = `relatorio_tickets_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            Relatório Detalhado de Tickets
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Visualize e exporte dados completos de tickets com informações de SLA
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtros</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Setor
              </label>
              <select
                value={setorSelecionado}
                onChange={(e) => setSetorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="todos">Todos os Setores</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            onClick={gerarRelatorio}
            disabled={loading}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            {loading ? "Gerando..." : "Gerar Relatório"}
          </button>
        </div>

        {/* Resultados */}
        {tickets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tickets.length} {tickets.length === 1 ? 'ticket encontrado' : 'tickets encontrados'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={exportarExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Excel
                </button>
                <button
                  onClick={exportarPDF}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Título</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Prior.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Técnico</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Abertura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Resolução</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SLA Atend.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SLA Resol.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status Atend.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status Resol.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{ticket.numero}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{ticket.titulo}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.prioridade === 'P1' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          ticket.prioridade === 'P2' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          ticket.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {ticket.prioridade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{ticket.status}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{ticket.tecnico_nome || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatarData(ticket.data_abertura)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatarData(ticket.data_resolucao)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatarTempo(ticket.tempo_resposta_minutos)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatarTempo(ticket.tempo_solucao_minutos)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.status_sla_atendimento === 'Dentro do SLA' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          ticket.status_sla_atendimento === 'Fora do SLA' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          ticket.status_sla_atendimento === 'Em andamento' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {ticket.status_sla_atendimento}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.status_sla_resolucao === 'Dentro do SLA' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          ticket.status_sla_resolucao === 'Fora do SLA' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          ticket.status_sla_resolucao === 'Em andamento' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {ticket.status_sla_resolucao}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Selecione os filtros e clique em "Gerar Relatório" para visualizar os dados
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
