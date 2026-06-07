"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, Bug, Database } from 'lucide-react';

interface TicketDebug {
  id: number;
  numero: string;
  setor_destino_id: number;
  data_abertura: string;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  sla_id: number | null;
  status: string;
  tipo_prazo_resposta: string;
}

interface DebugData {
  exemplos_geral: TicketDebug[];
  exemplos_ti: TicketDebug[];
  total_exemplos_geral: number;
  total_exemplos_ti: number;
}

export default function DebugSLA() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarDebug = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/diagnostico-sla-nulo/debug-tickets');
      if (!response.ok) throw new Error('Erro ao carregar debug');
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Erro ao carregar debug:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDebug();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Carregando dados de debug...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Bug className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Debug de Tickets sem SLA
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Visualize exemplos de tickets que estão com prazo_resposta NULL no banco de dados
                </p>
              </div>
            </div>
            <button
              onClick={carregarDebug}
              disabled={loading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {debugData && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Tickets Gerais (NULL)
                  </span>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {debugData.total_exemplos_geral}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Primeiros 10 tickets com prazo_resposta NULL
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Tickets TI (NULL)
                  </span>
                </div>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {debugData.total_exemplos_ti}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Primeiros 10 tickets TI com prazo_resposta NULL
                </p>
              </div>
            </div>

            {/* Tickets Gerais */}
            {debugData.exemplos_geral.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Exemplos de Tickets com prazo_resposta NULL (Geral)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Número</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Setor ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SLA ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prazo Resposta</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prazo Solução</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo Dado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {debugData.exemplos_geral.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{ticket.numero}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.setor_destino_id}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {ticket.sla_id || <span className="text-red-600 dark:text-red-400">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="text-red-600 dark:text-red-400 font-mono text-xs">
                              {ticket.prazo_resposta || 'NULL'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {ticket.prazo_solucao ? ticket.prazo_solucao.substring(0, 19) : <span className="text-red-600 dark:text-red-400">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                            {ticket.tipo_prazo_resposta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tickets TI */}
            {debugData.exemplos_ti.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Exemplos de Tickets TI com prazo_resposta NULL
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Número</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data Abertura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SLA ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prazo Resposta</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prazo Solução</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo Dado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {debugData.exemplos_ti.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{ticket.numero}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {ticket.data_abertura ? ticket.data_abertura.substring(0, 19) : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {ticket.sla_id || <span className="text-red-600 dark:text-red-400">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="text-red-600 dark:text-red-400 font-mono text-xs font-bold">
                              {ticket.prazo_resposta || 'NULL'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {ticket.prazo_solucao ? ticket.prazo_solucao.substring(0, 19) : <span className="text-red-600 dark:text-red-400">NULL</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                            {ticket.tipo_prazo_resposta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mensagem se não houver exemplos */}
            {debugData.exemplos_geral.length === 0 && debugData.exemplos_ti.length === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
                <div className="text-green-600 dark:text-green-400 text-lg font-medium mb-2">
                  ✓ Nenhum ticket com prazo_resposta NULL encontrado!
                </div>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Todos os tickets estão com prazos de resposta definidos corretamente.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
