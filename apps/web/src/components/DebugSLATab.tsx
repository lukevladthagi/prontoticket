"use client";

import { useState, useEffect } from "react";
import { Bug, RefreshCw, AlertCircle, Clock, Trash2, CheckCircle } from "lucide-react";

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
  tamanho_prazo_resposta?: number;
  motivo?: string;
  prioridade?: string;
  categoria_id?: number;
  subcategoria_id?: number;
  item_id?: number;
  tempo_resposta_minutos?: number;
  tempo_solucao_minutos?: number;
  sla_nome?: string;
}

interface DebugData {
  exemplos_geral: TicketDebug[];
  exemplos_ti: TicketDebug[];
  total_exemplos_geral: number;
  total_exemplos_ti: number;
  ti_null: TicketDebug[];
  ti_vazio: TicketDebug[];
  ti_null_texto: TicketDebug[];
  total_ti_null: number;
  total_ti_vazio: number;
  total_ti_null_texto: number;
  tickets_especificos: TicketDebug[];
  total_tickets_especificos: number;
}

interface RecorrenteDebug {
  id: number;
  numero: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  setor_destino_id: number;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  tipo_problema: string | null;
  data_abertura: string;
  prazo_resposta: string | null;
  prazo_solucao: string | null;
  sla_id: number | null;
  origem_recorrente_id: number;
  status: string;
  categoria_nome: string | null;
  sla_nome: string | null;
  tempo_resposta_minutos: number | null;
  tempo_solucao_minutos: number | null;
}

interface RecorrenteDiagnostico {
  sucesso: boolean;
  resumo: {
    total_recorrentes: number;
    recorrentes_ti: number;
    ti_sem_prazo_resposta: number;
    ti_sem_prazo_solucao: number;
    ti_sem_sla_id: number;
    ti_com_sla_tempo_zero: number;
  };
  detalhes: RecorrenteDebug[];
  detalhes_tempo_zero: RecorrenteDebug[];
}

export default function DebugSLATab() {
  const [debugSLAData, setDebugSLAData] = useState<DebugData | null>(null);
  const [debugSLALoading, setDebugSLALoading] = useState(false);
  const [recorrenteData, setRecorrenteData] = useState<RecorrenteDiagnostico | null>(null);
  const [recorrenteLoading, setRecorrenteLoading] = useState(false);
  const [ticketsEspecificos, setTicketsEspecificos] = useState<any[]>([]);
  const [numerosInput, setNumerosInput] = useState("TKT-179476,TKT-665125,TKT-866525,TKT-130170,TKT-368872,TKT-963444,TKT-021204,TKT-424325,TKT-117340,TKT-636885,TKT-555071");

  useEffect(() => {
    loadDebugSLA();
    loadRecorrentes();
  }, []);

  const loadDebugSLA = async () => {
    try {
      setDebugSLALoading(true);
      const response = await fetch('/api/diagnostico-sla-nulo/debug-tickets');
      if (!response.ok) throw new Error('Erro ao carregar debug');
      const data = await response.json();
      setDebugSLAData(data);
    } catch (error) {
      console.error('Erro ao carregar debug:', error);
      alert('Erro ao carregar dados de debug de SLA');
    } finally {
      setDebugSLALoading(false);
    }
  };

  const loadRecorrentes = async () => {
    try {
      setRecorrenteLoading(true);
      const response = await fetch('/api/diagnostico-sla-nulo/diagnostico-recorrentes');
      if (!response.ok) throw new Error('Erro ao carregar recorrentes');
      const data = await response.json();
      setRecorrenteData(data);
    } catch (error) {
      console.error('Erro ao carregar recorrentes:', error);
      alert('Erro ao carregar dados de chamados recorrentes');
    } finally {
      setRecorrenteLoading(false);
    }
  };

  const buscarTicketsEspecificos = async () => {
    try {
      const response = await fetch(`/api/diagnostico-sla-nulo/diagnostico-tickets-especificos?numeros=${encodeURIComponent(numerosInput)}`);
      if (!response.ok) throw new Error('Erro ao buscar tickets');
      const data = await response.json();
      setTicketsEspecificos(data.tickets || []);
      alert(`Encontrados ${data.total_encontrados} de ${data.total_buscados} tickets`);
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      alert('Erro ao buscar tickets específicos');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Bug className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Debug de Tickets sem SLA
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Visualize exemplos de tickets que estão com prazo_resposta NULL no banco de dados
              </p>
            </div>
          </div>
          <button
            onClick={loadDebugSLA}
            disabled={debugSLALoading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 ${debugSLALoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {debugSLALoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">Carregando dados de debug...</p>
          </div>
        </div>
      )}

      {!debugSLALoading && debugSLAData && (
        <>
          {/* Resumo - Apenas TI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">TI - NULL</span>
              </div>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{debugSLAData.total_ti_null}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completamente vazio</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800 p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">TI - Vazio</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{debugSLAData.total_ti_vazio}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">String vazia ''</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-orange-200 dark:border-orange-800 p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">TI - "null"</span>
              </div>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{debugSLAData.total_ti_null_texto}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Texto "null"</p>
            </div>
          </div>

          {/* Botão para aplicar prazo de resposta */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Aplicar SLA de Atendimento (60 minutos)
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                  Aplica automaticamente o prazo de resposta de <strong>1 hora (60 minutos)</strong> em todos os tickets da TI que estão sem prazo_resposta.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  ⚠️ Apenas setor TI • Calcula baseado na data de abertura de cada ticket
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('⚠️ APLICAR PRAZO DE RESPOSTA - SETOR TI\n\nIsso vai calcular e aplicar o prazo de resposta de 60 minutos para todos os tickets da TI que estão sem prazo_resposta.\n\nO prazo será calculado com base na data de abertura de cada ticket.\n\n✓ Apenas TI\n✓ Outros setores não serão afetados\n\nDeseja continuar?')) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/diagnostico-sla-nulo/corrigir-prazo-resposta', { method: 'POST' });
                    const data = await response.json();
                    if (data.sucesso) {
                      alert(`✓ Sucesso!\n\n${data.tickets_corrigidos} tickets da TI corrigidos.\nErros: ${data.tickets_com_erro}\n\nTodos os tickets agora têm prazo de resposta de 60 minutos.`);
                      loadDebugSLA();
                    } else {
                      alert('Erro: ' + data.error);
                    }
                  } catch (error: any) {
                    alert('Erro ao aplicar prazo de resposta: ' + error.message);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Clock className="w-4 h-4" />
                Aplicar 60 min
              </button>
            </div>
          </div>

          {/* Botão para corrigir chamados recorrentes */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Corrigir Chamados Recorrentes
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  Recalcula os prazos de SLA para todos os chamados recorrentes da TI que estão sem prazo_resposta ou prazo_solucao.
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✓ Usa a mesma lógica dos chamados normais (item → subcategoria → categoria → genérico)
                  <br />
                  ✓ Aplica prazo_resposta apenas quando tempo_resposta_minutos &gt; 0
                  <br />
                  ⚠️ Apenas setor TI
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('⚠️ CORRIGIR CHAMADOS RECORRENTES - SETOR TI\n\nIsso vai recalcular os prazos de SLA para todos os chamados recorrentes da TI que estão sem SLA completo.\n\nO sistema vai:\n• Buscar SLA por categoria/item\n• Aplicar prazo_resposta apenas se apropriado\n• Calcular prazos baseado na data de abertura\n\n✓ Apenas TI\n✓ Outros setores não serão afetados\n\nDeseja continuar?')) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/diagnostico-sla-nulo/corrigir-recorrentes', { method: 'POST' });
                    const data = await response.json();
                    if (data.sucesso) {
                      alert(`✓ Sucesso!\n\nChamados recorrentes processados: ${data.total_processados}\nCorrigidos: ${data.tickets_corrigidos}\nSem SLA: ${data.tickets_sem_sla}\n\nOs chamados agora têm os prazos corretos de SLA.`);
                      loadDebugSLA();
                    } else {
                      alert('Erro: ' + data.error);
                    }
                  } catch (error: any) {
                    alert('Erro ao corrigir chamados recorrentes: ' + error.message);
                  }
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <CheckCircle className="w-4 h-4" />
                Corrigir Recorrentes
              </button>
            </div>
          </div>

          {/* Tickets Específicos */}
          {debugSLAData.tickets_especificos && debugSLAData.tickets_especificos.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800 overflow-hidden">
              <div className="p-6 bg-purple-100 dark:bg-purple-900/40 border-b border-purple-200 dark:border-purple-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                      <Bug className="w-5 h-5" />
                      Tickets Específicos (TKT-130170, TKT-002733, etc.)
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                      {debugSLAData.total_tickets_especificos} ticket(s) encontrado(s)
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                      <strong>Problema identificado:</strong> Estes tickets têm SLAs com tempo de resposta = 0 min, mas o campo prazo_resposta está preenchido.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('⚠️ APENAS SETOR TI\n\nDeseja limpar o campo prazo_resposta dos tickets DA TI que têm SLA com tempo_resposta = 0?\n\n✓ Outros setores NÃO serão afetados.')) {
                        return;
                      }
                      try {
                        const response = await fetch('/api/diagnostico-sla-nulo/limpar-prazo-resposta-zerado', { method: 'POST' });
                        const data = await response.json();
                        if (data.sucesso) {
                          alert(`✓ Sucesso! ${data.tickets_limpos} tickets corrigidos.`);
                          loadDebugSLA();
                        } else {
                          alert('Erro: ' + data.error);
                        }
                      } catch (error: any) {
                        alert('Erro ao limpar prazo_resposta: ' + error.message);
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpar Prazo Resposta (TI)
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-purple-100 dark:bg-purple-900/40">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">Prioridade</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">SLA ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">SLA Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">Tempo Resp.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">Prazo Resposta</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-100 uppercase">Categoria</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-purple-100 dark:divide-purple-900">
                    {debugSLAData.tickets_especificos.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-purple-50 dark:hover:bg-purple-900/20">
                        <td className="px-4 py-3 text-sm font-bold text-purple-900 dark:text-purple-100">{ticket.numero}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{ticket.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.prioridade || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_id || <span className="text-red-600 font-bold">NULL</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_nome || <span className="text-gray-400">N/A</span>}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-bold ${ticket.tempo_resposta_minutos === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {ticket.tempo_resposta_minutos ?? 'N/A'} min
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400 font-mono text-xs">
                          {ticket.prazo_resposta ? String(ticket.prazo_resposta).substring(0, 19) : 'NULL'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{ticket.categoria_id || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabelas de problemas TI */}
          {(debugSLAData.ti_null.length > 0 || debugSLAData.ti_vazio.length > 0 || debugSLAData.ti_null_texto.length > 0) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detalhamento TI</h3>
              
              {debugSLAData.ti_null.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                  <div className="p-4 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-700">
                    <h4 className="font-semibold text-red-900 dark:text-red-100">Completamente NULL ({debugSLAData.total_ti_null})</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-red-100 dark:bg-red-900/40">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Número</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Data Abertura</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">SLA ID</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-red-100 dark:divide-red-900">
                        {debugSLAData.ti_null.slice(0, 10).map((ticket) => (
                          <tr key={ticket.id}>
                            <td className="px-4 py-2 text-sm font-bold text-red-900 dark:text-red-100">{ticket.numero}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.data_abertura?.substring(0, 10)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.status}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_id || 'NULL'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {debugSLAData.ti_vazio.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-hidden">
                  <div className="p-4 bg-yellow-100 dark:bg-yellow-900/40 border-b border-yellow-200 dark:border-yellow-700">
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">String Vazia ({debugSLAData.total_ti_vazio})</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-yellow-100 dark:bg-yellow-900/40">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-yellow-900 dark:text-yellow-100">Número</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-yellow-900 dark:text-yellow-100">Data Abertura</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-yellow-900 dark:text-yellow-100">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-yellow-900 dark:text-yellow-100">SLA ID</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-yellow-100 dark:divide-yellow-900">
                        {debugSLAData.ti_vazio.slice(0, 10).map((ticket) => (
                          <tr key={ticket.id}>
                            <td className="px-4 py-2 text-sm font-bold text-yellow-900 dark:text-yellow-100">{ticket.numero}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.data_abertura?.substring(0, 10)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.status}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_id || 'NULL'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {debugSLAData.ti_null_texto.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 overflow-hidden">
                  <div className="p-4 bg-orange-100 dark:bg-orange-900/40 border-b border-orange-200 dark:border-orange-700">
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100">Texto "null" ({debugSLAData.total_ti_null_texto})</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-orange-100 dark:bg-orange-900/40">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-orange-900 dark:text-orange-100">Número</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-orange-900 dark:text-orange-100">Data Abertura</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-orange-900 dark:text-orange-100">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-orange-900 dark:text-orange-100">SLA ID</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-orange-100 dark:divide-orange-900">
                        {debugSLAData.ti_null_texto.slice(0, 10).map((ticket) => (
                          <tr key={ticket.id}>
                            <td className="px-4 py-2 text-sm font-bold text-orange-900 dark:text-orange-100">{ticket.numero}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.data_abertura?.substring(0, 10)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.status}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_id || 'NULL'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mensagem de sucesso quando não há problemas */}
          {debugSLAData.total_ti_null === 0 && debugSLAData.total_ti_vazio === 0 && debugSLAData.total_ti_null_texto === 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800 p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                ✓ Nenhum problema encontrado nos tickets TI!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Todos os tickets TI estão com prazos de resposta definidos corretamente.
              </p>
            </div>
          )}
        </>
      )}

      {/* Diagnóstico de Chamados Recorrentes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Chamados Recorrentes sem SLA
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Diagnóstico específico dos chamados gerados automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={loadRecorrentes}
            disabled={recorrenteLoading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 ${recorrenteLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {recorrenteLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-purple-600 dark:text-purple-400 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Carregando dados de chamados recorrentes...</p>
            </div>
          </div>
        )}

        {!recorrenteLoading && recorrenteData && (
          <>
            {/* Resumo de Chamados Recorrentes */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
                <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Total Recorrentes</div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{recorrenteData.resumo.total_recorrentes}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Recorrentes TI</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{recorrenteData.resumo.recorrentes_ti}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Sem Prazo Resposta</div>
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">{recorrenteData.resumo.ti_sem_prazo_resposta}</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
                <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">Sem Prazo Solução</div>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{recorrenteData.resumo.ti_sem_prazo_solucao}</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
                <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Sem SLA ID</div>
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{recorrenteData.resumo.ti_sem_sla_id}</div>
              </div>
              <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800 p-4">
                <div className="text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">SLA Tempo = 0min</div>
                <div className="text-2xl font-bold text-pink-900 dark:text-pink-100">{recorrenteData.resumo.ti_com_sla_tempo_zero}</div>
              </div>
            </div>

            {/* Tabela de Detalhes */}
            {recorrenteData.detalhes.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden mb-6">
                <div className="p-4 bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-700">
                  <h4 className="font-semibold text-red-900 dark:text-red-100">
                    Chamados Recorrentes TI sem SLA Completo ({recorrenteData.detalhes.length})
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-red-100 dark:bg-red-900/40">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Número</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Título</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Tipo Problema</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Categoria</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Prioridade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Prazo Resposta</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">Prazo Solução</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-red-900 dark:text-red-100">SLA Nome</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-red-100 dark:divide-red-900">
                      {recorrenteData.detalhes.map((ticket) => (
                        <tr key={ticket.id}>
                          <td className="px-4 py-2 text-sm font-bold text-red-900 dark:text-red-100">{ticket.numero}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.titulo}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.tipo_problema || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.categoria_nome || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.prioridade}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.status}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={ticket.prazo_resposta ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400 font-bold'}>
                              {ticket.prazo_resposta ? '✓' : 'NULL'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={ticket.prazo_solucao ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400 font-bold'}>
                              {ticket.prazo_solucao ? '✓' : 'NULL'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_nome || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabela de Tickets com SLA mas Tempo = 0 */}
            {recorrenteData.detalhes_tempo_zero.length > 0 && (
              <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800 overflow-hidden mb-6">
                <div className="p-4 bg-pink-100 dark:bg-pink-900/40 border-b border-pink-200 dark:border-pink-700">
                  <h4 className="font-semibold text-pink-900 dark:text-pink-100">
                    Chamados Recorrentes com SLA mas Tempo Resposta = 0min ({recorrenteData.detalhes_tempo_zero.length})
                  </h4>
                  <p className="text-sm text-pink-700 dark:text-pink-300 mt-1">
                    Estes tickets têm SLA configurado, mas com tempo_resposta_minutos = 0, fazendo aparecer "N/A" no relatório
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-pink-100 dark:bg-pink-900/40">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Número</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Título</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Tipo Problema</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Categoria</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Prioridade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">SLA Nome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Tempo Resposta</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100">Tempo Solução</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-pink-100 dark:divide-pink-900">
                      {recorrenteData.detalhes_tempo_zero.map((ticket) => (
                        <tr key={ticket.id}>
                          <td className="px-4 py-2 text-sm font-bold text-pink-900 dark:text-pink-100">{ticket.numero}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.titulo}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.tipo_problema || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.categoria_nome || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.prioridade}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.status}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_nome || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className="text-pink-600 dark:text-pink-400 font-bold">0 min</span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {ticket.tempo_solucao_minutos ? `${ticket.tempo_solucao_minutos} min` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mensagem de sucesso quando não há problemas */}
            {recorrenteData.detalhes.length === 0 && recorrenteData.detalhes_tempo_zero.length === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  ✓ Nenhum problema encontrado nos chamados recorrentes!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Todos os chamados recorrentes TI estão com SLA definido corretamente.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Busca de Tickets Específicos */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bug className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Buscar Tickets Específicos
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Digite os números dos tickets separados por vírgula para investigar
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={numerosInput}
            onChange={(e) => setNumerosInput(e.target.value)}
            placeholder="Ex: TKT-130170, TKT-002733, TKT-368872"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={buscarTicketsEspecificos}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Buscar
          </button>
        </div>

        {ticketsEspecificos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Número</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Título</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Setor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Categoria</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">SLA</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Tempo Resp</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Prazo Resp</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Tamanho</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ticketsEspecificos.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-4 py-2 text-sm font-bold text-gray-900 dark:text-white">{ticket.numero}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.titulo?.substring(0, 40)}...</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.setor_nome}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.status}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {ticket.item_nome || ticket.subcategoria_nome || ticket.categoria_nome || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.sla_nome || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={ticket.tempo_resposta_minutos > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400 font-bold'}>
                        {ticket.tempo_resposta_minutos || 0} min
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={ticket.prazo_resposta ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400 font-bold'}>
                        {ticket.prazo_resposta || 'NULL'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.tipo_prazo_resposta || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ticket.tamanho_prazo_resposta || '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
