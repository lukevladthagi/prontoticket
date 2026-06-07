"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TicketAfetado {
  id: number;
  numero: string;
  titulo: string;
  setor_nome: string;
  categoria_id: number;
  categoria_nome: string;
  data_abertura: string;
}

interface DiagnosticoResponse {
  total: number;
  tickets: TicketAfetado[];
}

export default function CorrigirManutencaoTI() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    carregarDiagnostico();
  }, []);

  const carregarDiagnostico = async () => {
    setLoading(true);
    setMensagem(null);
    try {
      const response = await fetch('/api/fix-manutencao-ti/diagnostico');
      if (!response.ok) throw new Error('Erro ao carregar diagnóstico');
      const data = await response.json();
      setDiagnostico(data);
    } catch (error) {
      setMensagem({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'Erro ao carregar diagnóstico'
      });
    } finally {
      setLoading(false);
    }
  };

  const corrigirTickets = async () => {
    if (!confirm('Confirma a correção dos tickets afetados? Esta ação irá remover a categoria TI incorreta e recalcular os SLAs do setor Manutenção.')) {
      return;
    }

    setCorrigindo(true);
    setMensagem(null);
    try {
      const response = await fetch('/api/fix-manutencao-ti/corrigir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Erro ao corrigir tickets');
      
      const data = await response.json();
      setMensagem({
        tipo: 'success',
        texto: `${data.corrigidos} tickets corrigidos com sucesso!`
      });
      
      // Recarregar diagnóstico
      await carregarDiagnostico();
    } catch (error) {
      setMensagem({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'Erro ao corrigir tickets'
      });
    } finally {
      setCorrigindo(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Corrigir Tipo "Manutenção" do TI
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Identifica e corrige tickets do setor Manutenção que receberam incorretamente a categoria TI "Manutenção"
        </p>
      </div>

      {mensagem && (
        <div className={`p-4 rounded-lg ${
          mensagem.tipo === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {mensagem.tipo === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{mensagem.texto}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : diagnostico ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Diagnóstico
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Tickets do setor Manutenção com categoria TI incorreta (id 990)
                </p>
              </div>
              {diagnostico.total > 0 && (
                <Button
                  onClick={corrigirTickets}
                  disabled={corrigindo}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {corrigindo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Corrigindo...
                    </>
                  ) : (
                    <>Corrigir {diagnostico.total} Ticket{diagnostico.total !== 1 ? 's' : ''}</>
                  )}
                </Button>
              )}
            </div>

            {diagnostico.total === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum ticket afetado encontrado
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                        Número
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                        Título
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                        Setor
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                        Categoria Incorreta
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                        Data Abertura
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostico.tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                          {ticket.numero}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.titulo}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.setor_nome}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {ticket.categoria_nome} (ID: {ticket.categoria_id})
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(ticket.data_abertura).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              O que esta correção faz:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Remove a categoria TI "Manutenção" (id 990) dos tickets afetados</li>
              <li>Define tipo_problema como NULL para estes tickets</li>
              <li>Remove categoria_id, subcategoria_id e item_id incorretos</li>
              <li>Recalcula o SLA usando os SLAs genéricos do setor Manutenção</li>
              <li>Registra a correção no histórico do ticket</li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
