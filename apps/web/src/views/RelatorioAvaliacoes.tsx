"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Star, MessageSquare, Target, Download, FileSpreadsheet, Calendar, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AvaliacaoRelatorio {
  id: number;
  numero: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  status: string;
  avaliacao_nota: number;
  avaliacao_comentario: string | null;
  avaliacao_nps: number;
  avaliacao_resolveu: number;
  avaliacao_data: string;
  data_abertura: string;
  data_resolucao: string | null;
  solicitante_nome: string;
  solicitante_email: string;
  setor_nome: string;
  tecnico_nome: string | null;
}

interface Setor {
  id: number;
  nome: string;
}

export default function RelatorioAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRelatorio[]>([]);
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

      const response = await fetch(`/api/relatorio-avaliacoes?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAvaliacoes(data);
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
    return new Date(data).toLocaleString("pt-BR");
  };

  const getNpsCategoria = (nps: number) => {
    if (nps >= 9) return { label: "Promotor", color: "text-green-600 bg-green-50" };
    if (nps >= 7) return { label: "Neutro", color: "text-yellow-600 bg-yellow-50" };
    return { label: "Detrator", color: "text-red-600 bg-red-50" };
  };

  const processarComentario = (comentario: string | null): string => {
    // Se vazio, nulo ou "-", retornar padrão
    if (!comentario || comentario.trim() === '' || comentario.trim() === '-') {
      return 'Sem comentário';
    }

    let texto = comentario.trim();

    // Mapa de correções para textos genéricos
    const correcoes: Record<string, string> = {
      'AGUARDANDO': 'Aguardando andamento',
      'EM ANALISE': 'Em análise',
      'EM ANÁLISE': 'Em análise',
      'PENDENTE': 'Pendente de ação',
    };

    // Se o texto está totalmente em maiúsculas e tem mais de 3 caracteres
    if (texto === texto.toUpperCase() && texto.length > 3 && /[A-Z]/.test(texto)) {
      // Verificar se tem correção específica
      if (correcoes[texto]) {
        texto = correcoes[texto];
      } else {
        // Converter para primeira letra maiúscula
        texto = texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
      }
    }

    // Limitar a 120 caracteres
    if (texto.length > 120) {
      texto = texto.substring(0, 120);
    }

    return texto;
  };

  const formatarComentarioExibicao = (comentario: string): string => {
    if (comentario.length > 80) {
      return comentario.substring(0, 80) + '...';
    }
    return comentario;
  };

  const temPalavraImportante = (texto: string): boolean => {
    const palavrasImportantes = ['erro', 'falha', 'urgente', 'crítico', 'problema', 'bug'];
    const textoLower = texto.toLowerCase();
    return palavrasImportantes.some(palavra => textoLower.includes(palavra));
  };

  const calcularEstatisticas = () => {
    if (avaliacoes.length === 0) return null;

    const totalAvaliacoes = avaliacoes.length;
    const somaNotas = avaliacoes.reduce((acc, av) => acc + av.avaliacao_nota, 0);
    const mediaSatisfacao = somaNotas / totalAvaliacoes;

    const promotores = avaliacoes.filter(av => av.avaliacao_nps >= 9).length;
    const neutros = avaliacoes.filter(av => av.avaliacao_nps >= 7 && av.avaliacao_nps < 9).length;
    const detratores = avaliacoes.filter(av => av.avaliacao_nps < 7).length;

    const npsScore = ((promotores - detratores) / totalAvaliacoes) * 100;

    const resolvidos = avaliacoes.filter(av => av.avaliacao_resolveu === 1).length;
    const percentualResolvidos = (resolvidos / totalAvaliacoes) * 100;

    return {
      totalAvaliacoes,
      mediaSatisfacao,
      npsScore,
      promotores,
      neutros,
      detratores,
      percentualResolvidos,
    };
  };

  const exportarExcel = () => {
    const dadosExcel = avaliacoes.map(av => ({
      'Ticket': av.numero,
      'Título': av.titulo,
      'Setor': av.setor_nome,
      'Tipo': av.tipo,
      'Prioridade': av.prioridade,
      'Solicitante': av.solicitante_nome,
      'Email': av.solicitante_email,
      'Técnico': av.tecnico_nome || '-',
      'Nota Satisfação': av.avaliacao_nota,
      'NPS': av.avaliacao_nps,
      'Categoria NPS': getNpsCategoria(av.avaliacao_nps).label,
      'Resolveu?': av.avaliacao_resolveu ? 'Sim' : 'Não',
      'Comentário': processarComentario(av.avaliacao_comentario),
      'Data Avaliação': formatarData(av.avaliacao_data),
      'Data Abertura': formatarData(av.data_abertura),
      'Data Resolução': formatarData(av.data_resolucao),
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Avaliações");
    XLSX.writeFile(wb, `relatorio-avaliacoes-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.text('Relatório de Avaliações', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);
    
    const stats = calcularEstatisticas();
    if (stats) {
      doc.text(`Total de Avaliações: ${stats.totalAvaliacoes}`, 14, 28);
      doc.text(`Satisfação Média: ${stats.mediaSatisfacao.toFixed(1)}/5.0`, 80, 28);
      doc.text(`NPS: ${stats.npsScore.toFixed(1)}`, 160, 28);
      doc.text(`Resolvidos: ${stats.percentualResolvidos.toFixed(1)}%`, 200, 28);
    }

    const dadosTabela = avaliacoes.map(av => [
      av.numero,
      av.setor_nome,
      av.solicitante_nome,
      av.tecnico_nome || '-',
      av.avaliacao_nota.toString(),
      av.avaliacao_nps.toString(),
      getNpsCategoria(av.avaliacao_nps).label,
      av.avaliacao_resolveu ? 'Sim' : 'Não',
      formatarComentarioExibicao(processarComentario(av.avaliacao_comentario)),
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Ticket', 'Setor', 'Solicitante', 'Técnico', 'Nota', 'NPS', 'Categoria', 'Resolveu?', 'Comentário']],
      body: dadosTabela,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`relatorio-avaliacoes-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const stats = calcularEstatisticas();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Relatório de Avaliações</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Análise de satisfação e NPS dos chamados
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Setor
              </label>
              <select
                value={setorSelecionado}
                onChange={(e) => setSetorSelecionado(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                <Calendar size={16} className="inline mr-1" />
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </button>

            {avaliacoes.length > 0 && (
              <>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
                >
                  <FileSpreadsheet size={18} />
                  Exportar Excel
                </button>

                <button
                  onClick={exportarPDF}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-md hover:shadow-lg"
                >
                  <Download size={18} />
                  Exportar PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total de Avaliações</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAvaliacoes}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Satisfação Média</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.mediaSatisfacao.toFixed(1)}/5.0</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">NPS Score</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.npsScore.toFixed(1)}</p>
                </div>
              </div>
              <div className="flex gap-2 text-xs mt-3">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  Promotores: {stats.promotores}
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                  Neutros: {stats.neutros}
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                  Detratores: {stats.detratores}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tickets Resolvidos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.percentualResolvidos.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Avaliações */}
        {avaliacoes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Setor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Solicitante</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Técnico</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Satisfação</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">NPS</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Resolveu?</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Comentário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data Avaliação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {avaliacoes.map((av) => {
                    const npsCategoria = getNpsCategoria(av.avaliacao_nps);
                    const comentarioProcessado = processarComentario(av.avaliacao_comentario);
                    const comentarioExibicao = formatarComentarioExibicao(comentarioProcessado);
                    const ehImportante = temPalavraImportante(comentarioProcessado);
                    
                    return (
                      <tr key={av.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">{av.numero}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{av.setor_nome}</td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{av.solicitante_nome}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{av.solicitante_email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{av.tecnico_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={16}
                                className={i < av.avaliacao_nota ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                              />
                            ))}
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{av.avaliacao_nota}/5</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${npsCategoria.color}`}>
                            {av.avaliacao_nps} - {npsCategoria.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            av.avaliacao_resolveu ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {av.avaliacao_resolveu ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div 
                            className="max-w-md relative group cursor-help"
                            title={comentarioProcessado}
                          >
                            <div className={`break-words ${
                              ehImportante 
                                ? 'text-orange-700 dark:text-orange-400 font-medium flex items-center gap-1' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {ehImportante && <AlertCircle size={14} className="flex-shrink-0" />}
                              <span>{comentarioExibicao}</span>
                            </div>
                            {comentarioProcessado.length > 80 && (
                              <div className="hidden group-hover:block absolute z-10 w-64 p-3 mt-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg break-words">
                                {comentarioProcessado}
                                <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatarData(av.avaliacao_data)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && avaliacoes.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Nenhuma avaliação encontrada. Configure os filtros e clique em "Gerar Relatório".
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
