"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Categoria {
  id: number;
  nome: string;
  setor_id: number | null;
  tipo: string | null;
  ativo: number;
}

interface SLA {
  id: number;
  setor_id: number;
  tipo_chamado: string;
  prioridade: string;
  categoria_id: number | null;
  tempo_resposta_minutos: number;
  tempo_solucao_minutos: number;
}

interface Ticket {
  id: number;
  numero: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  setor_destino_id: number;
  categoria_id: number | null;
  categoria_nome: string | null;
  categoria_setor_id: number | null;
  categoria_tipo: string | null;
  sla_id: number | null;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  data_abertura: string;
}

interface Setor {
  id: number;
  nome: string;
  ativo: number;
}

interface DiagnosticoData {
  categorias_hotelaria: Categoria[];
  slas_hotelaria: SLA[];
  tickets_hotelaria: Ticket[];
  setores: Setor[];
  categorias_antigas: Categoria[];
  sla_categoria_691: SLA[];
  sla_categoria_34: SLA[];
}

export default function DiagnosticoProducao() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carregarDiagnostico = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostico-producao/hotelaria', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar diagnóstico');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${ok ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
      {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Diagnóstico de Produção - Hotelaria</h2>
          <p className="text-sm text-muted-foreground">Verifica se as categorias e SLAs estão configurados corretamente</p>
        </div>
        <Button onClick={carregarDiagnostico} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Carregando...' : 'Carregar Diagnóstico'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo da Verificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <StatusBadge 
                  ok={data.categorias_hotelaria.some(c => c.id >= 688 && c.id <= 697 && c.tipo === 'categoria')} 
                  label="Categorias 688-697 com tipo='categoria'" 
                />
                <StatusBadge 
                  ok={data.categorias_antigas.every(c => c.ativo === 0)} 
                  label="Categorias antigas desativadas" 
                />
                <StatusBadge 
                  ok={data.slas_hotelaria.length > 0} 
                  label={`SLAs de Hotelaria: ${data.slas_hotelaria.length}`} 
                />
                <StatusBadge 
                  ok={data.sla_categoria_691.length > 0} 
                  label="SLA para categoria 691" 
                />
                <StatusBadge 
                  ok={data.sla_categoria_34.length === 0} 
                  label="Categoria 34 sem SLA (esperado)" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Setores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Setores (Hotelaria)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.setores.map((s) => (
                    <tr key={s.id} className="border-b dark:border-gray-700">
                      <td className="p-2">{s.id}</td>
                      <td className="p-2">{s.nome}</td>
                      <td className="p-2">
                        {s.ativo ? (
                          <span className="text-green-600 dark:text-green-400">✓ Sim</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">✗ Não</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Categorias Antigas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Categorias Antigas (devem estar desativadas)
                {data.categorias_antigas.some(c => c.ativo === 1) && (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Setor ID</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categorias_antigas.map((c) => (
                    <tr key={c.id} className={`border-b dark:border-gray-700 ${c.ativo === 1 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                      <td className="p-2">{c.id}</td>
                      <td className="p-2">{c.nome}</td>
                      <td className="p-2">{c.setor_id || 'NULL'}</td>
                      <td className="p-2">{c.tipo || 'NULL'}</td>
                      <td className="p-2">
                        {c.ativo ? (
                          <span className="text-red-600 dark:text-red-400 font-bold">⚠️ ATIVO (problema!)</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">✓ Desativado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Categorias Novas de Hotelaria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categorias de Hotelaria (688-697)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Setor ID</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categorias_hotelaria.filter(c => c.id >= 688 && c.id <= 697).map((c) => (
                    <tr key={c.id} className={`border-b dark:border-gray-700 ${c.tipo !== 'categoria' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                      <td className="p-2">{c.id}</td>
                      <td className="p-2">{c.nome}</td>
                      <td className="p-2">{c.setor_id}</td>
                      <td className="p-2">
                        {c.tipo === 'categoria' ? (
                          <span className="text-green-600 dark:text-green-400">✓ categoria</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">⚠️ {c.tipo || 'NULL'}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {c.ativo ? (
                          <span className="text-green-600 dark:text-green-400">✓</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Últimos Tickets de Hotelaria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Últimos 10 Tickets de Hotelaria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left p-2">Ticket</th>
                      <th className="text-left p-2">Categoria</th>
                      <th className="text-left p-2">Cat. ID</th>
                      <th className="text-left p-2">Cat. Tipo</th>
                      <th className="text-left p-2">SLA ID</th>
                      <th className="text-left p-2">Prazo Solução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tickets_hotelaria.map((t) => (
                      <tr key={t.id} className={`border-b dark:border-gray-700 ${!t.sla_id ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                        <td className="p-2 font-mono">{t.numero}</td>
                        <td className="p-2">{t.categoria_nome || 'N/A'}</td>
                        <td className="p-2">{t.categoria_id || 'NULL'}</td>
                        <td className="p-2">
                          {t.categoria_tipo === 'categoria' ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : (
                            <span className="text-yellow-600 dark:text-yellow-400">{t.categoria_tipo || 'NULL'}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {t.sla_id ? (
                            <span className="text-green-600 dark:text-green-400">{t.sla_id}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-bold">⚠️ SEM SLA</span>
                          )}
                        </td>
                        <td className="p-2">
                          {t.prazo_solucao ? (
                            new Date(t.prazo_solucao).toLocaleString('pt-BR')
                          ) : (
                            <span className="text-red-600 dark:text-red-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* SLAs de Hotelaria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SLAs Disponíveis para Hotelaria (setor_id=9)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Prioridade</th>
                      <th className="text-left p-2">Categoria ID</th>
                      <th className="text-left p-2">Resp. (min)</th>
                      <th className="text-left p-2">Sol. (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slas_hotelaria.slice(0, 20).map((s) => (
                      <tr key={s.id} className="border-b dark:border-gray-700">
                        <td className="p-2">{s.id}</td>
                        <td className="p-2">{s.tipo_chamado}</td>
                        <td className="p-2">{s.prioridade}</td>
                        <td className="p-2">{s.categoria_id || 'Genérico'}</td>
                        <td className="p-2">{s.tempo_resposta_minutos}</td>
                        <td className="p-2">{s.tempo_solucao_minutos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.slas_hotelaria.length > 20 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mostrando 20 de {data.slas_hotelaria.length} SLAs
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
