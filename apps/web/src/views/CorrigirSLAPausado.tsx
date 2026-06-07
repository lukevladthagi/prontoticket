"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface TicketPausado {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  sla_pausado_em: string | null;
  sla_pausado_motivo: string | null;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  data_abertura: string;
  setor_nome: string;
}

export default function CorrigirSLAPausado() {
  const [tickets, setTickets] = useState<TicketPausado[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [corrigindo, setCorrigindo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const carregarTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/corrigir-sla-pausado/diagnostico', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar tickets' });
    } finally {
      setLoading(false);
    }
  };

  const corrigirTodos = async () => {
    if (!confirm(`Tem certeza que deseja corrigir ${total} tickets?`)) {
      return;
    }

    setCorrigindo(true);
    setMessage(null);

    try {
      const response = await fetch('/api/corrigir-sla-pausado/corrigir-todos', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || `${data.corrigidos} tickets corrigidos com sucesso`
        });
        await carregarTickets(); // Recarregar a lista
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao corrigir tickets' });
      }
    } catch (error) {
      console.error('Erro ao corrigir tickets:', error);
      setMessage({ type: 'error', text: 'Erro ao processar requisição' });
    } finally {
      setCorrigindo(false);
    }
  };

  const corrigirIndividual = async (id: number, numero: string) => {
    if (!confirm(`Corrigir ticket ${numero}?`)) {
      return;
    }

    setCorrigindo(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/corrigir-sla-pausado/corrigir/${id}`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `Ticket ${numero} corrigido com sucesso`
        });
        await carregarTickets();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao corrigir ticket' });
      }
    } catch (error) {
      console.error('Erro ao corrigir ticket:', error);
      setMessage({ type: 'error', text: 'Erro ao processar requisição' });
    } finally {
      setCorrigindo(false);
    }
  };

  useEffect(() => {
    carregarTickets();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-yellow-500" size={28} />
                Corrigir SLA Pausado
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Tickets pausados sem campo sla_pausado_em preenchido
              </p>
            </div>
            <button
              onClick={carregarTickets}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                {message.text}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                      Total de tickets com problema: {total}
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                      Estes tickets estão em status pausado mas o campo sla_pausado_em não foi preenchido, 
                      fazendo com que o SLA continue contando. Clique em "Corrigir Todos" para preencher 
                      automaticamente com a data/hora atual.
                    </p>
                    {total > 0 && (
                      <button
                        onClick={corrigirTodos}
                        disabled={corrigindo}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium"
                      >
                        {corrigindo ? 'Corrigindo...' : `Corrigir Todos (${total})`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
                  <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                    Nenhum ticket precisa de correção
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Todos os tickets pausados estão com SLA configurado corretamente
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ticket
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Título
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Setor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Abertura
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                              {ticket.numero}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                              {ticket.titulo}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {ticket.setor_nome || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(ticket.data_abertura).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => corrigirIndividual(ticket.id, ticket.numero)}
                              disabled={corrigindo}
                              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Corrigir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
