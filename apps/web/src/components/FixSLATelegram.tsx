"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, Loader2, CheckCircle2, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TicketErrado {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  setor_nome: string;
  setor_destino_id: number;
  sla_nome: string;
  sla_setor_nome: string;
  origem: string;
  created_at: string;
  prioridade: string;
}

interface ResumoPorSLA {
  sla_id: number;
  sla_nome: string;
  sla_setor_id: number;
  sla_setor_nome: string;
  total: number;
}

interface SLADisponivel {
  id: number;
  nome: string;
  setor_id: number;
  setor_nome: string;
  prioridade: string;
}

interface DiagnosticoData {
  total: number;
  tickets: TicketErrado[];
  resumo_por_sla: ResumoPorSLA[];
  slas_disponiveis: SLADisponivel[];
}

interface ResumoPorSetor {
  setor_id: number;
  setor_nome: string;
  total: number;
}

export function FixSLATelegram() {
  const [loading, setLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [error, setError] = useState<string>('');
  const [slasSelecionados, setSlasSelecionados] = useState<Record<number, number>>({});
  const [setoresSelecionados, setSetoresSelecionados] = useState<Record<number, number>>({});
  const [salvandoTicket, setSalvandoTicket] = useState<number | null>(null);
  const [corrigindoSetor, setCorrigindoSetor] = useState<number | null>(null);

  const buscarDiagnostico = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/fix-sla-telegram/diagnostico');
      if (!response.ok) throw new Error('Erro ao buscar diagnóstico');
      
      const data = await response.json();
      console.log('=== DADOS RECEBIDOS DO BACKEND ===');
      console.log('Total de tickets:', data.total);
      console.log('Tickets array length:', data.tickets?.length || 0);
      console.log('SLAs disponíveis length:', data.slas_disponiveis?.length || 0);
      console.log('Primeiros 3 SLAs:', data.slas_disponiveis?.slice(0, 3));
      console.log('Estrutura completa:', data);
      setDiagnostico(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const corrigirTicket = async (ticketId: number, ticketNumero: string) => {
    const slaId = slasSelecionados[ticketId];
    if (!slaId) {
      alert('Por favor, selecione um SLA');
      return;
    }

    setSalvandoTicket(ticketId);
    setError('');
    
    try {
      const response = await fetch(`/api/fix-sla-telegram/corrigir-ticket/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sla_id: slaId })
      });
      
      if (!response.ok) throw new Error('Erro ao corrigir ticket');
      
      const data = await response.json();
      alert(`✅ Ticket ${ticketNumero} corrigido!\nSLA anterior: ${data.sla_anterior}\nSLA novo: ${data.sla_novo}`);
      
      // Limpar seleção e atualizar lista
      setSlasSelecionados(prev => {
        const novo = { ...prev };
        delete novo[ticketId];
        return novo;
      });
      await buscarDiagnostico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      alert('❌ Erro ao corrigir ticket');
    } finally {
      setSalvandoTicket(null);
    }
  };

  const corrigirPorSetor = async (setorId: number, setorNome: string, total: number) => {
    if (!confirm(`Corrigir ${total} tickets do setor ${setorNome}?\n\nTodos os tickets receberão o SLA genérico P3 do setor correto.`)) {
      return;
    }

    setCorrigindoSetor(setorId);
    setError('');
    
    try {
      const response = await fetch(`/api/fix-sla-telegram/corrigir-por-setor/${setorId}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Erro ao corrigir tickets');
      
      const data = await response.json();
      
      if (data.erros && data.erros.length > 0) {
        alert(`⚠️ Corrigidos ${data.total_corrigidos} de ${total} tickets.\n\nErros:\n${data.erros.map((e: any) => `${e.numero}: ${e.erro}`).join('\n')}`);
      } else {
        alert(`✅ ${data.total_corrigidos} tickets do setor ${setorNome} corrigidos com sucesso!`);
      }
      
      await buscarDiagnostico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      alert('❌ Erro ao corrigir tickets');
    } finally {
      setCorrigindoSetor(null);
    }
  };

  const getSLAsDoSetor = (setorId: number, setorNome: string) => {
    if (!diagnostico) return [];
    
    // Mapear setores inativos para ativos pelo nome
    const slasDoSetor = diagnostico.slas_disponiveis.filter(sla => {
      // Match direto pelo ID
      if (Number(sla.setor_id) === Number(setorId)) {
        return true;
      }
      
      // Match pelo nome (para setores migrados)
      if (sla.setor_nome && setorNome) {
        const slaSetor = String(sla.setor_nome).toLowerCase().trim();
        const ticketSetor = String(setorNome).toLowerCase().trim();
        return slaSetor === ticketSetor;
      }
      
      return false;
    });
    
    return slasDoSetor;
  };

  const getSetoresDisponiveis = () => {
    if (!diagnostico) return [];
    
    // Extrair setores únicos dos SLAs disponíveis
    const setoresMap = new Map<number, { id: number; nome: string }>();
    console.log('=== PROCESSANDO SETORES ===');
    console.log('Total de SLAs disponíveis:', diagnostico.slas_disponiveis.length);
    
    diagnostico.slas_disponiveis.forEach(sla => {
      console.log('SLA:', sla.id, 'Setor ID:', sla.setor_id, 'Setor Nome:', sla.setor_nome);
      if (!setoresMap.has(sla.setor_id) && sla.setor_nome) {
        console.log('Adicionando setor ao map:', sla.setor_id, sla.setor_nome);
        setoresMap.set(sla.setor_id, {
          id: sla.setor_id,
          nome: sla.setor_nome
        });
      }
    });
    
    const setores = Array.from(setoresMap.values()).sort((a, b) => {
      const nomeA = a.nome || '';
      const nomeB = b.nome || '';
      return nomeA.localeCompare(nomeB);
    });
    
    console.log('Setores disponíveis finais:', setores);
    return setores;
  };

  const getSLAsPorSetorSelecionado = (setorSelecionadoId: number) => {
    if (!diagnostico) return [];
    return diagnostico.slas_disponiveis.filter(sla => Number(sla.setor_id) === Number(setorSelecionadoId));
  };
  
  const handleSetorChange = (ticketId: number, setorId: number) => {
    setSetoresSelecionados(prev => ({
      ...prev,
      [ticketId]: setorId
    }));
    // Limpar SLA selecionado quando o setor mudar
    setSlasSelecionados(prev => {
      const novo = { ...prev };
      delete novo[ticketId];
      return novo;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tickets com SLA Incorreto - Telegram</CardTitle>
          <CardDescription>
            Selecione o SLA correto para cada ticket e clique em Salvar para aplicar a correção
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={buscarDiagnostico} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Buscar Tickets com SLA Incorreto'
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {diagnostico && (
        <>
          {/* Resumo por Setor com Botão de Correção */}
          {diagnostico.tickets.length > 0 && (() => {
            // Agrupar tickets por setor
            const porSetor: Record<number, ResumoPorSetor> = {};
            diagnostico.tickets.forEach(ticket => {
              if (!porSetor[ticket.setor_destino_id]) {
                porSetor[ticket.setor_destino_id] = {
                  setor_id: ticket.setor_destino_id,
                  setor_nome: ticket.setor_nome,
                  total: 0
                };
              }
              porSetor[ticket.setor_destino_id].total++;
            });
            
            const setoresArray = Object.values(porSetor);
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Corrigir por Setor</CardTitle>
                  <CardDescription>
                    Clique no botão para aplicar automaticamente o SLA genérico P3 do setor correto em todos os tickets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {setoresArray.map((setor) => (
                      <div 
                        key={setor.setor_id}
                        className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900"
                      >
                        <div>
                          <p className="font-medium text-blue-900 dark:text-blue-100">
                            {setor.setor_nome}
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {setor.total} tickets com SLA incorreto
                          </p>
                        </div>
                        <Button
                          onClick={() => corrigirPorSetor(setor.setor_id, setor.setor_nome, setor.total)}
                          disabled={corrigindoSetor === setor.setor_id}
                          variant="default"
                        >
                          {corrigindoSetor === setor.setor_id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Corrigindo...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Corrigir {setor.total} Tickets
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Resumo por SLA */}
          {diagnostico.resumo_por_sla.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumo por SLA Incorreto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {diagnostico.resumo_por_sla.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900"
                    >
                      <div>
                        <p className="font-medium text-red-900 dark:text-red-100">
                          {item.sla_nome}
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Setor: {item.sla_setor_nome}
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {item.total}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de tickets */}
          {diagnostico.tickets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tickets com SLA Incorreto ({diagnostico.total})</CardTitle>
                <CardDescription>
                  Selecione o SLA correto na lista e clique em Salvar para aplicar a correção
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Número</th>
                        <th className="text-left p-2">Título</th>
                        <th className="text-left p-2">Setor Destino</th>
                        <th className="text-left p-2">Prioridade</th>
                        <th className="text-left p-2">SLA Atual (Incorreto)</th>
                        <th className="text-left p-2">Setor do SLA</th>
                        <th className="text-left p-2">Setor Correto</th>
                        <th className="text-left p-2">Novo SLA</th>
                        <th className="text-left p-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostico.tickets.map((ticket) => {
                        const setorSelecionado = setoresSelecionados[ticket.id];
                        const slasDisponiveis = setorSelecionado 
                          ? getSLAsPorSetorSelecionado(setorSelecionado)
                          : getSLAsDoSetor(ticket.setor_destino_id, ticket.setor_nome);
                        
                        return (
                          <tr key={ticket.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-mono font-medium">{ticket.numero}</td>
                            <td className="p-2 max-w-xs truncate">{ticket.titulo}</td>
                            <td className="p-2">
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {ticket.setor_nome}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                ticket.prioridade === 'P1' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                ticket.prioridade === 'P2' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                ticket.prioridade === 'P3' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              }`}>
                                {ticket.prioridade}
                              </span>
                            </td>
                            <td className="p-2">{ticket.sla_nome}</td>
                            <td className="p-2">
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {ticket.sla_setor_nome}
                              </span>
                            </td>
                            <td className="p-2">
                              <select
                                value={setoresSelecionados[ticket.id] || ticket.setor_destino_id}
                                onChange={(e) => handleSetorChange(ticket.id, parseInt(e.target.value))}
                                className="w-full px-2 py-1 text-sm border rounded bg-background"
                              >
                                {getSetoresDisponiveis().map(setor => (
                                  <option key={setor.id} value={setor.id}>
                                    {setor.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <select
                                value={slasSelecionados[ticket.id] || ''}
                                onChange={(e) => setSlasSelecionados(prev => ({
                                  ...prev,
                                  [ticket.id]: parseInt(e.target.value)
                                }))}
                                className="w-full px-2 py-1 text-sm border rounded bg-background"
                                disabled={slasDisponiveis.length === 0}
                              >
                                <option value="">Selecione o SLA correto...</option>
                                {slasDisponiveis.map((sla: any) => (
                                  <option key={sla.id} value={sla.id}>
                                    {sla.nome} ({sla.prioridade})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <Button
                                onClick={() => corrigirTicket(ticket.id, ticket.numero)}
                                disabled={!slasSelecionados[ticket.id] || salvandoTicket === ticket.id}
                                size="sm"
                                variant="default"
                              >
                                {salvandoTicket === ticket.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Salvando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-3 w-3 mr-1" />
                                    Salvar
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {diagnostico.tickets.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Mostrando 50 de {diagnostico.tickets.length} tickets
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {diagnostico.total === 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                ✅ Nenhum ticket TI com SLA incorreto encontrado!
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
