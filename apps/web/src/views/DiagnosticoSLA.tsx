"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Chamado {
  id: number;
  numero: string;
  status: string;
  data_abertura: string;
  data_resolucao: string | null;
  prazo_solucao: string | null;
  sla_status?: string;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  categoria_nome: string | null;
  subcategoria_nome: string | null;
  item_nome: string | null;
  sla_nome: string | null;
  tempo_solucao_minutos: number | null;
}

interface ChamadoDetalhado {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  prioridade: string;
  tipo_chamado: string;
  data_abertura: string;
  data_resolucao: string | null;
  prazo_solucao: string | null;
  prazo_resposta: string | null;
  sla_id: number | null;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  categoria_nome: string | null;
  subcategoria_nome: string | null;
  item_nome: string | null;
  sla_nome: string | null;
  tempo_solucao_minutos: number | null;
  tempo_resposta_minutos: number | null;
  setor_nome: string | null;
}

interface DiagnosticoData {
  total_chamados: number;
  ultimos_chamados: Chamado[];
  chamados_resolvidos: Chamado[];
  todos_chamados_detalhados: ChamadoDetalhado[];
  estatisticas_resolvidos: {
    total: number;
    com_sla_configurado: number;
    sem_prazo_solucao: number;
    sem_data_resolucao: number;
  };
  sla_calculo: {
    total: number;
    dentro_sla: number;
  };
  sla_percentual: string;
  tempo_medio_resolucao: {
    minutos: number | null;
    horas: number | null;
    formatado: string;
  };
}

export default function DiagnosticoSLA() {
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiagnostico();
  }, []);

  const loadDiagnostico = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/diagnostico-chamados/verificar');
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando diagnóstico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar diagnóstico</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button 
              onClick={loadDiagnostico}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Tentar novamente
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Diagnóstico de SLA</h1>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Chamados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.total_chamados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Chamados Resolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.estatisticas_resolvidos.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.estatisticas_resolvidos.com_sla_configurado} com SLA configurado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA de Resolução</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.sla_percentual}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.sla_calculo.dentro_sla} de {data.sla_calculo.total} dentro do prazo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio Resolução</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.tempo_medio_resolucao.formatado}</p>
            {data.tempo_medio_resolucao.minutos && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(data.tempo_medio_resolucao.minutos)} minutos
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diagnóstico de Problemas */}
      {(data.estatisticas_resolvidos.sem_prazo_solucao > 0 || data.estatisticas_resolvidos.sem_data_resolucao > 0) && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-400">⚠️ Problemas Detectados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.estatisticas_resolvidos.sem_prazo_solucao > 0 && (
              <p className="text-sm">
                <strong>{data.estatisticas_resolvidos.sem_prazo_solucao}</strong> chamados resolvidos{' '}
                <strong>SEM prazo_solucao</strong> (SLA não foi calculado na criação)
              </p>
            )}
            {data.estatisticas_resolvidos.sem_data_resolucao > 0 && (
              <p className="text-sm">
                <strong>{data.estatisticas_resolvidos.sem_data_resolucao}</strong> chamados com status Resolvido/Fechado{' '}
                <strong>SEM data_resolucao</strong> (data não foi registrada)
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Esses chamados não aparecem no cálculo de SLA do dashboard porque faltam dados obrigatórios.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chamados Resolvidos */}
      <Card>
        <CardHeader>
          <CardTitle>Chamados Resolvidos (com SLA)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.chamados_resolvidos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum chamado resolvido encontrado com dados de SLA
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Número</th>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-left p-2">SLA Configurado</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Data Resolução</th>
                    <th className="text-left p-2">Prazo SLA</th>
                    <th className="text-left p-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.chamados_resolvidos.map((chamado) => (
                    <tr key={chamado.id} className="border-b">
                      <td className="p-2 font-mono">{chamado.numero}</td>
                      <td className="p-2 text-xs">
                        {chamado.item_nome ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">{chamado.categoria_nome}</span>
                            <span className="text-muted-foreground">→ {chamado.subcategoria_nome}</span>
                            <span className="font-semibold">→ {chamado.item_nome}</span>
                          </div>
                        ) : chamado.categoria_nome ? (
                          <span>{chamado.categoria_nome}</span>
                        ) : (
                          <span className="text-destructive">Sem categoria</span>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        {chamado.sla_nome ? (
                          <div>
                            <div className="font-semibold">{chamado.sla_nome}</div>
                            <div className="text-muted-foreground">
                              {chamado.tempo_solucao_minutos ? `${chamado.tempo_solucao_minutos} min` : '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-destructive">Sem SLA</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary">{chamado.status}</Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {chamado.data_resolucao 
                          ? new Date(chamado.data_resolucao).toLocaleString('pt-BR')
                          : '-'}
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {chamado.prazo_solucao 
                          ? new Date(chamado.prazo_solucao).toLocaleString('pt-BR')
                          : '-'}
                      </td>
                      <td className="p-2">
                        {chamado.sla_status === 'DENTRO' ? (
                          <Badge className="bg-green-500">✓ Dentro do SLA</Badge>
                        ) : (
                          <Badge variant="destructive">✗ Fora do SLA</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimos Chamados */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos 20 Chamados Criados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Número</th>
                  <th className="text-left p-2">Categoria Selecionada</th>
                  <th className="text-left p-2">SLA</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Data Abertura</th>
                  <th className="text-left p-2">Prazo SLA</th>
                  <th className="text-left p-2">Data Resolução</th>
                </tr>
              </thead>
              <tbody>
                {data.ultimos_chamados.map((chamado) => (
                  <tr key={chamado.id} className="border-b">
                    <td className="p-2 font-mono">{chamado.numero}</td>
                    <td className="p-2 text-xs">
                      {chamado.item_nome ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground">{chamado.categoria_nome}</span>
                          <span className="text-muted-foreground">→ {chamado.subcategoria_nome}</span>
                          <span className="font-semibold">→ {chamado.item_nome}</span>
                        </div>
                      ) : chamado.categoria_nome ? (
                        <span>{chamado.categoria_nome}</span>
                      ) : (
                        <span className="text-destructive">Sem categoria</span>
                      )}
                    </td>
                    <td className="p-2 text-xs">
                      {chamado.sla_nome ? (
                        <div>
                          <div className="font-medium">{chamado.tempo_solucao_minutos} min</div>
                          <div className="text-muted-foreground text-xs">{chamado.sla_nome}</div>
                        </div>
                      ) : (
                        <span className="text-destructive">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge 
                        variant={chamado.status === 'Resolvido' || chamado.status === 'Fechado' ? 'default' : 'secondary'}
                      >
                        {chamado.status}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {new Date(chamado.data_abertura).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {chamado.prazo_solucao 
                        ? new Date(chamado.prazo_solucao).toLocaleString('pt-BR')
                        : <span className="text-destructive">SEM SLA</span>}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {chamado.data_resolucao 
                        ? new Date(chamado.data_resolucao).toLocaleString('pt-BR')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada de TODOS os Chamados */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada - Todos os Chamados</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tabela completa com todas as informações para identificar problemas de configuração
          </p>
        </CardHeader>
        <CardContent>
          {data.todos_chamados_detalhados.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum chamado encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 sticky left-0 bg-background">Número</th>
                    <th className="text-left p-2">Título</th>
                    <th className="text-left p-2">Setor</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Prioridade</th>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-left p-2">Subcategoria</th>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">SLA Aplicado</th>
                    <th className="text-left p-2">Tempo SLA</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Prazo Solução</th>
                    <th className="text-left p-2">Data Resolução</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todos_chamados_detalhados.map((chamado) => {
                    const semCategoria = !chamado.categoria_id && !chamado.subcategoria_id && !chamado.item_id;
                    const semSLA = !chamado.sla_id || !chamado.prazo_solucao;
                    const problematico = semCategoria || semSLA;

                    return (
                      <tr 
                        key={chamado.id} 
                        className={`border-b ${problematico ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                      >
                        <td className="p-2 font-mono font-semibold sticky left-0 bg-background">{chamado.numero}</td>
                        <td className="p-2 max-w-xs truncate" title={chamado.titulo}>
                          {chamado.titulo}
                        </td>
                        <td className="p-2 text-xs">
                          {chamado.setor_nome || '-'}
                        </td>
                        <td className="p-2 text-xs">
                          <Badge variant="outline">{chamado.tipo_chamado}</Badge>
                        </td>
                        <td className="p-2 text-xs">
                          <Badge 
                            variant={chamado.prioridade === 'P1' ? 'destructive' : 'secondary'}
                          >
                            {chamado.prioridade}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs">
                          {chamado.categoria_nome ? (
                            <span>{chamado.categoria_nome}</span>
                          ) : (
                            <span className="text-destructive font-semibold">-</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {chamado.subcategoria_nome ? (
                            <span>{chamado.subcategoria_nome}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {chamado.item_nome ? (
                            <span className="font-semibold">{chamado.item_nome}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {chamado.sla_nome ? (
                            <span>{chamado.sla_nome}</span>
                          ) : (
                            <span className="text-destructive font-semibold">SEM SLA</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {chamado.tempo_solucao_minutos ? (
                            <span className="font-mono">{chamado.tempo_solucao_minutos}min</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge 
                            variant={
                              chamado.status === 'Resolvido' || chamado.status === 'Fechado' 
                                ? 'default' 
                                : 'secondary'
                            }
                          >
                            {chamado.status}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {chamado.prazo_solucao ? (
                            new Date(chamado.prazo_solucao).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          ) : (
                            <span className="text-destructive font-semibold">SEM PRAZO</span>
                          )}
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {chamado.data_resolucao ? (
                            new Date(chamado.data_resolucao).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <button 
          onClick={loadDiagnostico}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Atualizar Dados
        </button>
      </div>
    </div>
  );
}
