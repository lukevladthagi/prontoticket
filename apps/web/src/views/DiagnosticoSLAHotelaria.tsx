"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, XCircle, Search } from "lucide-react";
import Layout from "@/components/Layout";

interface SLA {
  id: number;
  categoria_id: number | null;
  tipo_chamado: string;
  prioridade: string;
  tempo_resposta_minutos: number;
  tempo_solucao_minutos: number;
  ativo: boolean;
}

interface Ticket {
  id: number;
  numero: string;
  tipo: string;
  prioridade: string;
  setor_destino_id: number;
  categoria_id: number | null;
  sla_id: number | null;
  status: string;
}

interface AnaliseTicket {
  ticket: Ticket;
  sla_encontrado: SLA | null;
  metodo_busca: string;
  motivo_sem_sla: string;
}

interface DiagnosticoData {
  resumo: {
    total: number;
    com_sla: number;
    sem_sla: number;
  };
  slas_configurados: {
    total: number;
    detalhes: SLA[];
  };
  tickets_sem_sla: {
    total: number;
    analise: AnaliseTicket[];
  };
}

export default function DiagnosticoSLAHotelaria() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executarDiagnostico = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/diagnostico-sla-hotelaria");
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDiagnostico(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Diagnóstico SLA - Hotelaria</h1>
          <p className="text-muted-foreground">
            Análise detalhada dos SLAs aplicados aos tickets da Hotelaria
          </p>
        </div>

        <div className="mb-6">
          <button 
            onClick={executarDiagnostico} 
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Analisando..." : "Executar Diagnóstico"}
          </button>
        </div>

      {error && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {diagnostico && (
        <div className="space-y-6">
          {/* Resumo Geral */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{diagnostico.resumo.total}</div>
                  <div className="text-sm text-muted-foreground">Total de Tickets</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{diagnostico.resumo.com_sla}</div>
                  <div className="text-sm text-muted-foreground">Com SLA</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{diagnostico.resumo.sem_sla}</div>
                  <div className="text-sm text-muted-foreground">Sem SLA</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLAs Configurados */}
          <Card>
            <CardHeader>
              <CardTitle>SLAs Configurados ({diagnostico.slas_configurados.total})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Prioridade</th>
                      <th className="text-left p-2">Tempo Resposta</th>
                      <th className="text-left p-2">Tempo Solução</th>
                      <th className="text-left p-2">Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostico.slas_configurados.detalhes.map((sla) => (
                      <tr key={sla.id} className="border-b">
                        <td className="p-2">{sla.id}</td>
                        <td className="p-2">{sla.tipo_chamado}</td>
                        <td className="p-2">{sla.prioridade}</td>
                        <td className="p-2">{sla.tempo_resposta_minutos} min</td>
                        <td className="p-2">{sla.tempo_solucao_minutos} min</td>
                        <td className="p-2">
                          {sla.ativo ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Análise de Tickets Sem SLA */}
          {diagnostico.tickets_sem_sla.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Tickets Sem SLA ({diagnostico.tickets_sem_sla.total})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {diagnostico.tickets_sem_sla.analise.map((analise) => (
                    <div key={analise.ticket.id} className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{analise.ticket.numero}</h4>
                          <p className="text-sm text-muted-foreground">
                            Tipo: {analise.ticket.tipo} | Prioridade: {analise.ticket.prioridade} | Status: {analise.ticket.status}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs px-2 py-1 bg-muted rounded">
                            Categoria ID: {analise.ticket.categoria_id || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {analise.sla_encontrado ? (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800 dark:text-green-300">
                              SLA Encontrado (método: {analise.metodo_busca})
                            </span>
                          </div>
                          <div className="text-sm text-green-700 dark:text-green-400">
                            SLA ID: {analise.sla_encontrado.id} | 
                            Resposta: {analise.sla_encontrado.tempo_resposta_minutos} min | 
                            Solução: {analise.sla_encontrado.tempo_solucao_minutos} min
                          </div>
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                            ⚠️ {analise.motivo_sem_sla}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-800 dark:text-red-300">
                              Nenhum SLA Encontrado
                            </span>
                          </div>
                          <div className="text-sm text-red-700 dark:text-red-400">
                            {analise.motivo_sem_sla}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </div>
    </Layout>
  );
}
