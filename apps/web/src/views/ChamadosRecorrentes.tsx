"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import { Plus, Calendar, Clock, Edit, Trash2, Power, PowerOff, Play, Settings } from "lucide-react";
import { useUserProfile } from "../hooks/useUserProfile";
import { getTiposProblemaParaSetor } from "@/shared/tipos-problema-setor";
import type { Categoria } from "@/shared/types";

interface ChamadoRecorrente {
  id: number;
  titulo: string;
  descricao: string;
  tipo: string;
  tipo_problema: string | null;
  categoria_id: number | null;
  subcategoria_id: number | null;
  item_id: number | null;
  setor_destino_id: number | null;
  setor_responsavel_execucao_id: number | null;
  solicitante_setor: string | null;
  frequencia: 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  dias_semana: string | null;
  dia_mes: number | null;
  hora_execucao: string | null;
  ativo: boolean;
  proximo_chamado_em: string | null;
  ultimo_chamado_gerado_em: string | null;
  criador_nome: string;
  created_at: string;
}

interface Setor {
  id: number;
  nome: string;
}

export default function ChamadosRecorrentesPage() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [recorrentes, setRecorrentes] = useState<ChamadoRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<ChamadoRecorrente | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [processando, setProcessando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Categoria[]>([]);
  const [itens, setItens] = useState<Categoria[]>([]);
  const [tiposProblemaDisponiveis, setTiposProblemaDisponiveis] = useState<string[]>([]);
  const [tipoProblemaCompleto, setTipoProblemaCompleto] = useState<string>('');

  const tipoProblemaSelecionado = tipoProblemaCompleto ? tipoProblemaCompleto.split(' (ex:')[0].trim() : '';

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'Requisição',
    tipo_problema: '',
    categoria_id: '',
    subcategoria_id: '',
    item_id: '',
    setor_destino_id: '',
    setor_responsavel_execucao_id: '',
    solicitante_setor: '',
    frequencia: 'Diária' as 'Diária' | 'Semanal' | 'Mensal' | 'Anual',
    dias_semana: [] as number[],
    dia_mes: 1,
    hora_execucao: '08:00',
  });

  useEffect(() => {
    if (profile && (profile.perfil === 'solicitante')) {
      navigate('/');
    } else {
      fetchRecorrentes();
      fetchSetores();
    }
  }, [profile]);

  const fetchRecorrentes = async () => {
    try {
      const response = await fetch('/api/chamados-recorrentes');
      if (response.ok) {
        const data = await response.json();
        setRecorrentes(data);
      }
    } catch (error) {
      console.error('Erro ao buscar recorrentes:', error);
    } finally {
      setLoading(false);
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

  const fetchCategorias = async (setorId: number) => {
    try {
      const response = await fetch(`/api/categorias?setor_id=${setorId}`);
      if (response.ok) {
        const data = await response.json();
        setCategorias(data);
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const handleSetorDestinoChange = async (setorId: string) => {
    const setorSelecionado = setores.find(s => s.id === parseInt(setorId));
    setFormData({ 
      ...formData, 
      setor_destino_id: setorId,
      tipo_problema: '',
      categoria_id: '',
      subcategoria_id: '',
      item_id: ''
    });
    
    setSubcategorias([]);
    setItens([]);
    setTipoProblemaCompleto('');
    
    if (setorSelecionado && setorSelecionado.nome === 'TI') {
      const tipos = getTiposProblemaParaSetor(setorSelecionado.nome);
      setTiposProblemaDisponiveis(tipos);
      await fetchCategorias(setorSelecionado.id);
    } else {
      setTiposProblemaDisponiveis([]);
      setCategorias([]);
    }
  };

  const handleTipoProblemaChange = (tipoProblema: string) => {
    setTipoProblemaCompleto(tipoProblema);
    const tipoBase = tipoProblema.split(' (ex:')[0].trim();
    setFormData({ 
      ...formData, 
      tipo_problema: tipoBase,
      categoria_id: '',
      subcategoria_id: '',
      item_id: ''
    });
    setSubcategorias([]);
    setItens([]);
  };

  const handleCategoriaChange = async (categoriaId: string) => {
    setFormData({ ...formData, categoria_id: categoriaId, subcategoria_id: '', item_id: '' });
    setSubcategorias([]);
    setItens([]);

    if (!categoriaId) return;

    try {
      const response = await fetch(`/api/categorias/${categoriaId}/subcategorias`);
      if (response.ok) {
        const data = await response.json();
        setSubcategorias(data);
        
        if (data.length === 0) {
          const responseItens = await fetch(`/api/categorias/${categoriaId}/itens`);
          if (responseItens.ok) {
            const itensData = await responseItens.json();
            setItens(itensData);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar subcategorias:', error);
    }
  };

  const handleSubcategoriaChange = async (subcategoriaId: string) => {
    setFormData({ ...formData, subcategoria_id: subcategoriaId, item_id: '' });
    setItens([]);

    if (!subcategoriaId) return;

    try {
      const response = await fetch(`/api/categorias/${subcategoriaId}/itens`);
      if (response.ok) {
        const data = await response.json();
        setItens(data);
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        tipo_problema: formData.tipo_problema || undefined,
        categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : undefined,
        subcategoria_id: formData.subcategoria_id ? parseInt(formData.subcategoria_id) : undefined,
        item_id: formData.item_id ? parseInt(formData.item_id) : undefined,
        setor_destino_id: formData.setor_destino_id ? parseInt(formData.setor_destino_id) : undefined,
        setor_responsavel_execucao_id: formData.setor_responsavel_execucao_id ? parseInt(formData.setor_responsavel_execucao_id) : undefined,
        dias_semana: formData.frequencia === 'Semanal' ? formData.dias_semana.join(',') : undefined,
        dia_mes: formData.frequencia === 'Mensal' || formData.frequencia === 'Anual' ? formData.dia_mes : undefined,
      };

      const url = editando 
        ? `/api/chamados-recorrentes/${editando.id}`
        : '/api/chamados-recorrentes';
      
      const method = editando ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowModal(false);
        setEditando(null);
        resetForm();
        fetchRecorrentes();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar chamado recorrente');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar chamado recorrente');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = async (recorrente: ChamadoRecorrente) => {
    setEditando(recorrente);
    setFormData({
      titulo: recorrente.titulo,
      descricao: recorrente.descricao,
      tipo: recorrente.tipo,
      tipo_problema: recorrente.tipo_problema || '',
      categoria_id: recorrente.categoria_id ? String(recorrente.categoria_id) : '',
      subcategoria_id: recorrente.subcategoria_id ? String(recorrente.subcategoria_id) : '',
      item_id: recorrente.item_id ? String(recorrente.item_id) : '',
      setor_destino_id: recorrente.setor_destino_id ? String(recorrente.setor_destino_id) : '',
      setor_responsavel_execucao_id: recorrente.setor_responsavel_execucao_id ? String(recorrente.setor_responsavel_execucao_id) : '',
      solicitante_setor: recorrente.solicitante_setor || '',
      frequencia: recorrente.frequencia,
      dias_semana: recorrente.dias_semana ? recorrente.dias_semana.split(',').map(Number) : [],
      dia_mes: recorrente.dia_mes || 1,
      hora_execucao: recorrente.hora_execucao || '08:00',
    });
    
    // Carregar tipos de problema se houver setor TI
    if (recorrente.setor_destino_id) {
      const setorSelecionado = setores.find(s => s.id === recorrente.setor_destino_id);
      if (setorSelecionado && setorSelecionado.nome === 'TI') {
        const tipos = getTiposProblemaParaSetor(setorSelecionado.nome);
        setTiposProblemaDisponiveis(tipos);
        await fetchCategorias(setorSelecionado.id);
          
        // Carregar subcategorias se houver categoria
        if (recorrente.categoria_id) {
          const response = await fetch(`/api/categorias/${recorrente.categoria_id}/subcategorias`);
          if (response.ok) {
            const data = await response.json();
            setSubcategorias(data);
            
            if (data.length === 0) {
              const responseItens = await fetch(`/api/categorias/${recorrente.categoria_id}/itens`);
              if (responseItens.ok) {
                const itensData = await responseItens.json();
                setItens(itensData);
              }
            }
          }
        }
        
        // Carregar itens se houver subcategoria
        if (recorrente.subcategoria_id) {
          const response = await fetch(`/api/categorias/${recorrente.subcategoria_id}/itens`);
          if (response.ok) {
            const data = await response.json();
            setItens(data);
          }
        }
      }
    }
    
    setShowModal(true);
  };

  const handleToggle = async (id: number) => {
    try {
      const response = await fetch(`/api/chamados-recorrentes/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (response.ok) {
        fetchRecorrentes();
      }
    } catch (error) {
      console.error('Erro ao alternar status:', error);
    }
  };

  const handleDeletar = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este chamado recorrente?')) {
      return;
    }

    try {
      const response = await fetch(`/api/chamados-recorrentes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchRecorrentes();
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: 'Requisição',
      tipo_problema: '',
      categoria_id: '',
      subcategoria_id: '',
      item_id: '',
      setor_destino_id: '',
      setor_responsavel_execucao_id: '',
      solicitante_setor: '',
      frequencia: 'Diária',
      dias_semana: [],
      dia_mes: 1,
      hora_execucao: '08:00',
    });
    setCategorias([]);
    setSubcategorias([]);
    setItens([]);
    setTiposProblemaDisponiveis([]);
    setTipoProblemaCompleto('');
  };

  const formatarFrequencia = (recorrente: ChamadoRecorrente) => {
    let texto = recorrente.frequencia;
    
    if (recorrente.frequencia === 'Semanal' && recorrente.dias_semana) {
      const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const diasSelecionados = recorrente.dias_semana.split(',').map(d => dias[parseInt(d)]);
      texto += ` (${diasSelecionados.join(', ')})`;
    }
    
    if ((recorrente.frequencia === 'Mensal' || recorrente.frequencia === 'Anual') && recorrente.dia_mes) {
      texto += ` (dia ${recorrente.dia_mes})`;
    }
    
    if (recorrente.hora_execucao) {
      texto += ` às ${recorrente.hora_execucao}`;
    }
    
    return texto;
  };

  const formatarProximaExecucao = (dataISO: string | null) => {
    if (!dataISO) return '-';
    
    const data = new Date(dataISO);
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    if (data.toDateString() === hoje.toDateString()) {
      return `Hoje às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    if (data.toDateString() === amanha.toDateString()) {
      return `Amanhã às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return data.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleDiaSemana = (dia: number) => {
    setFormData(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort()
    }));
  };

  const handleProcessarAgora = async () => {
    if (!confirm('Processar todos os chamados recorrentes agora?')) {
      return;
    }

    setProcessando(true);
    try {
      const response = await fetch('/api/processar-recorrentes-manual', {
        credentials: 'include',
      });

      if (response.ok) {
        alert('Chamados recorrentes processados com sucesso!');
        fetchRecorrentes();
      } else {
        alert('Erro ao processar chamados recorrentes');
      }
    } catch (error) {
      console.error('Erro ao processar:', error);
      alert('Erro ao processar chamados recorrentes');
    } finally {
      setProcessando(false);
    }
  };

  if (loading && recorrentes.length === 0) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Calendar className="text-indigo-600 dark:text-indigo-400" size={36} />
              Chamados Recorrentes
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure tickets que serão criados automaticamente
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(profile?.perfil === 'gestor' || profile?.perfil === 'admin') && (
              <button
                onClick={() => navigate('/corrigir-setor-recorrente')}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                title="Corrigir setor solicitante dos chamados recorrentes"
              >
                <Settings size={20} />
                Corrigir Setores
              </button>
            )}
            <button
              onClick={handleProcessarAgora}
              disabled={processando || recorrentes.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Processar chamados recorrentes agendados"
            >
              <Play size={20} />
              {processando ? 'Processando...' : 'Processar Agora'}
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditando(null);
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Plus size={20} />
              Novo Recorrente
            </button>
          </div>
        </div>

        {/* Lista de Recorrentes */}
        <div className="grid grid-cols-1 gap-4">
          {recorrentes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
              <Calendar className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum chamado recorrente configurado
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Crie chamados que serão abertos automaticamente de forma recorrente
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Criar Primeiro Recorrente
              </button>
            </div>
          ) : (
            recorrentes.map((recorrente) => (
              <div
                key={recorrente.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 transition-all ${
                  recorrente.ativo
                    ? 'border-indigo-200 dark:border-indigo-700 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {recorrente.titulo}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        recorrente.ativo
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {recorrente.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {recorrente.tipo}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      {recorrente.descricao}
                    </p>
                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock size={16} />
                        {formatarFrequencia(recorrente)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        Próximo: {formatarProximaExecucao(recorrente.proximo_chamado_em)}
                      </div>
                      {recorrente.setor_destino_id && (
                        <div className="text-xs">
                          Destino: {setores.find(s => s.id === recorrente.setor_destino_id)?.nome || 'N/A'}
                        </div>
                      )}
                      {recorrente.setor_responsavel_execucao_id && (
                        <div className="text-xs">
                          Executor: {setores.find(s => s.id === recorrente.setor_responsavel_execucao_id)?.nome || 'N/A'}
                        </div>
                      )}
                      {recorrente.solicitante_setor && (
                        <div className="text-xs">
                          Solicitante: {recorrente.solicitante_setor}
                        </div>
                      )}
                      <div className="text-xs">
                        Criado por {recorrente.criador_nome}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(recorrente.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        recorrente.ativo
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={recorrente.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {recorrente.ativo ? <Power size={20} /> : <PowerOff size={20} />}
                    </button>
                    <button
                      onClick={() => handleEditar(recorrente)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit size={20} />
                    </button>
                    {(profile?.perfil === 'gestor' || profile?.perfil === 'admin' || profile?.perfil === 'tecnico') && (
                      <button
                        onClick={() => handleDeletar(recorrente.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editando ? 'Editar' : 'Novo'} Chamado Recorrente
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Verificar backup diário"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva o que precisa ser feito..."
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Requisição">Requisição</option>
                  <option value="Problema">Problema</option>
                  <option value="Incidente">Incidente</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Setor que Receberá o Serviço
                  </label>
                  <select
                    value={formData.setor_destino_id}
                    onChange={(e) => handleSetorDestinoChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione...</option>
                    {setores.map((setor) => (
                      <option key={setor.id} value={setor.id}>{setor.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Setor Responsável pela Execução
                  </label>
                  <select
                    value={formData.setor_responsavel_execucao_id}
                    onChange={(e) => setFormData({ ...formData, setor_responsavel_execucao_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione...</option>
                    {setores.map((setor) => (
                      <option key={setor.id} value={setor.id}>{setor.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Setor Solicitante
                </label>
                <select
                  value={formData.solicitante_setor}
                  onChange={(e) => setFormData({ ...formData, solicitante_setor: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {setores.map((setor) => (
                    <option key={setor.id} value={setor.nome}>{setor.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Problema */}
              {tiposProblemaDisponiveis.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de Problema
                  </label>
                  <select
                    value={tipoProblemaCompleto}
                    onChange={(e) => handleTipoProblemaChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione o tipo de problema...</option>
                    {tiposProblemaDisponiveis.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Categorias - apenas para setor TI */}
              {categorias.length > 0 && tipoProblemaSelecionado && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoria
                  </label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => handleCategoriaChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categorias
                      .filter(cat => cat.tipo === 'categoria' && cat.tipo_problema === tipoProblemaSelecionado)
                      .map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Subcategorias */}
              {subcategorias.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subcategoria
                  </label>
                  <select
                    value={formData.subcategoria_id}
                    onChange={(e) => handleSubcategoriaChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione uma subcategoria...</option>
                    {subcategorias.map((subcategoria) => (
                      <option key={subcategoria.id} value={subcategoria.id}>
                        {subcategoria.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Itens */}
              {itens.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Item
                  </label>
                  <select
                    value={formData.item_id}
                    onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione um item...</option>
                    {itens.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequência <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.frequencia}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    frequencia: e.target.value as any,
                    dias_semana: [],
                  })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Diária">Diária</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              {formData.frequencia === 'Semanal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dias da Semana <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleDiaSemana(index)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          formData.dias_semana.includes(index)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(formData.frequencia === 'Mensal' || formData.frequencia === 'Anual') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dia do Mês <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={formData.dia_mes}
                    onChange={(e) => setFormData({ ...formData, dia_mes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Horário de Execução <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={formData.hora_execucao}
                  onChange={(e) => setFormData({ ...formData, hora_execucao: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditando(null);
                    resetForm();
                  }}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editando ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
