"use client";

import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { RefreshCw, Trash2, CheckCircle } from 'lucide-react';

interface Ticket {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  setor_destino_id: number;
  setor_nome: string;
  prazo_resposta: string;
  prazo_solucao: string;
  data_abertura: string;
  tipo_problema: string;
}

interface ResumoSetor {
  setor_destino_id: number;
  setor_nome: string;
  total: number;
}

export default function LimparPrazoResposta() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [resumoPorSetor, setResumoPorSetor] = useState<ResumoSetor[]>([]);
  const [loading, setLoading] = useState(true);
  const [setorFiltro, setSetorFiltro] = useState<number | null>(null);
  const [processando, setProcessando] = useState(false);
  const [ticketProcessando, setTicketProcessando] = useState<number | null>(null);

  useEffect(() => {
    carregarTickets();
  }, []);

  const carregarTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/limpar-prazo-resposta');
      const data = await response.json();
      
      setTickets(data.tickets || []);
      setResumoPorSetor(data.resumo_por_setor || []);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      alert('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  };

  const limparTicket = async (ticketId: number, ticketNumero: string) => {
    if (!confirm(`Deseja remover o prazo de atendimento do ticket ${ticketNumero}?`)) {
      return;
    }

    try {
      setTicketProcessando(ticketId);
      const response = await fetch(`/api/limpar-prazo-resposta/limpar/${ticketId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao limpar ticket');
      }

      const result = await response.json();
      alert(result.mensagem);
      
      // Recarregar lista
      await carregarTickets();
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setTicketProcessando(null);
    }
  };

  const limparSetor = async (setorId: number, setorNome: string, total: number) => {
    if (!confirm(`Deseja remover o prazo de atendimento de TODOS os ${total} tickets do setor "${setorNome}"?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setProcessando(true);
      const response = await fetch('/api/limpar-prazo-resposta/limpar-setor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setor_id: setorId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao limpar setor');
      }

      const result = await response.json();
      alert(`✅ ${result.mensagem}`);
      
      // Recarregar lista
      await carregarTickets();
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const limparTodos = async () => {
    const total = tickets.length;
    if (!confirm(`⚠️ ATENÇÃO!\n\nDeseja remover o prazo de atendimento de TODOS os ${total} tickets não-TI?\n\nEsta ação vai afetar todos os setores exceto TI.\n\nContinuar?`)) {
      return;
    }

    try {
      setProcessando(true);
      const response = await fetch('/api/limpar-prazo-resposta/limpar-todos', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao limpar todos');
      }

      const result = await response.json();
      alert(`✅ ${result.mensagem}`);
      
      // Recarregar lista
      await carregarTickets();
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const ticketsFiltrados = setorFiltro
    ? tickets.filter(t => t.setor_destino_id === setorFiltro)
    : tickets;

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">Carregando tickets...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Limpar Prazo de Atendimento
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Tickets não-TI com prazo de atendimento incorretamente preenchido
                </p>
              </div>
              <button
                onClick={carregarTickets}
                disabled={loading}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Atualizar"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Resumo por Setor */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {resumoPorSetor.map((setor) => (
                <div
                  key={setor.setor_destino_id}
                  className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {setor.setor_nome}
                    </span>
                    <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {setor.total}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSetorFiltro(setor.setor_destino_id)}
                      className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Filtrar
                    </button>
                    <button
                      onClick={() => limparSetor(setor.setor_destino_id, setor.setor_nome, setor.total)}
                      disabled={processando}
                      className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Limpar Todos
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações Globais */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {setorFiltro && (
                <button
                  onClick={() => setSetorFiltro(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Limpar Filtro
                </button>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {ticketsFiltrados.length} de {tickets.length} tickets
              </p>
            </div>

            {tickets.length > 0 && (
              <button
                onClick={limparTodos}
                disabled={processando}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {processando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Limpar Todos os Não-TI ({tickets.length})
                  </>
                )}
              </button>
            )}
          </div>

          {/* Lista de Tickets */}
          {ticketsFiltrados.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum ticket encontrado!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {setorFiltro 
                  ? 'Não há tickets com prazo de atendimento para este setor.'
                  : 'Todos os tickets não-TI estão corretos (sem prazo de atendimento).'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Número
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Setor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipo Problema
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Prazo Resposta
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {ticketsFiltrados.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.numero}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {ticket.titulo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {ticket.setor_nome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {ticket.tipo_problema || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400">
                          {ticket.prazo_resposta ? new Date(ticket.prazo_resposta).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => limparTicket(ticket.id, ticket.numero)}
                            disabled={ticketProcessando === ticket.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {ticketProcessando === ticket.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Limpando...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Limpar
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
