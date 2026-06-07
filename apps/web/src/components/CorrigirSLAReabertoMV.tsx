"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface TicketMV {
  id: number;
  numero: string;
  tipo: string;
  prioridade: string;
  status: string;
  categoria_id: number;
  sla_id: number | null;
  tempo_solucao_minutos: number | null;
  sla_nome: string | null;
}

interface DiagnosticoData {
  total_tickets_mv: number;
  tickets_detalhados: TicketMV[];
  mensagem: string;
}

interface CorrecaoData {
  total_processados: number;
  corrigidos: number;
  erros?: string[];
  mensagem: string;
}

export function CorrigirSLAReabertoMV() {
  const [loading, setLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [correcao, setCorrecao] = useState<CorrecaoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slasMV, setSlasMV] = useState<any[]>([]);
  const [ticketNumero, setTicketNumero] = useState('');

  const carregarSLAsMV = async () => {
    try {
      const response = await fetch('/api/fix-sla-reaberto-mv/listar-slas-mv', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSlasMV(data.slas || []);
      }
    } catch (err) {
      console.error('Erro ao carregar SLAs:', err);
    }
  };

  const atualizarSLAsMV = async () => {
    if (!confirm('Deseja atualizar TODOS os SLAs cadastrados da categoria Sistema MV para 72 horas?\n\nIsso irá modificar os SLAs no banco de dados. Novos tickets já vão usar o prazo correto automaticamente.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[FRONTEND] Atualizando SLAs cadastrados...');
      const response = await fetch('/api/fix-sla-reaberto-mv/atualizar-slas-mv', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar SLAs');
      }
      
      const data = await response.json();
      console.log('[FRONTEND] SLAs atualizados:', data);
      
      alert(`✅ SLAs atualizados com sucesso!\n\nTotal: ${data.total_atualizados} SLAs\nNovo prazo: 60 min resposta + 72h resolução`);
      
      // Recarregar lista de SLAs
      await carregarSLAsMV();
    } catch (err: any) {
      console.error('[FRONTEND] Erro ao atualizar SLAs:', err);
      setError(err.message);
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const carregarDiagnostico = async () => {
    setLoading(true);
    setError(null);
    setCorrecao(null);

    try {
      const response = await fetch('/api/fix-sla-reaberto-mv/diagnostico');
      if (!response.ok) {
        throw new Error('Erro ao carregar diagnóstico');
      }
      const data = await response.json();
      setDiagnostico(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const corrigirTicketEspecifico = async (numero: string) => {
    if (!numero.trim()) {
      alert('Digite o número do ticket');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[CORRIGIR TICKET] Corrigindo ticket:', numero);
      const response = await fetch(`/api/fix-sla-reaberto-mv/corrigir-ticket/${numero}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao corrigir ticket');
      }
      
      const data = await response.json();
      console.log('[CORRIGIR TICKET] Resultado:', data);
      
      alert(`✅ Ticket ${numero} corrigido!\n\n` +
        `SLA ANTES: ${data.correcao.sla_antes.nome || 'N/A'}\n` +
        `SLA DEPOIS: ${data.correcao.sla_depois.nome}\n\n` +
        `Tempo Resposta: ${data.correcao.sla_depois.tempo_resposta} min\n` +
        `Tempo Resolução: ${data.correcao.sla_depois.tempo_solucao} min (${(data.correcao.sla_depois.tempo_solucao / 60).toFixed(0)}h)`
      );
      
      setTicketNumero('');
      await carregarDiagnostico();
    } catch (err: any) {
      console.error('[CORRIGIR TICKET] Erro:', err);
      setError(err.message);
      alert(`Erro ao corrigir ticket: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testarUpdateTicket = async (numero: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[TESTE] Testando UPDATE no ticket:', numero);
      const response = await fetch(`/api/fix-sla-reaberto-mv/teste-update/${numero}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao testar update');
      }
      
      const data = await response.json();
      console.log('[TESTE] Resultado completo:', data);
      
      alert(`TESTE DE UPDATE - Ticket ${numero}\n\n` +
        `✅ Sucesso: ${data.sucesso}\n` +
        `📝 Changes: ${data.changes}\n\n` +
        `ANTES:\n` +
        `  SLA: ${data.ticket_antes.sla_nome || 'N/A'}\n` +
        `  Prazo Solução: ${data.ticket_antes.prazo_solucao || 'N/A'}\n\n` +
        `DEPOIS:\n` +
        `  SLA: ${data.ticket_depois.sla_nome || 'N/A'}\n` +
        `  Prazo Solução: ${data.ticket_depois.prazo_solucao || 'N/A'}\n\n` +
        `Mudou? ${data.ticket_antes.sla_id !== data.ticket_depois.sla_id ? 'SIM ✅' : 'NÃO ❌'}`
      );
      
      // Recarregar diagnóstico
      await carregarDiagnostico();
    } catch (err: any) {
      console.error('[TESTE] Erro:', err);
      setError(err.message);
      alert(`Erro no teste: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const corrigirTicketsMV = async () => {
    if (!confirm('Deseja recalcular o SLA de todos os tickets Sistema MV para 72 horas?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[FRONTEND] Iniciando correção de tickets MV...');
      const response = await fetch('/api/fix-sla-reaberto-mv/corrigir-mv', {
        method: 'POST',
      });
      console.log('[FRONTEND] Resposta recebida:', response.status, response.ok);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[FRONTEND] Erro na resposta:', errorData);
        throw new Error(errorData.error || 'Erro ao corrigir tickets');
      }
      const data = await response.json();
      console.log('[FRONTEND] Dados da correção:', data);
      setCorrecao(data);
      
      // Mostrar alerta com resultado
      alert(`Correção concluída!\nProcessados: ${data.total_processados}\nCorrigidos: ${data.corrigidos}`);
      
      // Recarregar diagnóstico após correção
      await carregarDiagnostico();
    } catch (err: any) {
      console.error('[FRONTEND] Erro ao corrigir:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    carregarDiagnostico();
    carregarSLAsMV();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Correção SLA - Tickets Reabertos e Sistema MV
          </CardTitle>
          <CardDescription>
            Diagnóstico e correção de SLAs para tickets reabertos e Sistema MV (72 horas)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SLAs disponíveis para categoria MV */}
          {slasMV.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  SLAs cadastrados para Sistema MV (categoria_id=217):
                </h3>
                <Button
                  onClick={atualizarSLAsMV}
                  disabled={loading}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  🔧 Atualizar Todos para 72h
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 dark:border-blue-800">
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Prioridade</th>
                      <th className="text-left p-2">Tempo Resposta</th>
                      <th className="text-left p-2">Tempo Resolução</th>
                      <th className="text-left p-2">Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slasMV.map((sla) => (
                      <tr key={sla.id} className="border-b border-blue-100 dark:border-blue-900">
                        <td className="p-2">{sla.id}</td>
                        <td className="p-2">{sla.nome}</td>
                        <td className="p-2">{sla.tipo_chamado}</td>
                        <td className="p-2">{sla.prioridade}</td>
                        <td className="p-2">{sla.tempo_resposta_minutos}min</td>
                        <td className="p-2 font-bold">
                          {sla.tempo_solucao_minutos}min ({(sla.tempo_solucao_minutos / 60).toFixed(0)}h)
                        </td>
                        <td className="p-2">{sla.ativo ? '✓' : '✗'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Informações sobre a correção */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              O que esta ferramenta faz:
            </h3>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>• <strong>🔧 Atualizar SLAs Cadastrados:</strong> Modifica TODOS os SLAs da categoria Sistema MV no banco de dados para 72 horas (afeta novos tickets)</li>
              <li>• <strong>✅ Corrigir Tickets Existentes:</strong> Recalcula os prazos dos tickets MV já criados que estão com SLA incorreto</li>
              <li>• <strong>🎯 Corrigir Ticket Específico:</strong> Recalcula o SLA correto para qualquer ticket baseado na categoria dele</li>
              <li>• Chamados reabertos recalculam o SLA do zero automaticamente (já implementado)</li>
            </ul>
          </div>

          {/* Corrigir ticket específico */}
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">
              🎯 Corrigir Ticket Específico
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
              Digite o número do ticket para recalcular seu SLA baseado na categoria. 
              Funciona para qualquer ticket de qualquer setor.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={ticketNumero}
                onChange={(e) => setTicketNumero(e.target.value)}
                placeholder="Ex: TKT-003484"
                className="flex-1 px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-md bg-white dark:bg-gray-800"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    corrigirTicketEspecifico(ticketNumero);
                  }
                }}
              />
              <Button
                onClick={() => corrigirTicketEspecifico(ticketNumero)}
                disabled={loading || !ticketNumero.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Corrigir SLA
              </Button>
            </div>
          </div>

          {/* Botão de atualizar */}
          <div className="flex gap-2">
            <Button
              onClick={carregarDiagnostico}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Diagnóstico
            </Button>
            
            <Button
              onClick={() => testarUpdateTicket('TKT-082005')}
              disabled={loading}
              variant="secondary"
            >
              🧪 Testar UPDATE (TKT-082005)
            </Button>

            {diagnostico && diagnostico.total_tickets_mv > 0 && (
              <Button
                onClick={corrigirTicketsMV}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Corrigir Tickets MV ({diagnostico.total_tickets_mv})
              </Button>
            )}
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-900 dark:text-red-100">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Erro:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Resultado da Correção */}
          {correcao && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-900 dark:text-green-100 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">{correcao.mensagem}</span>
              </div>
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <p>Total processados: {correcao.total_processados}</p>
                <p>Corrigidos: {correcao.corrigidos}</p>
                {correcao.erros && correcao.erros.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">Erros:</p>
                    <ul className="list-disc list-inside">
                      {correcao.erros.map((erro, idx) => (
                        <li key={idx}>{erro}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Diagnóstico */}
          {diagnostico && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tickets Sistema MV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {diagnostico.total_tickets_mv}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tickets que precisam de SLA de 72h
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-lg font-semibold ${
                      diagnostico.total_tickets_mv === 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      {diagnostico.total_tickets_mv === 0 ? '✓ Tudo certo' : '⚠ Requer correção'}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {diagnostico.mensagem}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Tickets */}
              {diagnostico.tickets_detalhados.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-semibold">Número</th>
                          <th className="text-left p-3 font-semibold">Tipo</th>
                          <th className="text-left p-3 font-semibold">Prioridade</th>
                          <th className="text-left p-3 font-semibold">Status</th>
                          <th className="text-left p-3 font-semibold">SLA Atual</th>
                          <th className="text-left p-3 font-semibold">Tempo Resolução</th>
                          <th className="text-left p-3 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagnostico.tickets_detalhados.map((ticket) => (
                          <tr key={ticket.id} className="border-t hover:bg-muted/50">
                            <td className="p-3 font-mono">{ticket.numero}</td>
                            <td className="p-3">{ticket.tipo}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                ticket.prioridade === 'P1' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                                ticket.prioridade === 'P2' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
                                ticket.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                              }`}>
                                {ticket.prioridade}
                              </span>
                            </td>
                            <td className="p-3">{ticket.status}</td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {ticket.sla_nome || 'Sem SLA'}
                            </td>
                            <td className="p-3">
                              {ticket.tempo_solucao_minutos 
                                ? `${(ticket.tempo_solucao_minutos / 60).toFixed(0)}h`
                                : 'N/A'
                              }
                              {ticket.tempo_solucao_minutos !== 4320 && (
                                <span className="ml-2 text-orange-600 dark:text-orange-400 font-semibold">
                                  ≠ 72h
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <Button
                                onClick={() => testarUpdateTicket(ticket.numero)}
                                disabled={loading}
                                size="sm"
                                variant="outline"
                                className="text-xs"
                              >
                                Corrigir
                              </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
