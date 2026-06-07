"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { ItemEstoque, Setor } from "@/shared/types";

interface ModalEstoqueProps {
  item?: ItemEstoque | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ModalEstoque({ item, onClose, onSave }: ModalEstoqueProps) {
  const [loading, setLoading] = useState(false);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "movimento">("info");
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    codigo: '',
    quantidade_atual: 0,
    quantidade_minima: 0,
    unidade_medida: 'un',
    valor_unitario: '',
    setor_id: 0,
    localizacao: '',
  });
  
  const [movimentoData, setMovimentoData] = useState({
    tipo: 'Entrada' as 'Entrada' | 'Ajuste',
    quantidade: 0,
    motivo: '',
  });

  useEffect(() => {
    fetchSetores();
  }, []);

  useEffect(() => {
    if (item) {
      setFormData({
        nome: item.nome,
        descricao: item.descricao || '',
        codigo: item.codigo || '',
        quantidade_atual: item.quantidade_atual,
        quantidade_minima: item.quantidade_minima,
        unidade_medida: item.unidade_medida,
        valor_unitario: item.valor_unitario?.toString() || '',
        setor_id: item.setor_id || 0,
        localizacao: item.localizacao || '',
      });
    }
  }, [item]);

  const fetchSetores = async () => {
    try {
      const response = await fetch('/api/setores', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSetores(data);
      }
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = item ? `/api/estoque/${item.id}` : '/api/estoque';
      const method = item ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          valor_unitario: formData.valor_unitario ? parseFloat(formData.valor_unitario) : null,
          setor_id: formData.setor_id || null,
        }),
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar item');
      }
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      alert('Erro ao salvar item');
    } finally {
      setLoading(false);
    }
  };

  const handleMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    
    setLoading(true);

    try {
      const response = await fetch(`/api/estoque/${item.id}/movimentacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(movimentoData),
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao registrar movimentação');
      }
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      alert('Erro ao registrar movimentação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {item ? 'Editar Item' : 'Novo Item'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X size={20} className="text-gray-900 dark:text-white" />
          </button>
        </div>

        {item && (
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("info")}
                className={`py-3 px-4 font-medium transition-colors border-b-2 ${
                  activeTab === "info"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Informações
              </button>
              <button
                onClick={() => setActiveTab("movimento")}
                className={`py-3 px-4 font-medium transition-colors border-b-2 ${
                  activeTab === "movimento"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Nova Movimentação
              </button>
            </div>
          </div>
        )}

        {activeTab === "info" ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unidade de Medida</label>
                <select
                  value={formData.unidade_medida}
                  onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="un">Unidade</option>
                  <option value="cx">Caixa</option>
                  <option value="pct">Pacote</option>
                  <option value="m">Metro</option>
                  <option value="kg">Quilograma</option>
                  <option value="l">Litro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantidade Atual <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.quantidade_atual}
                  onChange={(e) => setFormData({ ...formData, quantidade_atual: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantidade Mínima</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantidade_minima}
                  onChange={(e) => setFormData({ ...formData, quantidade_minima: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Valor Unitário</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_unitario}
                  onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Setor</label>
                <select
                  value={formData.setor_id}
                  onChange={(e) => setFormData({ ...formData, setor_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value={0}>Selecione...</option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Localização</label>
              <input
                type="text"
                value={formData.localizacao}
                onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                placeholder="Ex: Almoxarifado - Prateleira A3"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
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
        ) : (
          <form onSubmit={handleMovimento} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Movimentação <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={movimentoData.tipo}
                onChange={(e) => setMovimentoData({ ...movimentoData, tipo: e.target.value as 'Entrada' | 'Ajuste' })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Entrada">Entrada</option>
                <option value="Ajuste">Ajuste de Estoque</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={movimentoData.quantidade}
                onChange={(e) => setMovimentoData({ ...movimentoData, quantidade: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {movimentoData.tipo === 'Entrada' 
                  ? `Será adicionado ao estoque atual (${item?.quantidade_atual || 0})`
                  : `Estoque será ajustado para este valor`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={movimentoData.motivo}
                onChange={(e) => setMovimentoData({ ...movimentoData, motivo: e.target.value })}
                rows={3}
                placeholder="Descreva o motivo da movimentação..."
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registrando...' : 'Registrar Movimentação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
