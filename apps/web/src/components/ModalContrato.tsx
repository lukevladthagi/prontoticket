"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Contrato, Fornecedor, Setor } from "@/shared/types";

interface ModalContratoProps {
  contrato?: Contrato | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ModalContrato({ contrato, onClose, onSave }: ModalContratoProps) {
  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [mostrarNovoFornecedor, setMostrarNovoFornecedor] = useState(false);
  const [formData, setFormData] = useState({
    fornecedor_id: 0,
    setor_id: 0,
    numero_contrato: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    valor: '',
    sla_contratado: '',
    contato_fornecedor: '',
  });
  const [novoFornecedor, setNovoFornecedor] = useState({
    nome: '',
    cnpj: '',
    contato: '',
    email: '',
    telefone: '',
  });

  useEffect(() => {
    fetchFornecedores();
    fetchSetores();
  }, []);

  useEffect(() => {
    if (contrato) {
      setFormData({
        fornecedor_id: contrato.fornecedor_id,
        setor_id: contrato.setor_id || 0,
        numero_contrato: contrato.numero_contrato || '',
        descricao: contrato.descricao || '',
        data_inicio: contrato.data_inicio,
        data_fim: contrato.data_fim,
        valor: contrato.valor?.toString() || '',
        sla_contratado: contrato.sla_contratado || '',
        contato_fornecedor: '',
      });
    }
  }, [contrato]);

  const fetchFornecedores = async () => {
    try {
      const response = await fetch('/api/contratos/fornecedores');
      if (response.ok) {
        const data = await response.json();
        setFornecedores(data);
      }
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  const fetchSetores = async () => {
    try {
      const response = await fetch('/api/setores');
      if (response.ok) {
        const data = await response.json();
        setSetores(data);
      }
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
    }
  };

  const handleCriarFornecedor = async () => {
    try {
      const response = await fetch('/api/contratos/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoFornecedor),
      });

      if (response.ok) {
        const fornecedor = await response.json();
        setFornecedores([...fornecedores, fornecedor]);
        setFormData({ ...formData, fornecedor_id: fornecedor.id });
        setMostrarNovoFornecedor(false);
        setNovoFornecedor({ nome: '', cnpj: '', contato: '', email: '', telefone: '' });
      } else {
        alert('Erro ao criar fornecedor');
      }
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
      alert('Erro ao criar fornecedor');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = contrato ? `/api/contratos/${contrato.id}` : '/api/contratos';
      const method = contrato ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedor_id: formData.fornecedor_id,
          setor_id: formData.setor_id || null,
          numero_contrato: formData.numero_contrato,
          descricao: formData.descricao,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim,
          valor: formData.valor ? parseFloat(formData.valor) : null,
          sla_contratado: formData.sla_contratado,
          observacoes: formData.contato_fornecedor,
        }),
      });

      if (response.ok) {
        onSave();
      } else {
        alert('Erro ao salvar contrato');
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      alert('Erro ao salvar contrato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {contrato ? 'Editar Contrato' : 'Novo Contrato'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fornecedor <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                required
                value={formData.fornecedor_id}
                onChange={(e) => setFormData({ ...formData, fornecedor_id: parseInt(e.target.value) })}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value={0}>Selecione...</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setMostrarNovoFornecedor(!mostrarNovoFornecedor)}
                className="px-4 py-2.5 border border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors font-medium"
              >
                Novo
              </button>
            </div>
          </div>

          {mostrarNovoFornecedor && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Novo Fornecedor</h3>
              <input
                type="text"
                placeholder="Nome"
                value={novoFornecedor.nome}
                onChange={(e) => setNovoFornecedor({ ...novoFornecedor, nome: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="CNPJ"
                  value={novoFornecedor.cnpj}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, cnpj: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Contato"
                  value={novoFornecedor.contato}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, contato: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg"
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={novoFornecedor.email}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, email: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg"
                />
                <input
                  type="tel"
                  placeholder="Telefone"
                  value={novoFornecedor.telefone}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, telefone: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleCriarFornecedor}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Criar Fornecedor
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Setor Responsável</label>
            <select
              value={formData.setor_id}
              onChange={(e) => setFormData({ ...formData, setor_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value={0}>Nenhum</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Número do Contrato <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.numero_contrato}
                onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data de Início <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data de Fim <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SLA Contratado</label>
            <input
              type="text"
              value={formData.sla_contratado}
              onChange={(e) => setFormData({ ...formData, sla_contratado: e.target.value })}
              placeholder="Ex: Resolução em até 4 horas"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observações</label>
            <textarea
              value={formData.contato_fornecedor}
              onChange={(e) => setFormData({ ...formData, contato_fornecedor: e.target.value })}
              placeholder="Informações adicionais sobre o contrato"
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
      </div>
    </div>
  );
}
