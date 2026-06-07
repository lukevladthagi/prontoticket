"use client";

import { useState } from "react";
import { X, Star, MessageSquare } from "lucide-react";
import type { Chamado } from "@/shared/types";

interface ModalAvaliacoesPendentesProps {
  chamados: Chamado[];
  onClose: () => void;
  onAvaliar: (chamadoId: number, nota: number, nps: number, comentario: string) => Promise<void>;
}

export default function ModalAvaliacoesPendentes({ chamados, onClose, onAvaliar }: ModalAvaliacoesPendentesProps) {
  const [avaliacoes, setAvaliacoes] = useState<{
    [key: number]: { nota: number; nps: number; comentario: string };
  }>({});
  const [enviando, setEnviando] = useState(false);

  const handleNotaChange = (chamadoId: number, nota: number) => {
    setAvaliacoes(prev => ({
      ...prev,
      [chamadoId]: { ...prev[chamadoId], nota, nps: prev[chamadoId]?.nps || 0, comentario: prev[chamadoId]?.comentario || '' }
    }));
  };

  const handleNpsChange = (chamadoId: number, nps: number) => {
    setAvaliacoes(prev => ({
      ...prev,
      [chamadoId]: { ...prev[chamadoId], nota: prev[chamadoId]?.nota || 0, nps, comentario: prev[chamadoId]?.comentario || '' }
    }));
  };

  const handleComentarioChange = (chamadoId: number, comentario: string) => {
    setAvaliacoes(prev => ({
      ...prev,
      [chamadoId]: { ...prev[chamadoId], comentario, nota: prev[chamadoId]?.nota || 0, nps: prev[chamadoId]?.nps || 0 }
    }));
  };

  const handlePular = () => {
    onClose();
  };

  const handleAvaliarAgora = async () => {
    // Verificar quais chamados foram avaliados
    const chamadosAvaliados = chamados.filter(c => 
      avaliacoes[c.id]?.nota > 0 && avaliacoes[c.id]?.nps >= 0
    );

    if (chamadosAvaliados.length === 0) {
      alert("Por favor, avalie pelo menos um atendimento antes de enviar.");
      return;
    }

    setEnviando(true);
    try {
      // Avaliar apenas os chamados que foram preenchidos
      for (const chamado of chamadosAvaliados) {
        const avaliacao = avaliacoes[chamado.id];
        await onAvaliar(chamado.id, avaliacao.nota, avaliacao.nps, avaliacao.comentario);
      }
      onClose();
    } catch (error) {
      console.error("Erro ao enviar avaliações:", error);
      alert("Erro ao enviar avaliações. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-500 to-purple-600">
          <div>
            <h2 className="text-2xl font-bold text-white">Avaliações Pendentes</h2>
            <p className="text-blue-100 mt-1">
              Você tem {chamados.length} {chamados.length === 1 ? 'atendimento' : 'atendimentos'} aguardando avaliação
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>💡 Dica:</strong> Suas avaliações nos ajudam a melhorar o atendimento! Você pode avaliar agora ou pular caso seja urgente.
            </p>
          </div>

          {chamados.map((chamado) => {
            const avaliacao = avaliacoes[chamado.id] || { nota: 0, nps: 0, comentario: '' };
            
            return (
              <div key={chamado.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {chamado.numero} - {chamado.titulo}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Atendido por: {chamado.tecnico_responsavel_nome || 'N/A'}
                    </span>
                  </div>
                  {chamado.descricao && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{chamado.descricao}</p>
                  )}
                </div>

                {/* Avaliação de Satisfação */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Avaliação do Atendimento
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((estrela) => (
                      <button
                        key={estrela}
                        onClick={() => handleNotaChange(chamado.id, estrela)}
                        className={`p-2 rounded-lg transition-all ${
                          avaliacao.nota >= estrela
                            ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                            : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        }`}
                      >
                        <Star size={32} fill={avaliacao.nota >= estrela ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* NPS */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    De 0 a 10, o quanto você recomendaria nossos serviços?
                  </label>
                  <div className="grid grid-cols-11 gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((valor) => (
                      <button
                        key={valor}
                        onClick={() => handleNpsChange(chamado.id, valor)}
                        className={`p-2 rounded text-sm font-medium transition-all ${
                          avaliacao.nps === valor
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                      >
                        {valor}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comentário */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MessageSquare size={16} className="inline mr-1" />
                    Comentários (opcional)
                  </label>
                  <textarea
                    value={avaliacao.comentario}
                    onChange={(e) => handleComentarioChange(chamado.id, e.target.value)}
                    placeholder="Deixe seus comentários sobre o atendimento..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {chamados.length} {chamados.length === 1 ? 'atendimento pendente' : 'atendimentos pendentes'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePular}
                disabled={enviando}
                className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
              >
                Pular e Criar Chamado
              </button>
              <button
                onClick={handleAvaliarAgora}
                disabled={enviando}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 font-medium shadow-lg"
              >
                {enviando ? 'Enviando...' : 'Avaliar Agora'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
