"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Building2, Download, FileSpreadsheet, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SetorSolicitante {
  setor_solicitante: string;
  setor_solicitante_id: number | null;
  total: number;
  novos: number;
  em_andamento: number;
  aguardando: number;
  resolvidos: number;
  fechados: number;
  cancelados: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  tempo_medio_resolucao_minutos: number;
  satisfacao_media: number;
  total_avaliacoes: number;
}

interface SetorTipo {
  setor_solicitante: string;
  tipo_problema: string;
  total: number;
}

interface SetorPrioridade {
  setor_solicitante: string;
  prioridade: string;
  total: number;
}

interface Estatisticas {
  total_chamados: number;
  total_setores: number;
  total_resolvidos: number;
  tempo_medio_geral: number;
}

interface DadosRelatorio {
  por_setor_solicitante: SetorSolicitante[];
  por_setor_e_tipo: SetorTipo[];
  por_setor_e_prioridade: SetorPrioridade[];
  estatisticas: Estatisticas;
}

export default function RelatorioSetores() {
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [setorDestinoId, setSetorDestinoId] = useState("todos");
  const [setores, setSetores] = useState<Array<{ id: number; nome: string }>>([]);

  useEffect(() => {
    carregarSetores();
  }, []);

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim, setorDestinoId]);

  const carregarSetores = async () => {
    try {
      const response = await fetch("/api/setores");
      if (response.ok) {
        const data = await response.json();
        setSetores(data.filter((s: any) => s.ativo));
      }
    } catch (error) {
      console.error("Erro ao carregar setores:", error);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dataInicio) params.append("data_inicio", dataInicio);
      if (dataFim) params.append("data_fim", dataFim);
      if (setorDestinoId && setorDestinoId !== "todos") params.append("setor_destino_id", setorDestinoId);

      const response = await fetch(`/api/relatorio-setores?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setDados(data);
      } else {
        console.error("Erro ao carregar dados do relatório");
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatarTempo = (minutos: number | null) => {
    if (!minutos) return "N/A";
    if (minutos < 60) return `${Math.round(minutos)}min`;
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return `${horas}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  const exportarExcel = () => {
    if (!dados) return;

    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo por Setor
    const wsResumo = XLSX.utils.json_to_sheet(
      dados.por_setor_solicitante.map(item => ({
        'Setor Solicitante': item.setor_solicitante,
        'Total de Chamados': item.total,
        'Novos': item.novos,
        'Em Andamento': item.em_andamento,
        'Aguardando': item.aguardando,
        'Resolvidos': item.resolvidos,
        'Fechados': item.fechados,
        'Cancelados': item.cancelados,
        'P1': item.p1,
        'P2': item.p2,
        'P3': item.p3,
        'P4': item.p4,
        'Tempo Médio Resolução': formatarTempo(item.tempo_medio_resolucao_minutos),
        'Satisfação Média': item.satisfacao_media?.toFixed(1) || 'N/A',
        'Total Avaliações': item.total_avaliacoes
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Setor');

    // Aba 2: Por Tipo de Problema
    const wsTipo = XLSX.utils.json_to_sheet(
      dados.por_setor_e_tipo.map(item => ({
        'Setor Solicitante': item.setor_solicitante,
        'Tipo de Problema': item.tipo_problema,
        'Total': item.total
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsTipo, 'Por Tipo de Problema');

    // Aba 3: Por Prioridade
    const wsPrioridade = XLSX.utils.json_to_sheet(
      dados.por_setor_e_prioridade.map(item => ({
        'Setor Solicitante': item.setor_solicitante,
        'Prioridade': item.prioridade,
        'Total': item.total
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsPrioridade, 'Por Prioridade');

    XLSX.writeFile(wb, `relatorio_setores_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportarPDF = () => {
    if (!dados) return;

    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Chamados por Setor Solicitante', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);
    
    if (dataInicio || dataFim) {
      doc.text(`Período: ${dataInicio || 'início'} até ${dataFim || 'hoje'}`, 14, 28);
    }

    // Estatísticas gerais
    doc.setFontSize(12);
    doc.text('Estatísticas Gerais', 14, 38);
    doc.setFontSize(10);
    doc.text(`Total de Chamados: ${dados.estatisticas.total_chamados}`, 14, 44);
    doc.text(`Setores Ativos: ${dados.estatisticas.total_setores}`, 14, 50);
    doc.text(`Chamados Resolvidos: ${dados.estatisticas.total_resolvidos}`, 14, 56);
    doc.text(`Tempo Médio de Resolução: ${formatarTempo(dados.estatisticas.tempo_medio_geral)}`, 14, 62);

    // Tabela resumo por setor
    autoTable(doc, {
      startY: 70,
      head: [['Setor', 'Total', 'Novos', 'Andamento', 'Resolvidos', 'Fechados', 'Tempo Médio', 'Satisfação']],
      body: dados.por_setor_solicitante.map(item => [
        item.setor_solicitante,
        item.total,
        item.novos,
        item.em_andamento,
        item.resolvidos,
        item.fechados,
        formatarTempo(item.tempo_medio_resolucao_minutos),
        item.satisfacao_media ? item.satisfacao_media.toFixed(1) : 'N/A'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 92, 246] }
    });

    doc.save(`relatorio_setores_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando relatório...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!dados) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Erro ao carregar dados do relatório</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Relatório por Setor Solicitante</h1>
            </div>
            <p className="text-muted-foreground">
              Análise de chamados agrupados por setor de origem
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={exportarPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Setor Destino</label>
              <select
                value={setorDestinoId}
                onChange={(e) => setSetorDestinoId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="todos">Todos os setores</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total de Chamados</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{dados.estatisticas.total_chamados}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Setores Ativos</span>
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{dados.estatisticas.total_setores}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Resolvidos</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{dados.estatisticas.total_resolvidos}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tempo Médio</span>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold">{formatarTempo(dados.estatisticas.tempo_medio_geral)}</p>
          </div>
        </div>

        {/* Gráfico de barras - Top 10 setores */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Chamados por Setor Solicitante</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dados.por_setor_solicitante.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="setor_solicitante" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#8B5CF6" name="Total" />
              <Bar dataKey="resolvidos" fill="#10B981" name="Resolvidos" />
              <Bar dataKey="em_andamento" fill="#3B82F6" name="Em Andamento" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela detalhada */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Detalhamento por Setor</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Setor Solicitante</th>
                  <th className="text-center p-3 font-semibold">Total</th>
                  <th className="text-center p-3 font-semibold">Novos</th>
                  <th className="text-center p-3 font-semibold">Em Andamento</th>
                  <th className="text-center p-3 font-semibold">Aguardando</th>
                  <th className="text-center p-3 font-semibold">Resolvidos</th>
                  <th className="text-center p-3 font-semibold">Fechados</th>
                  <th className="text-center p-3 font-semibold">P1</th>
                  <th className="text-center p-3 font-semibold">P2</th>
                  <th className="text-center p-3 font-semibold">P3</th>
                  <th className="text-center p-3 font-semibold">P4</th>
                  <th className="text-center p-3 font-semibold">Tempo Médio</th>
                  <th className="text-center p-3 font-semibold">Satisfação</th>
                </tr>
              </thead>
              <tbody>
                {dados.por_setor_solicitante.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-3">{item.setor_solicitante}</td>
                    <td className="p-3 text-center font-semibold">{item.total}</td>
                    <td className="p-3 text-center">{item.novos}</td>
                    <td className="p-3 text-center">{item.em_andamento}</td>
                    <td className="p-3 text-center">{item.aguardando}</td>
                    <td className="p-3 text-center text-green-600">{item.resolvidos}</td>
                    <td className="p-3 text-center text-gray-600">{item.fechados}</td>
                    <td className="p-3 text-center text-red-600">{item.p1}</td>
                    <td className="p-3 text-center text-orange-600">{item.p2}</td>
                    <td className="p-3 text-center text-yellow-600">{item.p3}</td>
                    <td className="p-3 text-center text-blue-600">{item.p4}</td>
                    <td className="p-3 text-center">{formatarTempo(item.tempo_medio_resolucao_minutos)}</td>
                    <td className="p-3 text-center">
                      {item.satisfacao_media ? (
                        <span className={`font-semibold ${
                          item.satisfacao_media >= 4 ? 'text-green-600' :
                          item.satisfacao_media >= 3 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {item.satisfacao_media.toFixed(1)}
                        </span>
                      ) : 'N/A'}
                      {item.total_avaliacoes > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.total_avaliacoes})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
