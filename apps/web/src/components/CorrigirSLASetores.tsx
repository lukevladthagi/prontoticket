"use client";

import { useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Ticket {
  id: number;
  numero: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  setor_destino_id: number;
  setor_nome: string;
  sla_id: number | null;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  data_abertura: string;
  categoria_id: number | null;
  categoria_nome: string | null;
}

interface DiagnosticoResponse {
  total: number;
  tickets: Ticket[];
}

interface CorrecaoResponse {
  processados: number;
  corrigidos: number;
  erros: Array<{ ticket: string; erro: string }>;
}

export function CorrigirSLASetores() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [resultado, setResultado] = useState<CorrecaoResponse | null>(null);

  const carregarDiagnostico = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const response = await fetch("/api/corrigir-sla-setores/diagnostico", {
        credentials: 'include'
      });
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

  const corrigirSLAs = async () => {
    if (!confirm(`Confirma a correção de ${diagnostico?.total || 0} tickets?`)) {
      return;
    }

    setCorrigindo(true);
    setResultado(null);
    try {
      const response = await fetch("/api/corrigir-sla-setores/corrigir", {
        method: "POST",
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Erro ao corrigir SLAs");
      const data = await response.json();
      setResultado(data);
      
      // Recarregar diagnóstico após correção
      await carregarDiagnostico();
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao corrigir SLAs");
    } finally {
      setCorrigindo(false);
    }
  };

  const getSetorColor = (setorId: number) => {
    switch (setorId) {
      case 7: return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case 9: return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case 13: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Correção de SLAs - Hotelaria, Manutenção e Rouparia
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Esta ferramenta recalcula os SLAs de tickets desses setores que estão sem prazo definido.
            </p>
          </div>
          <button
            onClick={carregarDiagnostico}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Carregar Diagnóstico
          </button>
        </div>

        {diagnostico && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                    {diagnostico.total} tickets sem SLA encontrados
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Tickets abertos de Hotelaria, Manutenção e Rouparia sem prazo de resposta ou resolução
                  </p>
                </div>
              </div>
              {diagnostico.total > 0 && (
                <button
                  onClick={corrigirSLAs}
                  disabled={corrigindo}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {corrigindo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Corrigindo...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Corrigir Todos
                    </>
                  )}
                </button>
              )}
            </div>

            {resultado && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Resultado da Correção</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 dark:text-blue-300">Processados:</span>
                    <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">{resultado.processados}</span>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-300">Corrigidos:</span>
                    <span className="ml-2 font-semibold text-green-900 dark:text-green-100">{resultado.corrigidos}</span>
                  </div>
                  <div>
                    <span className="text-red-700 dark:text-red-300">Erros:</span>
                    <span className="ml-2 font-semibold text-red-900 dark:text-red-100">{resultado.erros.length}</span>
                  </div>
                </div>
                {resultado.erros.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold text-red-900 dark:text-red-100 text-sm">Erros:</p>
                    {resultado.erros.map((erro, idx) => (
                      <div key={idx} className="text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                        <span className="font-semibold">{erro.ticket}:</span> {erro.erro}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {diagnostico.tickets.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ticket
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Título
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Setor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Prioridade
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status SLA
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {diagnostico.tickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {ticket.numero}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                            {ticket.titulo}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSetorColor(ticket.setor_destino_id)}`}>
                              {ticket.setor_nome}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {ticket.tipo}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              ticket.prioridade === 'P1' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              ticket.prioridade === 'P2' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              ticket.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {ticket.prioridade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {ticket.categoria_nome || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              {!ticket.sla_id && (
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <XCircle className="w-4 h-4" />
                                  Sem SLA
                                </span>
                              )}
                              {ticket.sla_id && !ticket.prazo_solucao && (
                                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                  <AlertCircle className="w-4 h-4" />
                                  Sem prazo
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
