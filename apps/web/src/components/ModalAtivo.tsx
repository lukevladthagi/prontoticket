"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Ativo } from "@/shared/types";

interface ModalAtivoProps {
  ativo?: Ativo | null;
  tipoPropriedade: 'Alugado' | 'Patrimônio';
  onClose: () => void;
  onSave: () => void;
}

export default function ModalAtivo({ ativo, tipoPropriedade, onClose, onSave }: ModalAtivoProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo_barras: '',
    descricao: '',
    tipo: '',
    numero_serie: '',
    marca: '',
    modelo: '',
    fornecedor_nome: '',
    localizacao: '',
    responsavel_nome: '',
    status: '',
    data_aquisicao: '',
    data_solicitacao: '',
    data_retirada: '',
    data_defeito: '',
    data_manutencao: '',
    data_garantia: '',
    setor_id: 0,
    tipo_propriedade: tipoPropriedade,
  });

  useEffect(() => {
    if (ativo) {
      setFormData({
        codigo_barras: ativo.codigo_barras || '',
        descricao: ativo.descricao || '',
        tipo: ativo.tipo || '',
        numero_serie: ativo.numero_serie || '',
        marca: ativo.marca || '',
        modelo: ativo.modelo || '',
        fornecedor_nome: ativo.fornecedor_nome || '',
        localizacao: ativo.localizacao || '',
        responsavel_nome: ativo.responsavel_nome || '',
        status: ativo.status || '',
        data_aquisicao: ativo.data_aquisicao || '',
        data_solicitacao: ativo.data_solicitacao || '',
        data_retirada: ativo.data_retirada || '',
        data_defeito: ativo.data_defeito || '',
        data_manutencao: ativo.data_manutencao || '',
        data_garantia: ativo.data_garantia || '',
        setor_id: ativo.setor_id || 0,
        tipo_propriedade: ativo.tipo_propriedade || tipoPropriedade,
      });
    } else {
      setFormData(prev => ({ ...prev, tipo_propriedade: tipoPropriedade }));
    }
  }, [ativo, tipoPropriedade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = ativo ? `/api/ativos/${ativo.id}` : '/api/ativos';
      const method = ativo ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          setor_id: formData.setor_id || null,
        }),
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar ativo');
      }
    } catch (error) {
      console.error('Erro ao salvar ativo:', error);
      alert('Erro ao salvar ativo');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ativo) return;
    
    if (!confirm('Tem certeza que deseja deletar este item?')) return;

    try {
      const response = await fetch(`/api/ativos/${ativo.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onSave();
      } else {
        alert('Erro ao deletar ativo');
      }
    } catch (error) {
      console.error('Erro ao deletar ativo:', error);
      alert('Erro ao deletar ativo');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-t-xl flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {ativo ? `Editar: ${ativo.descricao || ativo.tipo}` : `➕ Registrar Novo Item ${tipoPropriedade === 'Alugado' ? 'Alugado' : 'de Patrimônio'}`}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          {/* Campos Comuns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Código de Barras <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.codigo_barras}
                onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value.toUpperCase() })}
                placeholder="Escanear código..."
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Descrição do Item <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value.toUpperCase() })}
                placeholder="Ex: NOTEBOOK DELL"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Número de Série <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.numero_serie}
                onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value.toUpperCase() })}
                placeholder="NÚMERO DE SÉRIE"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            {tipoPropriedade === 'Alugado' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                  Fornecedor/Locadora <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fornecedor_nome}
                  onChange={(e) => setFormData({ ...formData, fornecedor_nome: e.target.value.toUpperCase() })}
                  placeholder="NOME DO FORNECEDOR"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Tipo/Categoria
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value="">Selecione...</option>
                <option value="Notebook">Notebook</option>
                <option value="Desktop">Desktop</option>
                <option value="Monitor">Monitor</option>
                <option value="Impressora">Impressora</option>
                <option value="Switch">Switch</option>
                <option value="Access Point">Access Point</option>
                <option value="Servidor">Servidor</option>
                <option value="Mouse">Mouse</option>
                <option value="Teclado">Teclado</option>
                <option value="Câmera">Câmera</option>
                <option value="Equipamento Médico">Equipamento Médico</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Marca
              </label>
              <input
                type="text"
                value={formData.marca}
                onChange={(e) => setFormData({ ...formData, marca: e.target.value.toUpperCase() })}
                placeholder="MARCA"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Modelo
              </label>
              <input
                type="text"
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value.toUpperCase() })}
                placeholder="MODELO"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Setor <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.setor_id}
                onChange={(e) => setFormData({ ...formData, setor_id: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value={0}>Selecione um setor</option>
                <option value={1}>TI</option>
                <option value={2}>RH</option>
                <option value={4}>Marketing</option>
                <option value={7}>Manutenção</option>
                <option value={8}>Hotelaria</option>
                <option value={9}>Comercial</option>
                <option value={13}>Rouparia</option>
                <option value={14}>Call Center</option>
                <option value={15}>Financeiro</option>
                <option value={16}>Administrativo</option>
                <option value={17}>Enfermagem</option>
                <option value={18}>Médico</option>
                <option value={19}>Farmácia</option>
                <option value={20}>Laboratório</option>
                <option value={21}>Radiologia</option>
                <option value={22}>Recepção</option>
                <option value={23}>Faturamento</option>
                <option value={24}>Almoxarifado</option>
                <option value={25}>Segurança</option>
                <option value={26}>Limpeza</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Responsável/Alocado com <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.responsavel_nome}
                onChange={(e) => setFormData({ ...formData, responsavel_nome: e.target.value.toUpperCase() })}
                placeholder="NOME DA PESSOA"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Localização
              </label>
              <input
                type="text"
                value={formData.localizacao}
                onChange={(e) => setFormData({ ...formData, localizacao: e.target.value.toUpperCase() })}
                placeholder="EX: SALA 102, UTI 3"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value="">Selecione o status...</option>
                <option value="Em uso">Em uso</option>
                <option value="Com defeito">Com defeito</option>
                <option value="Em manutenção">Em manutenção</option>
                {tipoPropriedade === 'Alugado' ? (
                  <>
                    <option value="Aguardando retirada ou devolução">Aguardando retirada ou devolução</option>
                    <option value="Devolvido">Devolvido (ao fornecedor)</option>
                    <option value="Disponível">Disponível (para uso)</option>
                  </>
                ) : (
                  <>
                    <option value="Baixado ou descarte">Baixado ou descarte</option>
                    <option value="Disponível">Disponível (para uso)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Data de Entrada
              </label>
              <input
                type="date"
                value={formData.data_aquisicao}
                onChange={(e) => setFormData({ ...formData, data_aquisicao: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            {tipoPropriedade === 'Alugado' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                  Data Solicitação de Devolução
                </label>
                <input
                  type="date"
                  value={formData.data_solicitacao}
                  onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Data de retirada será calculada automaticamente (180 dias)
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Data de Defeito
              </label>
              <input
                type="date"
                value={formData.data_defeito}
                onChange={(e) => setFormData({ ...formData, data_defeito: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Data de Requisição/Manutenção
              </label>
              <input
                type="date"
                value={formData.data_manutencao}
                onChange={(e) => setFormData({ ...formData, data_manutencao: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Data de Garantia
              </label>
              <input
                type="date"
                value={formData.data_garantia}
                onChange={(e) => setFormData({ ...formData, data_garantia: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            {ativo && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-6 py-3 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-semibold uppercase text-sm"
              >
                Deletar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold uppercase text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all font-semibold uppercase text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Registrar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
