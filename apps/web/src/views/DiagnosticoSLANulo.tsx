"use client";

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';

interface DiagnosticoData {
  total_tickets: number;
  sem_prazo_resposta: number;
  sem_prazo_solucao: number;
  sem_sla_id: number;
  por_setor: {
    setor_id: number;
    setor_nome: string;
    total: number;
    sem_prazo_resposta: number;
    sem_prazo_solucao: number;
  }[];
}

export default function DiagnosticoSLANulo() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [corrigindo, setCorrigindo] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [corrigindoSetor, setCorrigindoSetor] = useState<number | null>(null);

  const carregarDiagnostico = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/diagnostico-sla-nulo');
      if (!response.ok) throw new Error('Erro ao carregar diagnóstico');
      const data = await response.json();
      setDiagnostico(data);
    } catch (error) {
      console.error('Erro ao carregar diagnóstico:', error);
    } finally {
      setLoading(false);
    }
  };

  const corrigirSetorEspecifico = async (setorId: number, setorNome: string) => {
    if (!confirm(`Deseja corrigir os SLAs de todos os tickets do setor "${setorNome}"?\n\nEsta operação irá:\n- Buscar e atribuir SLAs apropriados\n- Calcular prazos de solução\n${setorId === 1 ? '- Calcular prazos de resposta (somente TI)\n' : ''}- Processar apenas tickets deste setor\n\nContinuar?`)) {
      return;
    }

    try {
      setCorrigindoSetor(setorId);
      console.log(`[FRONTEND] Corrigindo setor ${setorNome} (ID: ${setorId})...`);
      console.log(`[FRONTEND] Tipo de setorId:`, typeof setorId);
      console.log(`[FRONTEND] Valor de setorId:`, setorId);

      const requestBody = { setor_id: setorId };
      console.log(`[FRONTEND] Body da requisição:`, JSON.stringify(requestBody));

      const response = await fetch('/api/diagnostico-sla-nulo/corrigir-setor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[FRONTEND] Response status:`, response.status);
      console.log(`[FRONTEND] Response ok:`, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FRONTEND] Erro do servidor:`, errorText);
        
        // Tentar fazer parse do JSON de erro
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || errorText);
        } catch {
          throw new Error(errorText);
        }
      }

      const data = await response.json();
      console.log('[FRONTEND] Resultado:', data);

      setResultado(data);
      
      // Recarregar diagnóstico
      setTimeout(() => {
        carregarDiagnostico();
      }, 1000);

      alert(`✅ Correção do setor "${setorNome}" concluída!\n\n${data.tickets_corrigidos} tickets corrigidos\n${data.tickets_com_erro} erros`);

    } catch (error: any) {
      console.error('[FRONTEND] Erro:', error);
      alert(`❌ Erro ao corrigir setor:\n\n${error.message}`);
    } finally {
      setCorrigindoSetor(null);
    }
  };

  const limparPrazoRespostaNaoTI = async () => {
    if (!confirm('⚠️ IMPORTANTE: Esta operação vai REMOVER o prazo de atendimento (resposta) de TODOS os setores EXCETO TI.\n\nApenas a TI deve ter prazo de atendimento. Os outros setores devem ter apenas prazo de resolução.\n\nDeseja continuar?')) {
      return;
    }

    try {
      setCorrigindo(true);
      console.log('[FRONTEND] Limpando prazo_resposta de setores não-TI...');

      const response = await fetch('/api/diagnostico-sla-nulo/limpar-prazo-resposta-nao-ti', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[FRONTEND] Resultado:', data);

      setResultado(data);
      
      // Recarregar diagnóstico
      setTimeout(() => {
        carregarDiagnostico();
      }, 1000);

      alert(`✅ Limpeza concluída!\n\n${data.tickets_atualizados} tickets foram corrigidos.\n\nO prazo de atendimento foi removido de todos os setores exceto TI.`);

    } catch (error: any) {
      console.error('[FRONTEND] Erro:', error);
      alert(`❌ Erro ao limpar prazos:\n\n${error.message}`);
    } finally {
      setCorrigindo(false);
    }
  };

  const corrigirPrazoResposta = async () => {
    if (!confirm('Deseja corrigir o prazo de resposta (SLA de Atendimento) de todos os tickets da TI que estão aparecendo como N/A?\n\nTodos os tickets da TI receberão prazo de resposta de 60 minutos (1 hora) a partir da data de abertura.')) {
      return;
    }

    try {
      setCorrigindo(true);
      console.log('[FRONTEND] Corrigindo prazo_resposta dos tickets TI...');

      const response = await fetch('/api/diagnostico-sla-nulo/corrigir-prazo-resposta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[FRONTEND] Resultado:', data);

      setResultado(data);
      
      // Recarregar diagnóstico
      setTimeout(() => {
        carregarDiagnostico();
      }, 1000);

      alert(`✅ Correção concluída!\n\n${data.tickets_corrigidos} tickets tiveram o prazo de resposta corrigido.`);

    } catch (error: any) {
      console.error('[FRONTEND] Erro:', error);
      alert(`❌ Erro ao corrigir prazos:\n\n${error.message}`);
    } finally {
      setCorrigindo(false);
    }
  };

  const corrigirSLAs = async () => {
    if (!confirm('Deseja corrigir automaticamente todos os tickets do setor TI sem SLA? Esta operação irá buscar e atribuir SLAs apropriados baseados na classificação de cada ticket.\n\nOBS: Apenas tickets do setor TI serão corrigidos.')) {
      console.log('[FRONTEND] ❌ Usuário cancelou a operação');
      return;
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  FRONTEND - INÍCIO DA CORREÇÃO DE SLAs                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    try {
      setCorrigindo(true);
      console.log('[FRONTEND] ✓ Estado "corrigindo" ativado');
      console.log('[FRONTEND] ✓ Timestamp:', new Date().toISOString());
      console.log('[FRONTEND] ✓ URL base:', window.location.origin);
      console.log('[FRONTEND] ✓ URL completa:', window.location.href);
      
      const requestBody = { ticket_ids: [] };
      console.log('[FRONTEND] ✓ Body da requisição preparado:', JSON.stringify(requestBody, null, 2));
      
      const requestUrl = '/api/diagnostico-sla-nulo/corrigir';
      console.log('[FRONTEND] ✓ URL da requisição:', requestUrl);
      console.log('[FRONTEND] ✓ URL completa:', window.location.origin + requestUrl);
      
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };
      console.log('[FRONTEND] ✓ Opções da requisição:', JSON.stringify({
        method: requestOptions.method,
        headers: requestOptions.headers,
        bodyLength: requestOptions.body.length
      }, null, 2));
      
      console.log('[FRONTEND] ⏳ Enviando requisição fetch...');
      const startTime = Date.now();
      
      const response = await fetch(requestUrl, requestOptions);
      
      const duration = Date.now() - startTime;
      console.log(`[FRONTEND] ✓ Resposta recebida em ${duration}ms`);
      console.log('[FRONTEND] ✓ Status HTTP:', response.status);
      console.log('[FRONTEND] ✓ Status text:', response.statusText);
      console.log('[FRONTEND] ✓ Response OK?', response.ok);
      console.log('[FRONTEND] ✓ Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      
      if (!response.ok) {
        console.error('[FRONTEND] ❌ Resposta não-OK detectada');
        console.error('[FRONTEND] ❌ Status:', response.status);
        console.error('[FRONTEND] ❌ Status text:', response.statusText);
        
        let errorText;
        try {
          console.log('[FRONTEND] ⏳ Tentando ler corpo da resposta como texto...');
          errorText = await response.text();
          console.error('[FRONTEND] ❌ Corpo da resposta de erro:', errorText);
          console.error('[FRONTEND] ❌ Tamanho do texto:', errorText.length);
        } catch (textError: any) {
          console.error('[FRONTEND] ❌ Erro ao ler texto da resposta:', textError);
          errorText = `Não foi possível ler o corpo da resposta: ${textError.message}`;
        }
        
        // Tentar fazer parse como JSON para obter mais detalhes
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[FRONTEND] ❌ Erro parseado como JSON:', JSON.stringify(errorJson, null, 2));
        } catch {
          console.error('[FRONTEND] ❌ Resposta de erro não é JSON válido');
        }
        
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }
      
      console.log('[FRONTEND] ⏳ Fazendo parse do JSON da resposta...');
      let data;
      try {
        const responseText = await response.text();
        console.log('[FRONTEND] ✓ Texto da resposta recebido (primeiros 500 chars):', responseText.substring(0, 500));
        console.log('[FRONTEND] ✓ Tamanho total da resposta:', responseText.length, 'bytes');
        
        data = JSON.parse(responseText);
        console.log('[FRONTEND] ✓ JSON parseado com sucesso');
        console.log('[FRONTEND] ✓ Estrutura da resposta:', JSON.stringify(data, null, 2));
      } catch (parseError: any) {
        console.error('[FRONTEND] ❌ Erro ao fazer parse do JSON:', parseError);
        console.error('[FRONTEND] ❌ Tipo do erro:', parseError.constructor?.name);
        console.error('[FRONTEND] ❌ Mensagem:', parseError.message);
        throw new Error(`Erro ao processar resposta do servidor: ${parseError.message}`);
      }
      
      console.log('[FRONTEND] ✓ Resultado processado:', {
        sucesso: data.sucesso,
        total_processados: data.total_processados,
        tickets_corrigidos: data.tickets_corrigidos,
        tickets_sem_sla: data.tickets_sem_sla,
        tickets_sem_categoria: data.tickets_sem_categoria,
        detalhes_count: data.detalhes?.length || 0
      });
      
      setResultado(data);
      console.log('[FRONTEND] ✓ Estado "resultado" atualizado');
      
      // Recarregar diagnóstico após correção
      console.log('[FRONTEND] ⏳ Agendando recarregamento do diagnóstico em 1s...');
      setTimeout(() => {
        console.log('[FRONTEND] ⏳ Recarregando diagnóstico...');
        carregarDiagnostico();
      }, 1000);
      
      console.log('\n╔═══════════════════════════════════════════════════════════╗');
      console.log('║  FRONTEND - CORREÇÃO CONCLUÍDA COM SUCESSO               ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      
    } catch (error: any) {
      console.error('\n╔═══════════════════════════════════════════════════════════╗');
      console.error('║  FRONTEND - ERRO CAPTURADO                                ║');
      console.error('╚═══════════════════════════════════════════════════════════╝\n');
      console.error('[FRONTEND] ❌ Tipo do erro:', error.constructor?.name);
      console.error('[FRONTEND] ❌ Mensagem:', error.message);
      console.error('[FRONTEND] ❌ Stack trace:', error.stack);
      console.error('[FRONTEND] ❌ Objeto erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      alert(`❌ Erro ao corrigir SLAs:\n\n${error.message}\n\n⚠️ Verifique o console do navegador (F12 → Console) para logs detalhados.`);
    } finally {
      setCorrigindo(false);
      console.log('[FRONTEND] ✓ Estado "corrigindo" desativado');
      console.log('\n╔═══════════════════════════════════════════════════════════╗');
      console.log('║  FRONTEND - OPERAÇÃO FINALIZADA                          ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
    }
  };

  useEffect(() => {
    carregarDiagnostico();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Carregando diagnóstico...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Diagnóstico de SLA Nulo
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Identifique e corrija tickets sem prazos de SLA definidos (aparecendo como N/A nos relatórios)
              </p>
            </div>
            <button
              onClick={carregarDiagnostico}
              disabled={loading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Resumo Geral */}
        {diagnostico && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Tickets</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {diagnostico.total_tickets}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sem Prazo Resposta</span>
                  {diagnostico.sem_prazo_resposta > 0 && (
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {diagnostico.sem_prazo_resposta}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sem Prazo Solução</span>
                  {diagnostico.sem_prazo_solucao > 0 && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {diagnostico.sem_prazo_solucao}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sem SLA ID</span>
                  {diagnostico.sem_sla_id > 0 && (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {diagnostico.sem_sla_id}
                </p>
              </div>
            </div>

            {/* Botões de Correção */}
            
            {/* Botão para LIMPAR prazo_resposta de setores não-TI */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl shadow-sm border border-orange-200 dark:border-orange-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    ⚠️ Limpar Prazo de Atendimento (Setores Não-TI)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Remove o prazo de atendimento de TODOS os setores EXCETO TI. Apenas a TI deve ter SLA de atendimento, os demais setores devem ter apenas SLA de resolução.
                  </p>
                </div>
                <button
                  onClick={limparPrazoRespostaNaoTI}
                  disabled={corrigindo}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {corrigindo ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Limpando...
                    </>
                  ) : (
                    <>
                      <Wrench className="w-5 h-5" />
                      Limpar Prazo Atendimento
                    </>
                  )}
                </button>
              </div>
            </div>

            {diagnostico.sem_prazo_resposta > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Corrigir Tempo de Atendimento (N/A) - Somente TI
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Aplica prazo de resposta de 60 minutos (1 hora) para todos os tickets da TI que estão com "N/A" no SLA de Atendimento
                    </p>
                  </div>
                  <button
                    onClick={corrigirPrazoResposta}
                    disabled={corrigindo}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {corrigindo ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Corrigindo...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-5 h-5" />
                        Corrigir N/A
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {(diagnostico.sem_prazo_solucao > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Correção Completa de SLA
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Atribui automaticamente SLAs apropriados apenas para tickets do setor TI baseados na classificação de cada ticket (categoria, prioridade, tipo)
                    </p>
                  </div>
                  <button
                    onClick={corrigirSLAs}
                    disabled={corrigindo}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {corrigindo ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Corrigindo...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-5 h-5" />
                        Corrigir TI
                      </>
                    )}
                  </button>
                </div>
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
                      <p>✓ {resultado.tickets_corrigidos} tickets corrigidos com sucesso</p>
                      {resultado.tickets_sem_sla > 0 && (
                        <p className="text-orange-700 dark:text-orange-300">
                          ⚠ {resultado.tickets_sem_sla} tickets não puderam ser corrigidos (SLA não encontrado)
                        </p>
                      )}
                      {resultado.tickets_sem_categoria > 0 && (
                        <p className="text-orange-700 dark:text-orange-300">
                          ⚠ {resultado.tickets_sem_categoria} tickets sem categoria/classificação definida
                        </p>
                      )}
                    </div>
                    
                    {/* Mostrar detalhes de tickets com erro */}
                    {resultado.detalhes && resultado.detalhes.filter((d: any) => d.status === 'erro').length > 0 && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-medium text-orange-900 dark:text-orange-200 hover:underline">
                          Ver tickets que falharam ({resultado.detalhes.filter((d: any) => d.status === 'erro').length})
                        </summary>
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                          {resultado.detalhes
                            .filter((d: any) => d.status === 'erro')
                            .map((detalhe: any) => (
                              <div key={detalhe.ticket_id} className="text-xs bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                                <div className="font-medium text-orange-900 dark:text-orange-200">
                                  {detalhe.numero}
                                </div>
                                <div className="text-orange-700 dark:text-orange-300 mt-1">
                                  {detalhe.mensagem}
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

            {/* Detalhamento por Setor */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Detalhamento por Setor
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Setor
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Tickets
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sem Prazo Resposta
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sem Prazo Solução
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {diagnostico.por_setor.map((setor) => (
                      <tr key={setor.setor_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {setor.setor_nome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">
                          {setor.total}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`font-semibold ${setor.sem_prazo_resposta > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {setor.sem_prazo_resposta}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`font-semibold ${setor.sem_prazo_solucao > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {setor.sem_prazo_solucao}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          {(setor.sem_prazo_resposta > 0 || setor.sem_prazo_solucao > 0) ? (
                            <button
                              onClick={() => corrigirSetorEspecifico(setor.setor_id, setor.setor_nome)}
                              disabled={corrigindoSetor !== null}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {corrigindoSetor === setor.setor_id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Corrigindo...
                                </>
                              ) : (
                                <>
                                  <Wrench className="w-3 h-3" />
                                  Corrigir
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
