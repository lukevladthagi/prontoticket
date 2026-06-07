"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { FileText, Download, FileSpreadsheet, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Estatisticas {
  total: number;
  sem_tipo_problema: number;
  sem_categoria: number;
  sem_subcategoria: number;
  totalmente_classificados: number;
}

interface DistribuicaoItem {
  total: number;
  resolvidos: number;
  abertos: number;
}

interface TipoProblema extends DistribuicaoItem {
  tipo_problema: string;
}

interface Categoria extends DistribuicaoItem {
  categoria: string;
}

interface Subcategoria extends DistribuicaoItem {
  subcategoria: string;
  categoria: string;
}

interface TicketSemClassificacao {
  id: number;
  numero: string;
  titulo: string;
  tipo_problema: string | null;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  status: string;
  prioridade: string;
  data_abertura: string;
  setor_nome: string;
  solicitante_nome: string;
  categoria_nome: string | null;
  subcategoria_nome: string | null;
}

interface RelatorioData {
  estatisticas: Estatisticas;
  por_tipo_problema: TipoProblema[];
  por_categoria: Categoria[];
  por_subcategoria: Subcategoria[];
  sem_classificacao: TicketSemClassificacao[];
}

interface Setor {
  id: number;
  nome: string;
}

export default function RelatorioClassificacao() {
  const [dados, setDados] = useState<RelatorioData | null>(null);
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

      const response = await fetch(`/api/relatorio-classificacao?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setDados(data);
      } else {
        const errorText = await response.text();
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

  const exportarExcel = () => {
    if (!dados) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Estatísticas
    const statsData = [
      ["Métrica", "Valor"],
      ["Total de Tickets", dados.estatisticas.total],
      ["Sem Tipo de Problema", dados.estatisticas.sem_tipo_problema],
      ["Sem Categoria", dados.estatisticas.sem_categoria],
      ["Sem Subcategoria", dados.estatisticas.sem_subcategoria],
      ["Totalmente Classificados", dados.estatisticas.totalmente_classificados],
      ["% Classificados", dados.estatisticas.total > 0 ? 
        ((dados.estatisticas.totalmente_classificados / dados.estatisticas.total) * 100).toFixed(1) + '%' : '0%']
    ];
    const wsStats = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, "Estatísticas");

    // Sheet 2: Por Tipo de Problema
    const tipoData = dados.por_tipo_problema.map(t => ({
      "Tipo de Problema": t.tipo_problema,
      "Total": t.total,
      "Resolvidos": t.resolvidos,
      "Abertos": t.abertos,
      "% Resolução": t.total > 0 ? ((t.resolvidos / t.total) * 100).toFixed(1) + '%' : '0%'
    }));
    const wsTipo = XLSX.utils.json_to_sheet(tipoData);
    XLSX.utils.book_append_sheet(wb, wsTipo, "Por Tipo");

    // Sheet 3: Por Categoria
    const catData = dados.por_categoria.map(c => ({
      "Categoria": c.categoria,
      "Total": c.total,
      "Resolvidos": c.resolvidos,
      "Abertos": c.abertos,
      "% Resolução": c.total > 0 ? ((c.resolvidos / c.total) * 100).toFixed(1) + '%' : '0%'
    }));
    const wsCat = XLSX.utils.json_to_sheet(catData);
    XLSX.utils.book_append_sheet(wb, wsCat, "Por Categoria");

    // Sheet 4: Por Subcategoria
    const subData = dados.por_subcategoria.map(s => ({
      "Categoria": s.categoria,
      "Subcategoria": s.subcategoria,
      "Total": s.total,
      "Resolvidos": s.resolvidos,
      "Abertos": s.abertos,
      "% Resolução": s.total > 0 ? ((s.resolvidos / s.total) * 100).toFixed(1) + '%' : '0%'
    }));
    const wsSub = XLSX.utils.json_to_sheet(subData);
    XLSX.utils.book_append_sheet(wb, wsSub, "Por Subcategoria");

    // Sheet 5: Tickets Sem Classificação
    const semClassData = dados.sem_classificacao.map(t => ({
      "Número": t.numero,
      "Título": t.titulo,
      "Tipo Problema": t.tipo_problema || "Não especificado",
      "Categoria": t.categoria_nome || "Sem categoria",
      "Subcategoria": t.subcategoria_nome || "Sem subcategoria",
      "Status": t.status,
      "Prioridade": t.prioridade,
      "Setor": t.setor_nome,
      "Solicitante": t.solicitante_nome,
      "Data Abertura": formatarData(t.data_abertura)
    }));
    const wsSemClass = XLSX.utils.json_to_sheet(semClassData);
    XLSX.utils.book_append_sheet(wb, wsSemClass, "Sem Classificação");

    const filename = `relatorio_classificacao_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportarPDF = () => {
    if (!dados) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(16);
    doc.text('Relatório de Classificação de Tickets', 14, 15);
    
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

    // Estatísticas
    let yPos = filtros.length > 0 ? 30 : 24;
    doc.setFontSize(12);
    doc.text('Estatísticas Gerais', 14, yPos);
    yPos += 5;

    const statsData = [
      ['Total de Tickets', dados.estatisticas.total.toString()],
      ['Sem Tipo de Problema', dados.estatisticas.sem_tipo_problema.toString()],
      ['Sem Categoria', dados.estatisticas.sem_categoria.toString()],
      ['Sem Subcategoria', dados.estatisticas.sem_subcategoria.toString()],
      ['Totalmente Classificados', dados.estatisticas.totalmente_classificados.toString()],
      ['% Classificados', dados.estatisticas.total > 0 ? 
        ((dados.estatisticas.totalmente_classificados / dados.estatisticas.total) * 100).toFixed(1) + '%' : '0%']
    ];

    autoTable(doc, {
      head: [['Métrica', 'Valor']],
      body: statsData,
      startY: yPos,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 }
    });

    // Distribuição por Tipo de Problema
    yPos = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('Distribuição por Tipo de Problema', 14, yPos);
    yPos += 5;

    const tipoData = dados.por_tipo_problema.map(t => [
      t.tipo_problema,
      t.total.toString(),
      t.resolvidos.toString(),
      t.abertos.toString(),
      t.total > 0 ? ((t.resolvidos / t.total) * 100).toFixed(1) + '%' : '0%'
    ]);

    autoTable(doc, {
      head: [['Tipo', 'Total', 'Resolvidos', 'Abertos', '% Resolução']],
      body: tipoData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 }
    });

    // Tickets sem classificação (primeira página)
    if (dados.sem_classificacao.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Tickets Sem Classificação Completa (Top 20)', 14, 15);

      const semClassData = dados.sem_classificacao.slice(0, 20).map(t => [
        t.numero,
        t.titulo.substring(0, 30) + (t.titulo.length > 30 ? '...' : ''),
        t.tipo_problema || 'N/A',
        t.categoria_nome || 'N/A',
        t.status
      ]);

      autoTable(doc, {
        head: [['Número', 'Título', 'Tipo', 'Categoria', 'Status']],
        body: semClassData,
        startY: 20,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [239, 68, 68] },
        margin: { left: 14, right: 14 }
      });
    }

    const filename = `relatorio_classificacao_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const calcularPercentual = (parte: number, total: number) => {
    if (total === 0) return 0;
    return ((parte / total) * 100).toFixed(1);
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            Relatório de Classificação de Tickets
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Análise detalhada da distribuição por tipo de problema, categorias e subcategorias
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
        {dados && (
          <>
            {/* Estatísticas Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total de Tickets</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{dados.estatisticas.total}</p>
                  </div>
                  <FileText className="w-12 h-12 text-blue-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Totalmente Classificados</p>
                    <p className="text-3xl font-bold text-green-600">{dados.estatisticas.totalmente_classificados}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {calcularPercentual(dados.estatisticas.totalmente_classificados, dados.estatisticas.total)}%
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-green-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Sem Classificação</p>
                    <p className="text-3xl font-bold text-red-600">
                      {dados.estatisticas.sem_tipo_problema + dados.estatisticas.sem_categoria}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tipo: {dados.estatisticas.sem_tipo_problema} | Cat: {dados.estatisticas.sem_categoria}
                    </p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
              </div>
            </div>

            {/* Botões de Exportação */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
              <div className="flex gap-2 justify-end">
                <button
                  onClick={exportarExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Exportar Excel
                </button>
                <button
                  onClick={exportarPDF}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Exportar PDF
                </button>
              </div>
            </div>

            {/* Gráfico: Distribuição por Tipo de Problema */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Distribuição por Tipo de Problema
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dados.por_tipo_problema} margin={{ bottom: 80 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tipo_problema" angle={-30} textAnchor="end" height={80} style={{ fontSize: '11px' }} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#3b82f6" name="Total" />
                  <Bar dataKey="resolvidos" fill="#10b981" name="Resolvidos" />
                  <Bar dataKey="abertos" fill="#f59e0b" name="Abertos" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela: Top 10 Categorias */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top 10 Categorias
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Resolvidos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Abertos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">% Resolução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dados.por_categoria.slice(0, 10).map((cat, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{cat.categoria}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{cat.total}</td>
                        <td className="px-4 py-3 text-sm text-green-600">{cat.resolvidos}</td>
                        <td className="px-4 py-3 text-sm text-orange-600">{cat.abertos}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {calcularPercentual(cat.resolvidos, cat.total)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela: Tickets Sem Classificação */}
            {dados.sem_classificacao.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-700">
                <div className="p-6 border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                  <h2 className="text-lg font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Tickets Sem Classificação Completa ({dados.sem_classificacao.length})
                  </h2>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Tickets que não possuem tipo de problema ou categoria definidos
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Número</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Título</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Categoria</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dados.sem_classificacao.slice(0, 50).map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                            {ticket.numero}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {ticket.titulo}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.tipo_problema ? (
                              <span className="text-gray-600 dark:text-gray-300">{ticket.tipo_problema}</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 font-semibold">Não especificado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ticket.categoria_nome ? (
                              <span className="text-gray-600 dark:text-gray-300">{ticket.categoria_nome}</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 font-semibold">Sem categoria</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {ticket.status}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {formatarData(ticket.data_abertura)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dados.sem_classificacao.length > 50 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
                    Mostrando 50 de {dados.sem_classificacao.length} tickets. Exporte para Excel para ver todos.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!loading && !dados && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Selecione os filtros e clique em "Gerar Relatório" para visualizar os dados
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
