"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, XCircle, Clock } from "lucide-react";
import type { Projeto, ProjetoAprovacao } from "@/shared/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import TarefasProjeto from "./TarefasProjeto";
import AssinaturaPad from "./AssinaturaPad";

interface ModalProjetoProps {
  projeto?: Projeto | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ModalProjeto({ projeto, onClose, onSave }: ModalProjetoProps) {
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'dados' | 'escopo' | 'aprovacao' | 'historico' | 'documentos'>('dados');
  const [aprovacoes, setAprovacoes] = useState<ProjetoAprovacao[]>([]);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    escopo: '',
    justificativa: '',
    status: 'Planejamento',
    sponsor: '',
    gerente_id: '',
    data_inicio: '',
    data_fim_prevista: '',
    orcamento: '',
    riscos: '',
  });

  const [aprovacaoData, setAprovacaoData] = useState({
    analise_viabilidade: '',
    motivo_rejeicao: '',
    comentario: '',
  });

  const isGestorOrAdmin = profile?.perfil === 'gestor' || profile?.perfil === 'admin';
  // Pode aprovar/rejeitar se estiver em: Planejamento (Aguardando Aprovação)
  const podeAprovar = isGestorOrAdmin && projeto && projeto.status === 'Planejamento';

  useEffect(() => {
    if (projeto) {
      setFormData({
        nome: projeto.nome,
        descricao: projeto.descricao || '',
        escopo: projeto.escopo || '',
        justificativa: projeto.justificativa || '',
        status: projeto.status || 'Planejamento',
        sponsor: projeto.sponsor || '',
        gerente_id: projeto.gerente_id || '',
        data_inicio: projeto.data_inicio || '',
        data_fim_prevista: projeto.data_fim_prevista || '',
        orcamento: projeto.orcamento?.toString() || '',
        riscos: projeto.riscos || '',
      });
      setAprovacaoData({
        analise_viabilidade: projeto.analise_viabilidade || '',
        motivo_rejeicao: projeto.motivo_rejeicao || '',
        comentario: '',
      });
      fetchAprovacoes();
    }
  }, [projeto]);

  const fetchAprovacoes = async () => {
    if (!projeto) return;
    try {
      const response = await fetch(`/api/projetos/${projeto.id}/aprovacoes`);
      if (response.ok) {
        const data = await response.json();
        setAprovacoes(data);
      }
    } catch (error) {
      console.error('Erro ao buscar aprovações:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = projeto ? `/api/projetos/${projeto.id}` : '/api/projetos';
      const method = projeto ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        orcamento: formData.orcamento ? parseFloat(formData.orcamento) : null,
      };

      console.log('[ModalProjeto] Enviando:', method, url, payload);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[ModalProjeto] Response status:', response.status);

      if (response.ok) {
        console.log('[ModalProjeto] Projeto salvo com sucesso');
        onSave();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('[ModalProjeto] Erro do servidor:', response.status, errorData);
        alert(`Erro ao salvar projeto: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('[ModalProjeto] Erro na requisição:', error);
      alert(`Erro ao salvar projeto: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async () => {
    if (!projeto) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/projetos/${projeto.id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aprovacaoData),
      });
      if (response.ok) {
        onSave();
      } else {
        alert('Erro ao aprovar projeto');
      }
    } catch (error) {
      console.error('Erro ao aprovar projeto:', error);
      alert('Erro ao aprovar projeto');
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!projeto) return;
    if (!aprovacaoData.motivo_rejeicao) {
      alert('Por favor, informe o motivo da rejeição');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/projetos/${projeto.id}/rejeitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aprovacaoData),
      });
      if (response.ok) {
        onSave();
      } else {
        alert('Erro ao rejeitar projeto');
      }
    } catch (error) {
      console.error('Erro ao rejeitar projeto:', error);
      alert('Erro ao rejeitar projeto');
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {projeto ? 'Detalhes do Projeto' : 'Novo Projeto'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {projeto && (
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setTab('dados')}
                className={`px-4 py-2 font-medium transition-colors ${
                  tab === 'dados'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dados do Projeto
              </button>
              <button
                onClick={() => setTab('escopo')}
                className={`px-4 py-2 font-medium transition-colors ${
                  tab === 'escopo'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Escopo / Tarefas
              </button>
              {podeAprovar && (
                <button
                  onClick={() => setTab('aprovacao')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    tab === 'aprovacao'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Aprovação
                </button>
              )}
              <button
                onClick={() => setTab('historico')}
                className={`px-4 py-2 font-medium transition-colors ${
                  tab === 'historico'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Histórico
              </button>
              <button
                onClick={() => setTab('documentos')}
                className={`px-4 py-2 font-medium transition-colors ${
                  tab === 'documentos'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Documentos
              </button>
            </div>
          )}
        </div>

        {tab === 'dados' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Projeto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Escopo do Projeto</label>
              <textarea
                value={formData.escopo}
                onChange={(e) => setFormData({ ...formData, escopo: e.target.value })}
                rows={3}
                placeholder="Descreva o escopo e objetivos do projeto"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justificativa <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.justificativa}
                onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
                rows={3}
                placeholder="Por que este projeto é importante? Quais problemas resolve?"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Riscos Identificados</label>
              <textarea
                value={formData.riscos}
                onChange={(e) => setFormData({ ...formData, riscos: e.target.value })}
                rows={3}
                placeholder="Liste os principais riscos e estratégias de mitigação"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Planejamento">Aguardando Aprovação</option>
                  <option value="Em andamento">Em Andamento</option>
                  <option value="Pausado">Em Homologação</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Cancelado">Rejeitado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Orçamento (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.orcamento}
                  onChange={(e) => setFormData({ ...formData, orcamento: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sponsor</label>
                <input
                  type="text"
                  value={formData.sponsor}
                  onChange={(e) => setFormData({ ...formData, sponsor: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gerente do Projeto</label>
                <input
                  type="text"
                  value={formData.gerente_id}
                  onChange={(e) => setFormData({ ...formData, gerente_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Início</label>
                <input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim Prevista</label>
                <input
                  type="date"
                  value={formData.data_fim_prevista}
                  onChange={(e) => setFormData({ ...formData, data_fim_prevista: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}

        {tab === 'escopo' && projeto && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Escopo e Tarefas do Projeto</h3>
              <p className="text-sm text-gray-600">
                Defina os itens do escopo do projeto com checkboxes para acompanhar o progresso e prazos individuais.
              </p>
            </div>
            <TarefasProjeto projetoId={projeto.id} />
          </div>
        )}

        {tab === 'aprovacao' && projeto && podeAprovar && (
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">Análise de Viabilidade</h3>
              <p className="text-sm text-blue-700">
                Avalie a viabilidade técnica, financeira e estratégica do projeto antes de aprovar.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                • <strong>Aprovar</strong>: Move o projeto para "Em Andamento"<br/>
                • <strong>Rejeitar</strong>: Move o projeto para "Rejeitado"
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Análise de Viabilidade
              </label>
              <textarea
                value={aprovacaoData.analise_viabilidade}
                onChange={(e) => setAprovacaoData({ ...aprovacaoData, analise_viabilidade: e.target.value })}
                rows={4}
                placeholder="Descreva sua análise sobre viabilidade, custos, recursos necessários, alinhamento estratégico..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo (para rejeição ou espera)
              </label>
              <textarea
                value={aprovacaoData.motivo_rejeicao}
                onChange={(e) => setAprovacaoData({ ...aprovacaoData, motivo_rejeicao: e.target.value })}
                rows={3}
                placeholder="Explique por que o projeto está sendo rejeitado ou colocado em espera"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comentário Adicional
              </label>
              <textarea
                value={aprovacaoData.comentario}
                onChange={(e) => setAprovacaoData({ ...aprovacaoData, comentario: e.target.value })}
                rows={2}
                placeholder="Observações adicionais sobre a decisão"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleRejeitar}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <XCircle size={18} />
                {loading ? 'Processando...' : 'Rejeitar'}
              </button>
              <button
                onClick={handleAprovar}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                {loading ? 'Processando...' : 'Aprovar'}
              </button>
            </div>
          </div>
        )}

        {tab === 'historico' && projeto && (
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Histórico de Aprovações</h3>
            {aprovacoes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma aprovação registrada ainda
              </div>
            ) : (
              <div className="space-y-4">
                {aprovacoes.map((aprovacao) => (
                  <div key={aprovacao.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {aprovacao.acao === 'Aprovado' && <CheckCircle size={18} className="text-green-600" />}
                        {aprovacao.acao === 'Rejeitado' && <XCircle size={18} className="text-red-600" />}
                        {aprovacao.acao === 'Em espera' && <Clock size={18} className="text-yellow-600" />}
                        <span className={`font-semibold ${
                          aprovacao.acao === 'Aprovado' ? 'text-green-700' :
                          aprovacao.acao === 'Rejeitado' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {aprovacao.acao}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(aprovacao.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p><strong>Aprovador:</strong> {aprovacao.aprovador_nome}</p>
                      {aprovacao.comentario && (
                        <p className="mt-2"><strong>Comentário:</strong> {aprovacao.comentario}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'documentos' && projeto && (
          <DocumentosProjeto projetoId={projeto.id} />
        )}
      </div>
    </div>
  );
}

// Componente de documentos do projeto
interface DocumentosProjetoProps {
  projetoId: number;
}

interface ProjetoDocumento {
  id: number;
  projeto_id: number;
  tipo: 'abertura' | 'encerramento';
  conteudo: string;
  assinatura_gerente_url: string | null;
  assinatura_sponsor_url: string | null;
  assinatura_aprovador_url: string | null;
  assinatura_gerente_data: string | null;
  assinatura_sponsor_data: string | null;
  assinatura_aprovador_data: string | null;
  created_at: string;
}

function DocumentosProjeto({ projetoId: _projetoId }: DocumentosProjetoProps) {
  const projetoId = _projetoId;
  const { profile } = useUserProfile();
  const [documentos, setDocumentos] = useState<ProjetoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tipoUpload, setTipoUpload] = useState<'abertura' | 'encerramento'>('abertura');
  const [showAssinatura, setShowAssinatura] = useState<{ docId: number; papel: 'gerente' | 'sponsor' | 'aprovador' } | null>(null);

  useEffect(() => {
    fetchDocumentos();
  }, [projetoId]);

  const fetchDocumentos = async () => {
    try {
      const response = await fetch(`/api/projeto-documentos/${projetoId}`);
      if (response.ok) {
        const data = await response.json();
        setDocumentos(data);
      }
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Apenas arquivos PDF são permitidos');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipoUpload);

    try {
      const response = await fetch(`/api/projeto-documentos/${projetoId}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await fetchDocumentos();
        e.target.value = '';
      } else {
        alert('Erro ao fazer upload do documento');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do documento');
    } finally {
      setUploading(false);
    }
  };

  const handleAssinar = async (dataUrl: string) => {
    if (!showAssinatura) return;

    try {
      const response = await fetch(`/api/projeto-documentos/${showAssinatura.docId}/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papel: showAssinatura.papel,
          assinatura_data_url: dataUrl,
        }),
      });

      if (response.ok) {
        await fetchDocumentos();
        setShowAssinatura(null);
      } else {
        alert('Erro ao salvar assinatura');
      }
    } catch (error) {
      console.error('Erro ao assinar:', error);
      alert('Erro ao salvar assinatura');
    }
  };

  const podeAssinar = (_doc: ProjetoDocumento, papel: 'gerente' | 'sponsor' | 'aprovador'): boolean => {
    // Admin pode assinar qualquer papel
    if (profile?.perfil === 'admin') return true;
    
    // Gestor pode assinar como aprovador
    if (papel === 'aprovador' && profile?.perfil === 'gestor') return true;
    
    // Por enquanto, permitir qualquer usuário assinar qualquer papel (simplificado)
    // Em produção, você pode adicionar lógica mais específica baseada em campos do projeto
    return true;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Documentos de Projeto com Assinatura</h3>
        <p className="text-sm text-blue-700">
          Faça upload dos PDFs de abertura e encerramento do projeto. Depois, os responsáveis devem assinar digitalmente.
        </p>
      </div>

      {/* Upload de documentos */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Adicionar Documento</h4>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Documento
            </label>
            <select
              value={tipoUpload}
              onChange={(e) => setTipoUpload(e.target.value as 'abertura' | 'encerramento')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="abertura">Abertura de Projeto</option>
              <option value="encerramento">Encerramento de Projeto</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo PDF
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>
        {uploading && (
          <p className="text-sm text-indigo-600 mt-2">Fazendo upload...</p>
        )}
      </div>

      {/* Lista de documentos */}
      <div className="space-y-4">
        {documentos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum documento cadastrado ainda</p>
            <p className="text-sm mt-1">Faça upload do PDF de abertura ou encerramento acima</p>
          </div>
        ) : (
          documentos.map((doc) => (
            <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {doc.tipo === 'abertura' ? 'Documento de Abertura' : 'Documento de Encerramento'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Criado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <a
                  href={doc.conteudo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Ver PDF
                </a>
              </div>

              {/* Status de assinaturas */}
              <div className="grid grid-cols-3 gap-3">
                <AssinaturaStatus
                  papel="Gerente"
                  assinado={!!doc.assinatura_gerente_url}
                  dataAssinatura={doc.assinatura_gerente_data}
                  assinaturaUrl={doc.assinatura_gerente_url}
                  podeAssinar={podeAssinar(doc, 'gerente') && !doc.assinatura_gerente_url}
                  onAssinar={() => setShowAssinatura({ docId: doc.id, papel: 'gerente' })}
                />
                <AssinaturaStatus
                  papel="Sponsor"
                  assinado={!!doc.assinatura_sponsor_url}
                  dataAssinatura={doc.assinatura_sponsor_data}
                  assinaturaUrl={doc.assinatura_sponsor_url}
                  podeAssinar={podeAssinar(doc, 'sponsor') && !doc.assinatura_sponsor_url}
                  onAssinar={() => setShowAssinatura({ docId: doc.id, papel: 'sponsor' })}
                />
                <AssinaturaStatus
                  papel="Aprovador"
                  assinado={!!doc.assinatura_aprovador_url}
                  dataAssinatura={doc.assinatura_aprovador_data}
                  assinaturaUrl={doc.assinatura_aprovador_url}
                  podeAssinar={podeAssinar(doc, 'aprovador') && !doc.assinatura_aprovador_url}
                  onAssinar={() => setShowAssinatura({ docId: doc.id, papel: 'aprovador' })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de assinatura */}
      {showAssinatura && (
        <AssinaturaPad
          onSave={handleAssinar}
          onCancel={() => setShowAssinatura(null)}
        />
      )}
    </div>
  );
}

interface AssinaturaStatusProps {
  papel: string;
  assinado: boolean;
  dataAssinatura: string | null;
  assinaturaUrl: string | null;
  podeAssinar: boolean;
  onAssinar: () => void;
}

function AssinaturaStatus({ papel, assinado, dataAssinatura, assinaturaUrl, podeAssinar, onAssinar }: AssinaturaStatusProps) {
  const [showAssinatura, setShowAssinatura] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">{papel}</p>
      {assinado ? (
        <>
          <div className="flex items-center gap-1 text-green-600 mb-2">
            <CheckCircle size={16} />
            <span className="text-xs">Assinado</span>
          </div>
          {dataAssinatura && (
            <p className="text-xs text-gray-500">
              {new Date(dataAssinatura).toLocaleDateString('pt-BR')}
            </p>
          )}
          {assinaturaUrl && (
            <button
              onClick={() => setShowAssinatura(!showAssinatura)}
              className="text-xs text-indigo-600 hover:text-indigo-700 mt-1"
            >
              {showAssinatura ? 'Ocultar' : 'Ver assinatura'}
            </button>
          )}
          {showAssinatura && assinaturaUrl && (
            <img
              src={assinaturaUrl}
              alt="Assinatura"
              className="mt-2 max-h-16 border border-gray-200 rounded"
            />
          )}
        </>
      ) : podeAssinar ? (
        <button
          onClick={onAssinar}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        >
          Assinar
        </button>
      ) : (
        <div className="flex items-center gap-1 text-gray-400">
          <Clock size={16} />
          <span className="text-xs">Pendente</span>
        </div>
      )}
    </div>
  );
}
