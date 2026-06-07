"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useUserProfile } from '../hooks/useUserProfile';
import { FilaAtendimento } from '../shared/types';
import { Plus, Edit2, Trash2, Users, Ticket } from 'lucide-react';

export default function Filas() {
  const { profile } = useUserProfile();
  const [filas, setFilas] = useState<FilaAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFila, setEditingFila] = useState<FilaAtendimento | null>(null);
  const [tecnicos, setTecnicos] = useState<Array<{ user_id: string; nome: string }>>([]);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    responsavel_id: '',
  });

  useEffect(() => {
    carregarFilas();
    carregarTecnicos();
  }, []);

  const carregarFilas = async () => {
    try {
      const response = await fetch('/api/filas');
      if (response.ok) {
        const data = await response.json();
        setFilas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarTecnicos = async () => {
    try {
      const response = await fetch('/api/user-profiles?perfil=tecnico');
      if (response.ok) {
        const data = await response.json();
        setTecnicos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.setor_id) {
      alert('Erro: setor não identificado');
      return;
    }

    try {
      const payload = {
        ...formData,
        setor_id: profile.setor_id,
        tipo: 'tecnico',
      };

      const url = editingFila ? `/api/filas/${editingFila.id}` : '/api/filas';
      const method = editingFila ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingFila(null);
        setFormData({ nome: '', descricao: '', responsavel_id: '' });
        carregarFilas();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error || 'Erro ao salvar fila'}`);
      }
    } catch (error) {
      console.error('Erro ao salvar fila:', error);
      alert('Erro ao salvar fila');
    }
  };

  const handleEdit = (fila: FilaAtendimento) => {
    setEditingFila(fila);
    setFormData({
      nome: fila.nome,
      descricao: fila.descricao || '',
      responsavel_id: fila.responsavel_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja desativar esta fila?')) return;

    try {
      const response = await fetch(`/api/filas/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        carregarFilas();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error || 'Erro ao desativar fila'}`);
      }
    } catch (error) {
      console.error('Erro ao desativar fila:', error);
      alert('Erro ao desativar fila');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFila(null);
    setFormData({ nome: '', descricao: '', responsavel_id: '' });
  };

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">Você não tem permissão para gerenciar filas.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Filas de Atendimento</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gerencie as filas de atendimento da TI
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={20} />
            Nova Fila
          </button>
        </div>

        {filas.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-gray-400 dark:text-gray-500" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhuma fila cadastrada</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Crie filas de atendimento para organizar os chamados
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Plus size={20} />
              Nova Fila
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filas.map((fila) => (
              <div
                key={fila.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {fila.tipo === 'helpdesk' ? (
                        <Users size={20} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Ticket size={20} className="text-green-600 dark:text-green-400" />
                      )}
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {fila.nome}
                      </h3>
                    </div>
                    {fila.descricao && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {fila.descricao}
                      </p>
                    )}
                    {fila.responsavel_nome && (
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Responsável: <span className="font-medium">{fila.responsavel_nome}</span>
                      </p>
                    )}
                    <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                      fila.tipo === 'helpdesk'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {fila.tipo === 'helpdesk' ? 'Fila Geral' : 'Fila de Técnico'}
                    </span>
                  </div>
                  {fila.tipo !== 'helpdesk' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(fila)}
                        className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(fila.id)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded transition-colors"
                        title="Desativar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {editingFila ? 'Editar Fila' : 'Nova Fila de Técnico'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome da Fila *
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    placeholder="Ex: Lucas Marins"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={3}
                    placeholder="Descrição opcional da fila"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Técnico Responsável
                  </label>
                  <select
                    value={formData.responsavel_id}
                    onChange={(e) => setFormData({ ...formData, responsavel_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Nenhum técnico atribuído</option>
                    {tecnicos.map((tec) => (
                      <option key={tec.user_id} value={tec.user_id}>
                        {tec.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingFila ? 'Salvar' : 'Criar Fila'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
