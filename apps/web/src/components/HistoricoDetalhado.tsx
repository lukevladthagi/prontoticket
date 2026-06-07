"use client";

import { useState, useEffect } from "react";
import { 
  Clock, 
  Settings, 
  MessageCircle, 
  ExternalLink, 
  CheckCircle, 
  FileCheck,
  AlertTriangle,
  UserCheck,
  Plus
} from "lucide-react";
import type { Historico, TipoHistorico, HistoricoDetalhes } from "@/shared/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatarDataBrasil, formatarDataHoraBrasil } from "@/utils/timezone";

interface Props {
  chamadoId: number;
}

export default function HistoricoDetalhado({ chamadoId }: Props) {
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [novaEntrada, setNovaEntrada] = useState({
    tipo: 'acao_tecnica' as TipoHistorico,
    acao: '',
    detalhes: {} as HistoricoDetalhes,
  });
  const { profile } = useUserProfile();

  useEffect(() => {
    fetchHistorico();
  }, [chamadoId]);

  const fetchHistorico = async () => {
    try {
      const response = await fetch(`/api/historico/${chamadoId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setHistorico(data);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdicionarEntrada = async () => {
    if (!novaEntrada.acao.trim()) {
      alert('Por favor, descreva a ação realizada.');
      return;
    }

    try {
      const response = await fetch(`/api/historico/${chamadoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(novaEntrada),
      });

      if (response.ok) {
        setMostrarModal(false);
        setNovaEntrada({
          tipo: 'acao_tecnica',
          acao: '',
          detalhes: {},
        });
        await fetchHistorico();
      }
    } catch (error) {
      console.error("Erro ao adicionar entrada:", error);
      alert('Erro ao adicionar entrada. Tente novamente.');
    }
  };

  const getIconeTipo = (tipo: TipoHistorico) => {
    switch (tipo) {
      case 'acao_tecnica':
        return <Settings className="text-blue-600" size={20} />;
      case 'mudanca_status':
        return <AlertTriangle className="text-orange-600" size={20} />;
      case 'comunicacao':
        return <MessageCircle className="text-purple-600" size={20} />;
      case 'dependencia_terceiro':
        return <ExternalLink className="text-yellow-600" size={20} />;
      case 'decisao':
        return <UserCheck className="text-indigo-600" size={20} />;
      case 'evidencia':
        return <FileCheck className="text-green-600" size={20} />;
      case 'encerramento':
        return <CheckCircle className="text-emerald-600" size={20} />;
      default:
        return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getNomeTipo = (tipo: TipoHistorico) => {
    const nomes: Record<TipoHistorico, string> = {
      'acao_tecnica': 'Ação Técnica',
      'mudanca_status': 'Mudança de Status',
      'comunicacao': 'Comunicação',
      'dependencia_terceiro': 'Dependência de Terceiro',
      'decisao': 'Decisão/Autorização',
      'reclassificacao': 'Reclassificação',
      'evidencia': 'Evidência',
      'encerramento': 'Encerramento Técnico'
    };
    return nomes[tipo] || tipo;
  };

  const renderDetalhes = (item: Historico) => {
    if (!item.detalhes) return null;

    let detalhes: HistoricoDetalhes;
    try {
      detalhes = typeof item.detalhes === 'string' 
        ? JSON.parse(item.detalhes) 
        : item.detalhes;
    } catch {
      return null;
    }

    const campos: { label: string; value: string }[] = [];

    // Ações técnicas
    if (detalhes.local) campos.push({ label: 'Local', value: detalhes.local });
    if (detalhes.equipamento) campos.push({ label: 'Equipamento', value: detalhes.equipamento });
    if (detalhes.procedimento) campos.push({ label: 'Procedimento', value: detalhes.procedimento });

    // Mudanças de status
    if (detalhes.motivo) campos.push({ label: 'Motivo', value: detalhes.motivo });
    if (detalhes.justificativa) campos.push({ label: 'Justificativa', value: detalhes.justificativa });

    // Comunicação
    if (detalhes.destinatario) campos.push({ label: 'Destinatário', value: detalhes.destinatario });
    if (detalhes.meio) campos.push({ label: 'Meio', value: detalhes.meio });
    if (detalhes.resumo) campos.push({ label: 'Resumo', value: detalhes.resumo });

    // Dependências de terceiros
    if (detalhes.fornecedor) campos.push({ label: 'Fornecedor', value: detalhes.fornecedor });
    if (detalhes.protocolo) campos.push({ label: 'Protocolo', value: detalhes.protocolo });
    if (detalhes.data_contato) campos.push({ label: 'Data Contato', value: formatarDataBrasil(detalhes.data_contato) });
    if (detalhes.data_previsao) campos.push({ label: 'Data Previsão', value: formatarDataBrasil(detalhes.data_previsao) });
    if (detalhes.status_terceiro) campos.push({ label: 'Status', value: detalhes.status_terceiro });

    // Decisões
    if (detalhes.aprovador) campos.push({ label: 'Aprovador', value: detalhes.aprovador });
    if (detalhes.tipo_decisao) campos.push({ label: 'Tipo', value: detalhes.tipo_decisao });
    if (detalhes.impacto_decisao) campos.push({ label: 'Impacto', value: detalhes.impacto_decisao });

    // Evidências
    if (detalhes.tipo_evidencia) campos.push({ label: 'Tipo', value: detalhes.tipo_evidencia });
    if (detalhes.arquivo_url) campos.push({ label: 'Arquivo', value: detalhes.arquivo_url });

    // Encerramento
    if (detalhes.causa_raiz) campos.push({ label: 'Causa Raiz', value: detalhes.causa_raiz });
    if (detalhes.solucao_aplicada) campos.push({ label: 'Solução', value: detalhes.solucao_aplicada });
    if (detalhes.resultado) campos.push({ label: 'Resultado', value: detalhes.resultado });
    if (detalhes.validado_por) campos.push({ label: 'Validado por', value: detalhes.validado_por });
    if (detalhes.data_validacao) campos.push({ label: 'Data Validação', value: formatarDataBrasil(detalhes.data_validacao) });

    if (campos.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        {campos.map((campo, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-medium text-gray-600 dark:text-gray-400">{campo.label}:</span>{' '}
            <span className="text-gray-800 dark:text-gray-300">{campo.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const podeAdicionarEntrada = profile && profile.perfil !== 'solicitante';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock size={20} />
          Histórico Detalhado
        </h2>
        {podeAdicionarEntrada && (
          <button
            onClick={() => setMostrarModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Adicionar Entrada
          </button>
        )}
      </div>

      {historico.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhuma entrada no histórico</p>
      ) : (
        <div className="space-y-4">
          {historico.map((item) => (
            <div key={item.id} className="border-l-4 border-indigo-200 dark:border-indigo-700 pl-4 py-2">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getIconeTipo(item.tipo)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded mb-1">
                        {getNomeTipo(item.tipo)}
                      </span>
                      <p className="text-gray-900 dark:text-gray-200 font-medium">{item.acao}</p>
                      {item.campo_alterado && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span className="font-medium">Campo:</span> {item.campo_alterado}
                          {item.valor_anterior && item.valor_novo && (
                            <span className="ml-2">
                              (<span className="text-red-600 dark:text-red-400">{item.valor_anterior}</span> → <span className="text-green-600 dark:text-green-400">{item.valor_novo}</span>)
                            </span>
                          )}
                        </p>
                      )}
                      {renderDetalhes(item)}
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 ml-4">
                      <p className="font-medium">{item.user_nome}</p>
                      <p>{formatarDataHoraBrasil(item.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Nova Entrada */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Adicionar Entrada ao Histórico</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Tipo de Entrada *</label>
                <select
                  value={novaEntrada.tipo}
                  onChange={(e) => setNovaEntrada({ ...novaEntrada, tipo: e.target.value as TipoHistorico, detalhes: {} })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="acao_tecnica">Ação Técnica</option>
                  <option value="mudanca_status">Mudança de Status</option>
                  <option value="comunicacao">Comunicação</option>
                  <option value="dependencia_terceiro">Dependência de Terceiro</option>
                  <option value="decisao">Decisão/Autorização</option>
                  <option value="evidencia">Evidência</option>
                  <option value="encerramento">Encerramento Técnico</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Descrição *</label>
                <textarea
                  value={novaEntrada.acao}
                  onChange={(e) => setNovaEntrada({ ...novaEntrada, acao: e.target.value })}
                  placeholder="Descreva a ação realizada..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Campos específicos por tipo */}
              {novaEntrada.tipo === 'acao_tecnica' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Local</label>
                    <input
                      type="text"
                      value={novaEntrada.detalhes.local || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, local: e.target.value } })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Equipamento</label>
                    <input
                      type="text"
                      value={novaEntrada.detalhes.equipamento || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, equipamento: e.target.value } })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {novaEntrada.tipo === 'dependencia_terceiro' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Fornecedor</label>
                    <input
                      type="text"
                      value={novaEntrada.detalhes.fornecedor || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, fornecedor: e.target.value } })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Protocolo</label>
                    <input
                      type="text"
                      value={novaEntrada.detalhes.protocolo || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, protocolo: e.target.value } })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Data de Previsão</label>
                    <input
                      type="date"
                      value={novaEntrada.detalhes.data_previsao || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, data_previsao: e.target.value } })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {novaEntrada.tipo === 'encerramento' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Causa Raiz</label>
                    <textarea
                      value={novaEntrada.detalhes.causa_raiz || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, causa_raiz: e.target.value } })}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Solução Aplicada</label>
                    <textarea
                      value={novaEntrada.detalhes.solucao_aplicada || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, solucao_aplicada: e.target.value } })}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Resultado</label>
                    <input
                      type="text"
                      value={novaEntrada.detalhes.resultado || ''}
                      onChange={(e) => setNovaEntrada({ ...novaEntrada, detalhes: { ...novaEntrada.detalhes, resultado: e.target.value } })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAdicionarEntrada}
                  disabled={!novaEntrada.acao.trim()}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => {
                    setMostrarModal(false);
                    setNovaEntrada({
                      tipo: 'acao_tecnica',
                      acao: '',
                      detalhes: {},
                    });
                  }}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
