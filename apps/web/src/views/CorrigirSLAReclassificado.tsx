"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Ticket {
  id: number;
  numero: string;
  tipo: string;
  prioridade: string;
  categoria_id: string;
  subcategoria_id: string | null;
  item_id: string | null;
  sla_id: number;
  data_abertura: string;
  sla_atual_nome: string;
  sla_categoria_id: string | null;
  sla_tempo_resposta: number;
  sla_tempo_solucao: number;
  categoria_nome: string | null;
}

interface DiagnosticoData {
  total_tickets_com_problema: number;
  tickets: Ticket[];
}

interface ResultadoCorrecao {
  sucesso: boolean;
  total_processados: number;
  tickets_corrigidos: number;
  tickets_com_erro: number;
  detalhes: any[];
}

export default function CorrigirSLAReclassificado() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [resultado, setResultado] = useState<ResultadoCorrecao | null>(null);
  const [loading, setLoading] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);

  const carregarDiagnostico = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const response = await fetch("/api/corrigir-sla-reclassificado");
      if (!response.ok) throw new Error("Erro ao carregar diagnóstico");
      const data = await response.json();
      setDiagnostico(data);
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao carregar diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDiagnostico();
  }, []);

  const corrigirTodos = async () => {
    if (!diagnostico || diagnostico.total_tickets_com_problema === 0) return;
    
    if (!confirm(`Corrigir SLA de ${diagnostico.total_tickets_com_problema} tickets reclassificados?`)) {
      return;
    }

    setCorrigindo(true);
    console.log('[FRONTEND] Iniciando correção de SLAs reclassificados...');
    
    try {
      const response = await fetch("/api/corrigir-sla-reclassificado/corrigir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FRONTEND] Erro na resposta:', response.status, errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[FRONTEND] Resultado da correção:', data);
      setResultado(data);
      
      // Recarregar diagnóstico
      await carregarDiagnostico();
    } catch (error: any) {
      console.error("[FRONTEND] Erro ao corrigir:", error);
      alert(`Erro ao corrigir SLAs: ${error.message}`);
    } finally {
      setCorrigindo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Corrigir SLA de Tickets Reclassificados
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Identifica e corrige tickets que foram reclassificados mas ainda usam SLA genérico
          </p>
        </div>
        <Button
          onClick={carregarDiagnostico}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Diagnóstico */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Carregando diagnóstico...
          </p>
        </div>
      ) : diagnostico ? (
        <>
          {/* Resumo */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-700 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  Tickets com SLA Genérico
                </h3>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {diagnostico.total_tickets_com_problema}
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  Tickets reclassificados usando SLA genérico ao invés do SLA específico da categoria
                </p>
              </div>
            </div>
          </div>

          {/* Botão de Correção */}
          {diagnostico.total_tickets_com_problema > 0 && (
            <div className="flex justify-center">
              <Button
                onClick={corrigirTodos}
                disabled={corrigindo}
                size="lg"
                className="min-w-[300px]"
              >
                {corrigindo ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Corrigindo...
                  </>
                ) : (
                  <>
                    <Wrench className="w-5 h-5 mr-2" />
                    Corrigir Todos ({diagnostico.total_tickets_com_problema})
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Resultado da Correção */}
          {resultado && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                    Correção Concluída
                  </h3>
                  <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                    <p>✓ {resultado.tickets_corrigidos} tickets atualizados com SLA específico</p>
                    {resultado.tickets_com_erro > 0 && (
                      <p className="text-orange-700 dark:text-orange-300">
                        ⚠ {resultado.tickets_com_erro} tickets não puderam ser corrigidos
                      </p>
                    )}
                  </div>
                  
                  {/* Detalhes dos tickets corrigidos */}
                  {resultado.detalhes && resultado.detalhes.filter((d: any) => d.status === 'corrigido').length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-green-900 dark:text-green-200 hover:underline">
                        Ver tickets corrigidos ({resultado.detalhes.filter((d: any) => d.status === 'corrigido').length})
                      </summary>
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {resultado.detalhes
                          .filter((d: any) => d.status === 'corrigido')
                          .map((detalhe: any) => (
                            <div key={detalhe.ticket_id} className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                              <div className="font-medium text-green-900 dark:text-green-200">
                                {detalhe.numero}
                              </div>
                              <div className="text-green-700 dark:text-green-300 mt-1">
                                {detalhe.sla_antigo} → {detalhe.sla_novo} ({detalhe.tempo_solucao} min)
                              </div>
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lista de Tickets */}
          {diagnostico.tickets && diagnostico.tickets.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Tickets Afetados
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Número
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Prioridade
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        SLA Atual
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Tempo Solução
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {diagnostico.tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {ticket.numero}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.tipo}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ticket.prioridade === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            ticket.prioridade === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            ticket.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {ticket.prioridade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.categoria_nome || `ID: ${ticket.categoria_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.sla_atual_nome}
                          <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">(genérico)</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.sla_tempo_solucao} min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
