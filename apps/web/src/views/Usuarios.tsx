"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Users, Search, Shield, CheckCircle, XCircle, Edit2, Save, X, Plus, Trash2, Building2 } from "lucide-react";

interface Usuario {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: 'solicitante' | 'tecnico' | 'gestor' | 'admin';
  unidade_id: number | null;
  setor: string | null;
  setor_id: number | null;
  setor_nome: string | null;
  ativo: boolean;
  telegram_user_id: string | null;
  telegram_username: string | null;
  whatsapp_phone: string | null;
  created_at: string;
  updated_at: string;
}

interface Setor {
  id: number;
  nome: string;
  ativo: boolean;
}

interface Unidade {
  id: number;
  nome: string;
  codigo: string;
  ativo: boolean;
}

interface SetorAdicional {
  id: number;
  setor_id: number;
  setor_nome: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    nome: string;
    perfil: string;
    unidade_id: number | null;
    setor_id: number | null;
    ativo: boolean;
  }>({ nome: '', perfil: 'solicitante', unidade_id: null, setor_id: null, ativo: true });
  
  const [modalSetoresAberto, setModalSetoresAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [setoresAdicionais, setSetoresAdicionais] = useState<SetorAdicional[]>([]);
  const [adicionandoSetor, setAdicionandoSetor] = useState(false);
  const [novoSetorId, setNovoSetorId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsuarios();
    fetchUnidades();
    fetchSetores();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await fetch("/api/user-profiles", {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Usuários carregados:', data);
        console.log('🔍 Exemplo usuário com setor:', data.find((u: Usuario) => u.setor_nome));
        setUsuarios(data);
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnidades = async () => {
    try {
      const response = await fetch("/api/unidades");
      if (response.ok) {
        const data = await response.json();
        setUnidades(data.filter((u: Unidade) => u.ativo));
      }
    } catch (error) {
      console.error("Erro ao buscar unidades:", error);
    }
  };

  const fetchSetores = async () => {
    try {
      const response = await fetch("/api/setores");
      if (response.ok) {
        const data = await response.json();
        setSetores(data.filter((s: Setor) => s.ativo));
      }
    } catch (error) {
      console.error("Erro ao buscar setores:", error);
    }
  };

  const handleEditClick = (usuario: Usuario) => {
    setEditandoId(usuario.id);
    setEditData({
      nome: usuario.nome,
      perfil: usuario.perfil,
      unidade_id: usuario.unidade_id,
      setor_id: usuario.setor_id,
      ativo: usuario.ativo
    });
  };

  const handleSave = async (usuarioId: number) => {
    try {
      const response = await fetch(`/api/user-profiles/${usuarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        await fetchUsuarios();
        setEditandoId(null);
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  };

  const handleCancel = () => {
    setEditandoId(null);
  };

  const abrirModalSetores = async (usuario: Usuario) => {
    setUsuarioSelecionado(usuario);
    setModalSetoresAberto(true);
    await fetchSetoresAdicionais(usuario.id);
  };

  const fetchSetoresAdicionais = async (userProfileId: number) => {
    try {
      const response = await fetch(`/api/user-setores-acesso/${userProfileId}`);
      if (response.ok) {
        const data = await response.json();
        setSetoresAdicionais(data);
      }
    } catch (error) {
      console.error("Erro ao buscar setores adicionais:", error);
    }
  };

  const adicionarSetorAdicional = async () => {
    if (!usuarioSelecionado || !novoSetorId) return;
    
    try {
      const response = await fetch(`/api/user-setores-acesso/${usuarioSelecionado.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setor_id: novoSetorId })
      });

      if (response.ok) {
        await fetchSetoresAdicionais(usuarioSelecionado.id);
        setNovoSetorId(null);
        setAdicionandoSetor(false);
      }
    } catch (error) {
      console.error("Erro ao adicionar setor:", error);
    }
  };

  const removerSetorAdicional = async (id: number) => {
    if (!usuarioSelecionado) return;
    
    try {
      const response = await fetch(`/api/user-setores-acesso/${usuarioSelecionado.id}/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchSetoresAdicionais(usuarioSelecionado.id);
      }
    } catch (error) {
      console.error("Erro ao remover setor:", error);
    }
  };

  const fecharModalSetores = () => {
    setModalSetoresAberto(false);
    setUsuarioSelecionado(null);
    setSetoresAdicionais([]);
    setAdicionandoSetor(false);
    setNovoSetorId(null);
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      usuario.nome.toLowerCase().includes(termo) ||
      usuario.email.toLowerCase().includes(termo) ||
      usuario.perfil.toLowerCase().includes(termo) ||
      (usuario.setor_nome && usuario.setor_nome.toLowerCase().includes(termo))
    );
  });

  const perfilColors = {
    solicitante: 'bg-blue-100 text-blue-700 border-blue-200',
    tecnico: 'bg-green-100 text-green-700 border-green-200',
    gestor: 'bg-purple-100 text-purple-700 border-purple-200',
    admin: 'bg-red-100 text-red-700 border-red-200',
  };

  const perfilLabels = {
    solicitante: 'Solicitante',
    tecnico: 'Técnico',
    gestor: 'Gestor',
    admin: 'Admin',
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Usuários do Sistema</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gerencie perfis, permissões e acessos
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users size={20} />
            <span>{usuarios.length} usuários cadastrados</span>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, email, perfil ou setor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Lista de Usuários */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Setor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Unidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Perfil
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Integrações
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Acesso Adicional
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {usuariosFiltrados.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        {editandoId === usuario.id ? (
                          <div>
                            <input
                              type="text"
                              value={editData.nome}
                              onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-1"
                              placeholder="Nome completo"
                            />
                            <p className="text-sm text-gray-500 dark:text-gray-400">{usuario.email}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{usuario.nome}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{usuario.email}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {usuario.telefone || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editandoId === usuario.id ? (
                          <select
                            value={editData.setor_id || ''}
                            onChange={(e) => setEditData({ ...editData, setor_id: e.target.value ? parseInt(e.target.value) : null })}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Sem setor</option>
                            {setores.map(s => (
                              <option key={s.id} value={s.id}>{s.nome}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {usuario.setor_nome ? usuario.setor_nome : '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editandoId === usuario.id ? (
                          <select
                            value={editData.unidade_id || ''}
                            onChange={(e) => setEditData({ ...editData, unidade_id: e.target.value ? parseInt(e.target.value) : null })}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Sem unidade</option>
                            {unidades.map(u => (
                              <option key={u.id} value={u.id}>{u.nome}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {unidades.find(u => u.id === usuario.unidade_id)?.nome || '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editandoId === usuario.id ? (
                          <select
                            value={editData.perfil}
                            onChange={(e) => setEditData({ ...editData, perfil: e.target.value })}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="solicitante">Solicitante</option>
                            <option value="tecnico">Técnico</option>
                            <option value="gestor">Gestor</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${perfilColors[usuario.perfil]}`}>
                            <Shield size={12} className="inline mr-1" />
                            {perfilLabels[usuario.perfil]}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editandoId === usuario.id ? (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.ativo}
                              onChange={(e) => setEditData({ ...editData, ativo: e.target.checked })}
                              className="rounded border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Ativo</span>
                          </label>
                        ) : (
                          <div className="flex items-center gap-2">
                            {usuario.ativo ? (
                              <>
                                <CheckCircle className="text-green-500" size={16} />
                                <span className="text-sm text-green-700 dark:text-green-400">Ativo</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="text-red-500" size={16} />
                                <span className="text-sm text-red-700 dark:text-red-400">Inativo</span>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {usuario.telegram_user_id && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                              Telegram
                            </span>
                          )}
                          {usuario.whatsapp_phone && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs">
                              WhatsApp
                            </span>
                          )}
                          {!usuario.telegram_user_id && !usuario.whatsapp_phone && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => abrirModalSetores(usuario)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                        >
                          <Building2 size={16} />
                          Gerenciar
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {editandoId === usuario.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSave(usuario.id)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
                              title="Salvar"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditClick(usuario)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usuariosFiltrados.length === 0 && (
              <div className="text-center py-12">
                <Users className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhum usuário encontrado
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Tente ajustar os filtros de busca
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal de Setores Adicionais */}
        {modalSetoresAberto && usuarioSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Acesso Adicional a Setores
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {usuarioSelecionado.nome} - Setor principal: {usuarioSelecionado.setor_nome || 'Não definido'}
                    </p>
                  </div>
                  <button
                    onClick={fecharModalSetores}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Este usuário pode atender chamados dos seguintes setores adicionais:
                    </p>
                    {!adicionandoSetor && (
                      <button
                        onClick={() => setAdicionandoSetor(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                      >
                        <Plus size={16} />
                        Adicionar Setor
                      </button>
                    )}
                  </div>

                  {adicionandoSetor && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2">
                        <select
                          value={novoSetorId || ''}
                          onChange={(e) => setNovoSetorId(e.target.value ? parseInt(e.target.value) : null)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">Selecione um setor...</option>
                          {setores
                            .filter(s => s.id !== usuarioSelecionado.setor_id && !setoresAdicionais.some(sa => sa.setor_id === s.id))
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.nome}</option>
                            ))}
                        </select>
                        <button
                          onClick={adicionarSetorAdicional}
                          disabled={!novoSetorId}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setAdicionandoSetor(false);
                            setNovoSetorId(null);
                          }}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {setoresAdicionais.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Building2 size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Nenhum setor adicional configurado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {setoresAdicionais.map((sa) => (
                        <div
                          key={sa.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-center gap-2">
                            <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {sa.setor_nome}
                            </span>
                          </div>
                          <button
                            onClick={() => removerSetorAdicional(sa.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                            title="Remover acesso"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <button
                  onClick={fecharModalSetores}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
