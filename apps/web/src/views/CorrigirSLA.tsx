"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import { AlertCircle, CheckCircle, RefreshCw, XCircle, Wrench } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CorrigirSLAPage() {
  const [loading, setLoading] = useState(false);
  const [loadingMigracao, setLoadingMigracao] = useState(false);
  const [loadingDesfazer, setLoadingDesfazer] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [resultadoMigracao, setResultadoMigracao] = useState<any>(null);
  const [resultadoDesfazer, setResultadoDesfazer] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroMigracao, setErroMigracao] = useState<string | null>(null);
  const [erroDesfazer, setErroDesfazer] = useState<string | null>(null);

  const executarMigracao = async () => {
    setLoadingMigracao(true);
    setResultadoMigracao(null);
    setErroMigracao(null);

    try {
      const response = await fetch('/api/fix-setores/migrar-setores', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Erro ao migrar setores: ${response.status}`);
      }

      const data = await response.json();
      setResultadoMigracao(data);
    } catch (error: any) {
      console.error('Erro ao migrar setores:', error);
      setErroMigracao(error.message || 'Erro desconhecido ao migrar setores');
    } finally {
      setLoadingMigracao(false);
    }
  };

  const desfazerMigracao = async () => {
    setLoadingDesfazer(true);
    setResultadoDesfazer(null);
    setErroDesfazer(null);

    try {
      const response = await fetch('/api/fix-setores/desfazer-migracao', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Erro ao desfazer migração: ${response.status}`);
      }

      const data = await response.json();
      setResultadoDesfazer(data);
    } catch (error: any) {
      console.error('Erro ao desfazer migração:', error);
      setErroDesfazer(error.message || 'Erro desconhecido ao desfazer migração');
    } finally {
      setLoadingDesfazer(false);
    }
  };

  const executarCorrecao = async () => {
    setLoading(true);
    setResultado(null);
    setErro(null);

    try {
      const response = await fetch('/api/fix-sla/corrigir', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Erro ao executar correção: ${response.status}`);
      }

      const data = await response.json();
      setResultado(data);
    } catch (error: any) {
      console.error('Erro ao corrigir SLAs:', error);
      setErro(error.message || 'Erro desconhecido ao executar correção');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Wrench className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Correção Automática de SLAs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Esta ferramenta corrige automaticamente os prazos de SLA para chamados que não possuem essas informações configuradas.
          </p>
        </div>

        {/* DESFAZER MIGRAÇÃO */}
        <Card className="mb-6 border-2 border-red-300 dark:border-red-700">
          <CardHeader className="bg-red-50 dark:bg-red-900/20">
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-200">
              <XCircle className="w-6 h-6" />
              Desfazer Migração de Setores
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">⚠️ ATENÇÃO:</h3>
                    <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                      Esta ação irá <strong>REVERTER</strong> a migração de setores, restaurando os tickets para os setores originais:
                    </p>
                    <ul className="text-sm text-red-800 dark:text-red-300 ml-4 space-y-1">
                      <li>• Manutenção: Setor 7 → Setor 8</li>
                      <li>• Hotelaria: Setor 9 → Setor 10</li>
                      <li>• Rouparia: Setor 13 → Setor 12</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={desfazerMigracao}
                  disabled={loadingDesfazer}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto text-lg font-semibold"
                >
                  {loadingDesfazer ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Desfazendo migração...
                    </>
                  ) : (
                    <>
                      <XCircle size={20} />
                      Desfazer Migração
                    </>
                  )}
                </button>
              </div>

              {resultadoDesfazer && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                        ✅ Migração Desfeita: {resultadoDesfazer.total_restaurados || 0} tickets restaurados
                      </h4>
                      <div className="space-y-1 text-sm text-green-800 dark:text-green-300">
                        {resultadoDesfazer.detalhes?.map((detalhe: string, index: number) => (
                          <div key={index}>• {detalhe}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {erroDesfazer && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">Erro ao Desfazer</h4>
                      <p className="text-sm text-red-800 dark:text-red-300">{erroDesfazer}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PASSO 1: Migração de Setores */}
        <Card className="mb-6 border-2 border-orange-300 dark:border-orange-700">
          <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-200">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 text-white font-bold">1</span>
              PRIMEIRO: Migrar Setores
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">Problema Identificado:</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-300 mb-2">
                      Alguns tickets foram criados com setores INATIVOS (Hotelaria ID 10, Manutenção ID 8, Rouparia ID 12), 
                      mas os SLAs estão configurados nos setores ATIVOS (Hotelaria ID 9, Manutenção ID 7, Rouparia ID 13).
                    </p>
                    <p className="text-sm text-orange-800 dark:text-orange-300">
                      <strong>Esta migração corrige os tickets para usarem os setores ativos.</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={executarMigracao}
                  disabled={loadingMigracao}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto text-lg font-semibold"
                >
                  {loadingMigracao ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Migrando setores...
                    </>
                  ) : (
                    <>
                      <Wrench size={20} />
                      Migrar Setores (Executar Primeiro)
                    </>
                  )}
                </button>
              </div>

              {resultadoMigracao && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                        ✅ Migração Concluída: {resultadoMigracao.total_migrados || 0} tickets migrados
                      </h4>
                      <div className="space-y-1 text-sm text-green-800 dark:text-green-300">
                        {resultadoMigracao.detalhes?.map((detalhe: string, index: number) => (
                          <div key={index}>• {detalhe}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {erroMigracao && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">Erro na Migração</h4>
                      <p className="text-sm text-red-800 dark:text-red-300">{erroMigracao}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PASSO 2: Correção de SLAs */}
        <Card className="mb-6 border-2 border-indigo-300 dark:border-indigo-700">
          <CardHeader className="bg-indigo-50 dark:bg-indigo-900/20">
            <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-bold">2</span>
              DEPOIS: Aplicar SLAs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">O que será feito:</h3>
                    <ul className="space-y-1.5 text-sm text-blue-800 dark:text-blue-300">
                      <li>• <strong>Busca de chamados</strong>: O sistema analisa todos os chamados que não possuem prazos de SLA configurados</li>
                      <li>• <strong>Identificação do SLA correto</strong>: Para cada chamado, o sistema localiza o SLA apropriado baseado em:</li>
                      <ul className="ml-6 mt-1 space-y-1">
                        <li>- Item específico (se selecionado)</li>
                        <li>- Subcategoria (se selecionada)</li>
                        <li>- Categoria (se selecionada)</li>
                        <li>- SLA genérico (tipo + prioridade + setor)</li>
                      </ul>
                      <li>• <strong>Cálculo dos prazos</strong>: Os prazos são calculados com base na data de abertura do chamado</li>
                      <li>• <strong>Atualização</strong>: Os campos prazo_resposta e prazo_solucao são preenchidos automaticamente</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">Importante:</h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      Esta correção é segura e pode ser executada múltiplas vezes. Apenas chamados sem prazos configurados serão atualizados.
                      Chamados que já possuem SLAs não serão modificados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={executarCorrecao}
                  disabled={loading}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto text-lg font-semibold"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Aplicando SLAs...
                    </>
                  ) : (
                    <>
                      <Wrench size={20} />
                      Aplicar SLAs nos Tickets
                    </>
                  )}
                </button>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Execute após migrar os setores
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado da Execução */}
        {resultado && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-6 h-6" />
                  Correção Concluída
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Chamados Analisados</p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-200">{resultado.analisados || 0}</p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-600 dark:text-green-400 mb-1">Chamados Corrigidos</p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-200">{resultado.corrigidos || 0}</p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Sem SLA Disponível</p>
                    <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-200">{resultado.sem_sla || 0}</p>
                  </div>
                </div>

                {resultado.detalhes && resultado.detalhes.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Detalhes da Correção:</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {resultado.detalhes.map((detalhe: string, index: number) => (
                        <div key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{detalhe}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <AlertCircle className="w-4 h-4" />
                  <p>
                    Após a correção, acesse a aba "Diagnóstico SLA" em Configurações para verificar as estatísticas atualizadas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="mt-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">Erro na Execução</h3>
                  <p className="text-sm text-red-800 dark:text-red-300">{erro}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
