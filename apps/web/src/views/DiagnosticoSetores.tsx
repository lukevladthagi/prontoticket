"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface DiagnosticoData {
  todos_setores: any[];
  tickets_por_setor: any[];
  todos_tickets: any[];
  historico_setores: any[];
  setores_problematicos: any[];
  tickets_problematicos: any[];
}

export default function DiagnosticoSetores() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [erro, setErro] = useState('');

  const fetchDiagnostico = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/diagnostico-setores');
      if (!res.ok) throw new Error('Erro ao carregar diagnóstico');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostico();
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Diagnóstico Completo de Setores</h1>
            <p className="text-muted-foreground mt-2">Análise detalhada de todos os tickets e setores do sistema</p>
          </div>
          <button
            onClick={fetchDiagnostico}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="animate-spin w-8 h-8 text-blue-600" />
            <span className="ml-3 text-lg">Carregando diagnóstico completo...</span>
          </div>
        )}

        {erro && (
          <Card className="border-red-300">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span>{erro}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Resumo Geral */}
            <Card className="border-2 border-blue-500">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle>📊 Resumo Geral</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-600">{data.todos_setores.length}</div>
                    <div className="text-sm text-muted-foreground mt-1">Setores Cadastrados</div>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-600">{data.todos_tickets.length}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total de Tickets</div>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-3xl font-bold text-orange-600">{data.tickets_problematicos.length}</div>
                    <div className="text-sm text-muted-foreground mt-1">Tickets em Setores 7-13</div>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-3xl font-bold text-purple-600">{data.historico_setores.length}</div>
                    <div className="text-sm text-muted-foreground mt-1">Mudanças de Setor</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Setores Problemáticos */}
            <Card className="border-2 border-red-500">
              <CardHeader className="bg-red-50 dark:bg-red-900/20">
                <CardTitle>⚠️ Setores Problemáticos (IDs 7-13)</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Manutenção: 7 (ativo) / 8 (inativo) | Hotelaria: 8 (ativo) / 9,10 (verificar) | Rouparia: 12 (inativo) / 13 (ativo)
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-2 mb-6">
                  {data.setores_problematicos.map((setor: any) => (
                    <div key={setor.id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold text-lg">ID {setor.id}</span>
                        <span className="ml-3 font-semibold">{setor.nome}</span>
                      </div>
                      <span className={`px-3 py-1 rounded font-semibold ${setor.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {setor.ativo ? '✓ ATIVO' : '✗ INATIVO'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Tickets nestes setores ({data.tickets_problematicos.length} total):</h3>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {data.tickets_problematicos.map((ticket: any) => (
                      <div key={ticket.numero} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-blue-600">{ticket.numero}</span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              ticket.setor_ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              Setor {ticket.setor_destino_id}: {ticket.setor_nome}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">{ticket.status}</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {ticket.titulo?.substring(0, 80) || 'Sem título'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Criado: {new Date(ticket.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distribuição por Setor */}
            <Card>
              <CardHeader>
                <CardTitle>📈 Distribuição de Tickets por Setor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.tickets_por_setor.map((item: any) => (
                    <div key={item.setor_destino_id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold">Setor {item.setor_destino_id}</span>
                        <span className="ml-2 text-muted-foreground">{item.setor_nome || 'Nome não encontrado'}</span>
                        {item.setor_ativo === 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">INATIVO</span>
                        )}
                      </div>
                      <span className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-lg">
                        {item.total}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Histórico de Mudanças */}
            <Card>
              <CardHeader>
                <CardTitle>📜 Histórico de Mudanças de Setor (últimas 200)</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Registros de transferências e mudanças de setor</p>
              </CardHeader>
              <CardContent>
                {data.historico_setores.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma mudança de setor registrada</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {data.historico_setores.map((hist: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">Ticket #{hist.chamado_id}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(hist.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-sm">{hist.descricao}</div>
                        <div className="text-xs text-muted-foreground mt-1">Por: {hist.usuario_nome}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Todos os Setores */}
            <Card>
              <CardHeader>
                <CardTitle>🏢 Todos os Setores Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.todos_setores.map((setor: any) => (
                    <div key={setor.id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold">ID {setor.id}</span>
                        <span className="ml-2">{setor.nome}</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${setor.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {setor.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
