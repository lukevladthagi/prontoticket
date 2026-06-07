"use client";

import { useState, useEffect } from 'react';
import { Lock, Plus, Eye, EyeOff, Copy, Pencil, Trash2, Search, RefreshCw, X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '@/components/Layout';
import { useUserProfile } from '@/hooks/useUserProfile';

interface SenhaTI {
  id: number;
  titulo: string;
  categoria: string;
  usuario: string | null;
  senha: string;
  url: string | null;
  observacoes: string | null;
  criador_nome: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIAS = [
  'Sistema',
  'Servidor',
  'Banco de Dados',
  'Email',
  'Wi-Fi',
  'Equipamento',
  'Cloud/SaaS',
  'VPN',
  'Notas Fiscais/Fatura',
  'Outro'
];

export default function SenhasTI() {
  const { profile, loading: profileLoading } = useUserProfile();
  const [senhas, setSenhas] = useState<SenhaTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedSenha, setSelectedSenha] = useState<SenhaTI | null>(null);
  const [editingSenha, setEditingSenha] = useState<SenhaTI | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [formData, setFormData] = useState({
    titulo: '',
    categoria: 'Sistema',
    usuario: '',
    senha: '',
    url: '',
    observacoes: ''
  });

  // Load data on mount
  useEffect(() => {
    if (!profileLoading && profile?.setor_id === 1) {
      carregarSenhas();
    }
  }, [profileLoading, profile]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoriaFiltro, itemsPerPage]);

  // Filtrar senhas - MUST be calculated before any conditional returns
  const senhasFiltradas = senhas.filter(senha => {
    const matchCategoria = categoriaFiltro === 'Todas' || senha.categoria === categoriaFiltro;
    const matchSearch = senha.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (senha.usuario && senha.usuario.toLowerCase().includes(searchTerm.toLowerCase())) ||
                       (senha.url && senha.url.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCategoria && matchSearch;
  });

  // Paginação - MUST be calculated before any conditional returns
  const totalPages = Math.ceil(senhasFiltradas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const senhasPaginadas = senhasFiltradas.slice(startIndex, endIndex);

  const carregarSenhas = async () => {
    try {
      const response = await fetch('/api/senhas-ti', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSenhas(data);
      } else {
        console.error('Erro ao carregar senhas:', response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar senhas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fecharModal = () => {
    setShowModal(false);
    setEditingSenha(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingSenha ? `/api/senhas-ti/${editingSenha.id}` : '/api/senhas-ti';
      const method = editingSenha ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await carregarSenhas();
        fecharModal();
        alert(editingSenha ? 'Senha atualizada com sucesso!' : 'Senha criada com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar senha');
      }
    } catch (error) {
      console.error('Erro ao salvar senha:', error);
      alert('Erro ao salvar senha. Tente novamente.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta senha?')) return;

    try {
      const response = await fetch(`/api/senhas-ti/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await carregarSenhas();
        setShowDetailPanel(false);
        setSelectedSenha(null);
        alert('Senha excluída com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao excluir senha');
      }
    } catch (error) {
      console.error('Erro ao excluir senha:', error);
      alert('Erro ao excluir senha. Tente novamente.');
    }
  };

  const copiarSenha = async (senha: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(senha);
      alert('Senha copiada!');
    } catch (error) {
      console.error('Erro ao copiar senha:', error);
    }
  };

  const copiarUsuario = async (usuario: string) => {
    try {
      await navigator.clipboard.writeText(usuario);
      alert('Usuário copiado!');
    } catch (error) {
      console.error('Erro ao copiar usuário:', error);
    }
  };

  const abrirModal = (senha?: SenhaTI) => {
    if (senha) {
      setEditingSenha(senha);
      setFormData({
        titulo: senha.titulo,
        categoria: senha.categoria,
        usuario: senha.usuario || '',
        senha: senha.senha,
        url: senha.url || '',
        observacoes: senha.observacoes || ''
      });
    } else {
      setEditingSenha(null);
      setFormData({
        titulo: '',
        categoria: 'Sistema',
        usuario: '',
        senha: '',
        url: '',
        observacoes: ''
      });
    }
    setShowModal(true);
  };

  const abrirDetalhes = (senha: SenhaTI) => {
    setSelectedSenha(senha);
    setShowDetailPanel(true);
    setSenhaVisivel(false);
  };

  const fecharDetalhes = () => {
    setShowDetailPanel(false);
    setSelectedSenha(null);
    setSenhaVisivel(false);
  };

  const gerarSenhaSegura = () => {
    const tamanho = 16;
    const maiusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const minusculas = 'abcdefghijklmnopqrstuvwxyz';
    const numeros = '0123456789';
    const especiais = '!@#$%&*()-_=+[]{}';
    const todos = maiusculas + minusculas + numeros + especiais;
    
    let senha = '';
    
    // Garantir pelo menos um de cada tipo
    senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
    senha += minusculas[Math.floor(Math.random() * minusculas.length)];
    senha += numeros[Math.floor(Math.random() * numeros.length)];
    senha += especiais[Math.floor(Math.random() * especiais.length)];
    
    // Preencher o restante
    for (let i = senha.length; i < tamanho; i++) {
      senha += todos[Math.floor(Math.random() * todos.length)];
    }
    
    // Embaralhar
    senha = senha.split('').sort(() => Math.random() - 0.5).join('');
    
    setFormData(prev => ({ ...prev, senha }));
  };

  // Mostrar loading enquanto carrega o perfil
  if (profileLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  // Verificar se usuário é do setor TI (id = 1)
  if (profile && profile.setor_id !== 1) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
            <Lock className="mx-auto mb-4 text-yellow-600 dark:text-yellow-500" size={48} />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Acesso Restrito
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              O gerenciador de senhas está disponível exclusivamente para membros do setor de Tecnologia da Informação.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Cabeçalho */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                <Lock className="text-indigo-600 dark:text-indigo-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciador de Senhas</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {senhasFiltradas.length} {senhasFiltradas.length === 1 ? 'credencial' : 'credenciais'}
                </p>
              </div>
            </div>
            <button
              onClick={() => abrirModal()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              Nova Senha
            </button>
          </div>

          {/* Barra de busca e filtros */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Buscar por título, usuário ou URL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
              />
            </div>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIAS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela */}
        {senhasFiltradas.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Lock className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || categoriaFiltro !== 'Todas' ? 'Nenhuma senha encontrada' : 'Nenhuma senha cadastrada'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {senhasPaginadas.map((senha) => (
                    <tr
                      key={senha.id}
                      onClick={() => abrirDetalhes(senha)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                        {senha.titulo}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                          {senha.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {senha.usuario || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {senha.url ? (
                          <a
                            href={senha.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span className="truncate max-w-[200px]">{senha.url}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => copiarSenha(senha.senha, e)}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                            title="Copiar senha"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModal(senha);
                            }}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(senha.id);
                            }}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Itens por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {startIndex + 1}–{Math.min(endIndex, senhasFiltradas.length)} de {senhasFiltradas.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modal de Detalhes */}
        {showDetailPanel && selectedSenha && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Detalhes</h2>
                  <button
                    onClick={fecharDetalhes}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Título */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Título
                    </label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedSenha.titulo}</p>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Categoria
                    </label>
                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                      {selectedSenha.categoria}
                    </span>
                  </div>

                  {/* Usuário */}
                  {selectedSenha.usuario && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Usuário
                      </label>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900 dark:text-white font-mono flex-1 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded">
                          {selectedSenha.usuario}
                        </p>
                        <button
                          onClick={() => copiarUsuario(selectedSenha.usuario!)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Copiar usuário"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Senha */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Senha
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded font-mono text-sm text-gray-900 dark:text-white">
                        {senhaVisivel ? selectedSenha.senha : '••••••••••••'}
                      </div>
                      <button
                        onClick={() => setSenhaVisivel(!senhaVisivel)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {senhaVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => copiarSenha(selectedSenha.senha)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Copiar senha"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  {/* URL */}
                  {selectedSenha.url && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        URL
                      </label>
                      <a
                        href={selectedSenha.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-2 break-all"
                      >
                        {selectedSenha.url}
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}

                  {/* Observações */}
                  {selectedSenha.observacoes && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Observações
                      </label>
                      <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded whitespace-pre-wrap">
                        {selectedSenha.observacoes}
                      </p>
                    </div>
                  )}

                  {/* Metadados */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Criado por <span className="font-medium">{selectedSenha.criador_nome}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(selectedSenha.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="pt-4 space-y-2">
                    <button
                      onClick={() => {
                        fecharDetalhes();
                        abrirModal(selectedSenha);
                      }}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Pencil size={16} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(selectedSenha.id)}
                      className="w-full px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingSenha ? 'Editar Senha' : 'Nova Senha'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ex: Acesso servidor web"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ex: admin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Senha *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={gerarSenhaSegura}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                      title="Gerar senha segura"
                    >
                      <RefreshCw size={16} />
                      Gerar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Clique em "Gerar" para criar uma senha segura automaticamente
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Informações adicionais..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={fecharModal}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    {editingSenha ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
