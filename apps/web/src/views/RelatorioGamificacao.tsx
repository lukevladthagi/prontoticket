"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Trophy, TrendingUp, Award, Target } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RankingTecnico {
  user_id: string;
  user_nome: string;
  total_pontos: number;
  mes_atual: number;
  nivel: number;
  tickets_resolvidos: number;
  media_avaliacao: number;
  tickets_no_sla: number;
  total_resolvidos: number;
}

interface DetalhamentoPontos {
  user_id: string;
  tecnico_nome: string;
  tipo_acao: string;
  descricao: string;
  total_pontos: number;
  quantidade: number;
}

interface HistoricoPonto {
  id: number;
  user_id: string;
  tecnico_nome: string;
  chamado_id: number;
  chamado_numero: string;
  chamado_titulo: string;
  chamado_tipo: string;
  prioridade: string;
  data_abertura: string;
  data_resolucao: string;
  prazo_solucao: string;
  avaliacao_nota: number;
  avaliacao_comentario: string;
  tipo_acao: string;
  pontos: number;
  descricao: string;
  created_at: string;
  status_sla: string;
}

interface EvolucaoPontos {
  user_id: string;
  tecnico_nome: string;
  data: string;
  pontos_dia: number;
}

interface BadgeConquistada {
  user_id: string;
  tecnico_nome: string;
  badge_nome: string;
  badge_descricao: string;
  icone: string;
  data_conquista: string;
}

interface RelatorioData {
  ranking: RankingTecnico[];
  detalhamentoPorTipo: DetalhamentoPontos[];
  historicoCompleto: HistoricoPonto[];
  evolucaoPontos: EvolucaoPontos[];
  badges: BadgeConquistada[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

export default function RelatorioGamificacao() {
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState<string>("todos");
  const [tecnicos, setTecnicos] = useState<{ user_id: string; user_nome: string }[]>([]);
  const [dados, setDados] = useState<RelatorioData | null>(null);

  useEffect(() => {
    carregarTecnicos();
    carregarDados();
  }, []);

  const carregarTecnicos = async () => {
    try {
      const response = await fetch("/api/gamificacao/ranking?limite=100");
      if (response.ok) {
        const ranking = await response.json();
        setTecnicos(ranking.map((r: any) => ({ user_id: r.user_id, user_nome: r.user_nome })));
      }
    } catch (error) {
      console.error("Erro ao carregar técnicos:", error);
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append("data_inicio", dataInicio);
      if (dataFim) params.append("data_fim", dataFim);
      if (tecnicoSelecionado !== "todos") params.append("tecnico_id", tecnicoSelecionado);

      const response = await fetch(`/api/relatorio-gamificacao?${params.toString()}`);
      if (!response.ok) throw new Error("Erro ao carregar dados");

      const data = await response.json();
      setDados(data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    if (!dados) return;

    const wb = XLSX.utils.book_new();

    const wsRanking = XLSX.utils.json_to_sheet(
      dados.ranking.map(r => ({
        'Técnico': r.user_nome,
        'Total Pontos': r.total_pontos,
        'Pontos Mês': r.mes_atual,
        'Nível': r.nivel,
        'Tickets Resolvidos': r.tickets_resolvidos,
        'Média Avaliação': r.media_avaliacao?.toFixed(2) || 'N/A',
        'Taxa SLA': r.total_resolvidos > 0 ? `${((r.tickets_no_sla / r.total_resolvidos) * 100).toFixed(1)}%` : 'N/A'
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking");

    const wsDetalhamento = XLSX.utils.json_to_sheet(
      dados.detalhamentoPorTipo.map(d => ({
        'Técnico': d.tecnico_nome,
        'Tipo Ação': d.tipo_acao,
        'Descrição': d.descricao,
        'Pontos': d.total_pontos,
        'Quantidade': d.quantidade
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsDetalhamento, "Detalhamento por Tipo");

    const wsHistorico = XLSX.utils.json_to_sheet(
      dados.historicoCompleto.map(h => ({
        'Técnico': h.tecnico_nome,
        'Ticket': h.chamado_numero || 'N/A',
        'Título': h.chamado_titulo || 'N/A',
        'Tipo': h.chamado_tipo || 'N/A',
        'Prioridade': h.prioridade || 'N/A',
        'Tipo Ação': h.tipo_acao,
        'Pontos': h.pontos,
        'Descrição': h.descricao,
        'Status SLA': h.status_sla,
        'Avaliação': h.avaliacao_nota || 'N/A',
        'Observação': h.avaliacao_comentario || '',
        'Data': new Date(h.created_at).toLocaleDateString('pt-BR')
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsHistorico, "Histórico Completo");

    XLSX.writeFile(wb, `relatorio-gamificacao-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportarPDF = () => {
    if (!dados) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Gamificação", 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Técnico', 'Pontos', 'Nível', 'Tickets', 'Média']],
      body: dados.ranking.slice(0, 10).map(r => [
        r.user_nome,
        r.total_pontos.toString(),
        r.nivel.toString(),
        r.tickets_resolvidos.toString(),
        r.media_avaliacao?.toFixed(2) || 'N/A'
      ])
    });

    doc.save(`relatorio-gamificacao-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const prepararDadosEvolucao = () => {
    if (!dados || dados.evolucaoPontos.length === 0) return [];

    const porData = dados.evolucaoPontos.reduce((acc, item) => {
      if (!acc[item.data]) {
        acc[item.data] = { data: item.data };
      }
      acc[item.data][item.tecnico_nome] = item.pontos_dia;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(porData);
  };

  const prepararDadosPizza = () => {
    if (!dados) return [];

    const porTipo = dados.detalhamentoPorTipo.reduce((acc, item) => {
      if (!acc[item.descricao]) {
        acc[item.descricao] = 0;
      }
      acc[item.descricao] += item.total_pontos;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(porTipo).map(([name, value]) => ({ name, value }));
  };

  if (loading && !dados) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-purple-600" />
              Relatório de Gamificação
            </h1>
            <p className="text-muted-foreground mt-2">
              Análise detalhada de pontuação e desempenho dos técnicos
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportarExcel} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button onClick={exportarPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Técnico</label>
              <select
                value={tecnicoSelecionado}
                onChange={(e) => setTecnicoSelecionado(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="todos">Todos</option>
                {tecnicos.map(t => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.user_nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={carregarDados} className="w-full" disabled={loading}>
                {loading ? "Carregando..." : "Atualizar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {dados && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Total de Técnicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dados.ranking.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Total de Pontos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dados.ranking.reduce((acc, r) => acc + r.total_pontos, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Tickets Resolvidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dados.ranking.reduce((acc, r) => acc + r.tickets_resolvidos, 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-500" />
                  Badges Conquistadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dados.badges.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ranking de Técnicos</CardTitle>
              <CardDescription>Classificação por total de pontos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="w-12 px-4 py-2 text-left font-medium">#</th>
                      <th className="px-4 py-2 text-left font-medium">Técnico</th>
                      <th className="px-4 py-2 text-right font-medium">Total Pontos</th>
                      <th className="px-4 py-2 text-right font-medium">Pontos Mês</th>
                      <th className="px-4 py-2 text-center font-medium">Nível</th>
                      <th className="px-4 py-2 text-right font-medium">Tickets</th>
                      <th className="px-4 py-2 text-right font-medium">Média Aval.</th>
                      <th className="px-4 py-2 text-right font-medium">Taxa SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.ranking.map((tecnico, index) => (
                      <tr key={tecnico.user_id} className="border-b">
                        <td className="px-4 py-2 font-medium">
                          {index + 1 === 1 && "🥇"}
                          {index + 1 === 2 && "🥈"}
                          {index + 1 === 3 && "🥉"}
                          {index + 1 > 3 && index + 1}
                        </td>
                        <td className="px-4 py-2 font-medium">{tecnico.user_nome}</td>
                        <td className="px-4 py-2 text-right font-bold text-purple-600">
                          {tecnico.total_pontos.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">{tecnico.mes_atual.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline">Nível {tecnico.nivel}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right">{tecnico.tickets_resolvidos}</td>
                        <td className="px-4 py-2 text-right">
                          {tecnico.media_avaliacao ? tecnico.media_avaliacao.toFixed(2) : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {tecnico.total_resolvidos > 0
                            ? `${((tecnico.tickets_no_sla / tecnico.total_resolvidos) * 100).toFixed(1)}%`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Evolução de Pontos</CardTitle>
                <CardDescription>Pontos acumulados por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepararDadosEvolucao()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {tecnicos.slice(0, 5).map((t, index) => (
                      <Line
                        key={t.user_id}
                        type="monotone"
                        dataKey={t.user_nome}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Pontos por Tipo</CardTitle>
                <CardDescription>Total de pontos por categoria</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prepararDadosPizza()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => {
                        const percent = entry.percent || 0;
                        return entry.name ? `${entry.name}: ${(percent * 100).toFixed(0)}%` : '';
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepararDadosPizza().map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico Detalhado de Pontuação</CardTitle>
              <CardDescription>Todos os pontos conquistados ticket por ticket</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Técnico</th>
                      <th className="px-4 py-2 text-left font-medium">Ticket</th>
                      <th className="px-4 py-2 text-left font-medium">Tipo Ação</th>
                      <th className="px-4 py-2 text-left font-medium">Descrição</th>
                      <th className="px-4 py-2 text-right font-medium">Pontos</th>
                      <th className="px-4 py-2 text-left font-medium">SLA</th>
                      <th className="px-4 py-2 text-left font-medium">Avaliação</th>
                      <th className="px-4 py-2 text-left font-medium">Observação</th>
                      <th className="px-4 py-2 text-left font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.historicoCompleto.slice(0, 100).map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{item.tecnico_nome}</td>
                        <td className="px-4 py-2">
                          {item.chamado_numero ? (
                            <a 
                              href={`/chamados/${item.chamado_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              #{item.chamado_numero}
                            </a>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{item.tipo_acao}</Badge>
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate">{item.descricao}</td>
                        <td className="px-4 py-2 text-right font-bold text-purple-600">
                          +{item.pontos}
                        </td>
                        <td className="px-4 py-2">
                          {item.status_sla === 'Dentro do SLA' && (
                            <Badge className="bg-green-100 text-green-800">No SLA</Badge>
                          )}
                          {item.status_sla === 'Fora do SLA' && (
                            <Badge className="bg-red-100 text-red-800">Fora SLA</Badge>
                          )}
                          {item.status_sla === 'N/A' && <span className="text-muted-foreground">N/A</span>}
                        </td>
                        <td className="px-4 py-2">
                          {item.avaliacao_nota ? `⭐ ${item.avaliacao_nota}/5` : 'N/A'}
                        </td>
                        <td className="px-4 py-2 max-w-xs">
                          <div className="truncate" title={item.avaliacao_comentario || ''}>
                            {item.avaliacao_comentario || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {dados.badges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Badges Conquistadas</CardTitle>
                <CardDescription>Conquistas dos técnicos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dados.badges.map((badge, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="text-4xl">{badge.icone}</div>
                      <div className="flex-1">
                        <div className="font-semibold">{badge.badge_nome}</div>
                        <div className="text-sm text-muted-foreground">{badge.tecnico_nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(badge.data_conquista).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
      </div>
    </Layout>
  );
}
