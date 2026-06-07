"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import { ArrowLeft, Paperclip, X, Upload } from "lucide-react";
import type { Categoria, Unidade, Setor, CreateChamadoDTO, TipoChamado, Impacto, Urgencia, Chamado } from "@/shared/types";
import { getTiposProblemaParaSetor } from "@/shared/tipos-problema-setor";
import ModalAvaliacoesPendentes from "@/components/ModalAvaliacoesPendentes";

interface ArquivoUpload {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  error?: string;
}

export default function NovoChamadoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Categoria[]>([]);
  const [itens, setItens] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [tiposProblemaDisponiveis, setTiposProblemaDisponiveis] = useState<string[]>([]);
  const [tipoProblemaCompleto, setTipoProblemaCompleto] = useState<string>('');
  const [prioridadeAutomatica, setPrioridadeAutomatica] = useState<string | null>(null);
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState<Chamado[]>([]);
  const [mostrarModalAvaliacoes, setMostrarModalAvaliacoes] = useState(false);
  
  // Extrair tipo base do tipo completo para filtrar categorias
  const tipoProblemaSelecionado = tipoProblemaCompleto ? tipoProblemaCompleto.split(' (ex:')[0].trim() : '';

  const [formData, setFormData] = useState<CreateChamadoDTO>({
    tipo: 'Problema',
    titulo: '',
    descricao: '',
    impacto: undefined,
    urgencia: undefined,
  });

  useEffect(() => {
    fetchUnidades();
    fetchSetores();
    fetchAvaliacoesPendentes();
  }, []);

  const fetchAvaliacoesPendentes = async () => {
    try {
      const response = await fetch("/api/avaliacoes-pendentes");
      if (response.ok) {
        const data = await response.json();
        setAvaliacoesPendentes(data);
        if (data.length > 0) {
          setMostrarModalAvaliacoes(true);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar avaliações pendentes:", error);
    }
  };

  const handleAvaliar = async (chamadoId: number, nota: number, nps: number, comentario: string) => {
    try {
      const response = await fetch(`/api/chamados/${chamadoId}/avaliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nota,
          nps,
          comentario: comentario || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao avaliar chamado");
      }

      // Atualizar lista de avaliações pendentes
      setAvaliacoesPendentes(prev => prev.filter(c => c.id !== chamadoId));
    } catch (error) {
      console.error("Erro ao avaliar chamado:", error);
      throw error;
    }
  };

  const fetchCategorias = async (setorId?: number) => {
    try {
      const url = setorId ? `/api/categorias?setor_id=${setorId}` : "/api/categorias";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Categorias recebidas do backend:', data);
        setCategorias(data);
      }
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    }
  };

  const fetchUnidades = async () => {
    try {
      const response = await fetch("/api/unidades");
      if (response.ok) {
        const data = await response.json();
        setUnidades(data);
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
        setSetores(data);
      }
    } catch (error) {
      console.error("Erro ao buscar setores:", error);
    }
  };

  const handleSetorDestinoChange = async (setorId: number) => {
    const setorSelecionado = setores.find(s => s.id === setorId);
    setFormData({ 
      ...formData, 
      setor_destino_id: setorId,
      categoria_id: undefined,
      subcategoria_id: undefined,
      item_id: undefined
    });
    
    // Limpar subcategorias e itens
    setSubcategorias([]);
    setItens([]);
    setTipoProblemaCompleto('');
    
    // Atualizar tipos de problema baseado no setor
    if (setorSelecionado) {
      const tipos = getTiposProblemaParaSetor(setorSelecionado.nome);
      setTiposProblemaDisponiveis(tipos);
    } else {
      setTiposProblemaDisponiveis([]);
    }
    
    // Buscar categorias apenas para setor TI
    if (setorSelecionado && setorSelecionado.nome === 'TI') {
      await fetchCategorias(setorId);
    }
  };

  const handleTipoProblemaChange = (tipoProblema: string) => {
    setTipoProblemaCompleto(tipoProblema);
    setFormData({ 
      ...formData, 
      titulo: tipoProblema,
      categoria_id: undefined,
      subcategoria_id: undefined,
      item_id: undefined
    });
    setSubcategorias([]);
    setItens([]);
  };

  const handleCategoriaChange = async (categoriaId: number) => {
    setFormData({ ...formData, categoria_id: categoriaId, subcategoria_id: undefined, item_id: undefined });
    setSubcategorias([]);
    setItens([]);

    // Verificar se a categoria tem prioridade automática
    const categoria = categorias.find(c => c.id === categoriaId);
    if (categoria?.prioridade_automatica) {
      setPrioridadeAutomatica(categoria.prioridade_automatica);
    } else {
      setPrioridadeAutomatica(null);
    }

    try {
      const response = await fetch(`/api/categorias/${categoriaId}/subcategorias`);
      if (response.ok) {
        const data = await response.json();
        setSubcategorias(data);
        
        // Se não tem subcategorias, buscar itens diretos
        if (data.length === 0) {
          const responseItens = await fetch(`/api/categorias/${categoriaId}/itens`);
          if (responseItens.ok) {
            const itensData = await responseItens.json();
            setItens(itensData);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao buscar subcategorias:", error);
    }
  };

  const handleSubcategoriaChange = async (subcategoriaId: number) => {
    setFormData({ ...formData, subcategoria_id: subcategoriaId, item_id: undefined });
    setItens([]);

    // Verificar se a subcategoria tem prioridade automática
    const subcategoria = subcategorias.find(c => c.id === subcategoriaId);
    if (subcategoria?.prioridade_automatica) {
      setPrioridadeAutomatica(subcategoria.prioridade_automatica);
    } else {
      // Se não tem na subcategoria, manter a da categoria pai (se houver)
      const categoria = categorias.find(c => c.id === formData.categoria_id);
      setPrioridadeAutomatica(categoria?.prioridade_automatica || null);
    }

    try {
      const response = await fetch(`/api/categorias/${subcategoriaId}/itens`);
      if (response.ok) {
        const data = await response.json();
        setItens(data);
      }
    } catch (error) {
      console.error("Erro ao buscar itens:", error);
    }
  };

  const handleArquivosSelecionados = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const novosArquivos: ArquivoUpload[] = Array.from(files).map((file) => {
      const arquivoUpload: ArquivoUpload = {
        file,
        uploading: false,
        uploaded: false,
      };

      // Criar preview para imagens
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          arquivoUpload.preview = e.target?.result as string;
          setArquivos((prev) => [...prev]);
        };
        reader.readAsDataURL(file);
      }

      return arquivoUpload;
    });

    setArquivos((prev) => [...prev, ...novosArquivos]);
  };

  const removerArquivo = (index: number) => {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  };

  const formatarTamanho = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar se há avaliações pendentes
    if (avaliacoesPendentes.length > 0) {
      setMostrarModalAvaliacoes(true);
      return;
    }
    setLoading(true);

    try {
      // Primeiro, criar o chamado
      const response = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          tipo_problema: tipoProblemaSelecionado || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Erro ${response.status}: ${response.statusText}`;
        console.error("API Error:", errorMessage, errorData);
        alert(`Erro ao criar chamado: ${errorMessage}`);
        return;
      }

      const chamado = await response.json();

      // Se há arquivos, fazer upload de cada um
      if (arquivos.length > 0) {
        for (let i = 0; i < arquivos.length; i++) {
          const arquivo = arquivos[i];
          setArquivos((prev) => {
            const updated = [...prev];
            updated[i].uploading = true;
            return updated;
          });

          try {
            // Upload do arquivo
            const formData = new FormData();
            formData.append('file', arquivo.file);

            const uploadResponse = await fetch('/api/files/upload', {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error('Erro ao fazer upload');
            }

            const uploadData = await uploadResponse.json();

            // Registrar anexo no banco de dados
            await fetch('/api/chamados/' + chamado.id + '/anexos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                nome_arquivo: uploadData.nome_arquivo,
                url: uploadData.url,
                tipo_arquivo: uploadData.tipo_arquivo,
                tamanho: uploadData.tamanho,
              }),
            });

            setArquivos((prev) => {
              const updated = [...prev];
              updated[i].uploading = false;
              updated[i].uploaded = true;
              updated[i].url = uploadData.url;
              return updated;
            });
          } catch (error) {
            console.error('Erro ao fazer upload do arquivo:', error);
            setArquivos((prev) => {
              const updated = [...prev];
              updated[i].uploading = false;
              updated[i].error = 'Erro ao fazer upload';
              return updated;
            });
          }
        }
      }

      navigate(`/chamados/${chamado.id}`);
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
      alert(`Erro ao criar chamado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Novo Chamado</h1>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
          {/* Setor de Destino - Primeira Coisa */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
              🎯 Para qual setor você deseja abrir este chamado? <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.setor_destino_id || ''}
              onChange={(e) => handleSetorDestinoChange(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 border border-indigo-300 dark:border-indigo-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione o setor responsável...</option>
              {setores
                .filter(setor => ['TI', 'Hotelaria', 'Rouparia', 'Comercial', 'Manutenção', 'Marketing', 'Central de navegação'].includes(setor.nome))
                .map((setor) => (
                  <option key={setor.id} value={setor.id}>{setor.nome}</option>
                ))}
            </select>
            <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-2">
              Escolha o setor que deverá atender este chamado (ex: Hotelaria, Manutenção, RH/DP, Marketing, Compras, Cadastro, TI)
            </p>
          </div>

          {/* Setor do Solicitante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seu Setor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.setor_solicitante || ''}
              onChange={(e) => setFormData({ ...formData, setor_solicitante: e.target.value })}
              placeholder="Digite seu setor (ex: RH, Financeiro, Recepção...)"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Tipo de Chamado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Chamado <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoChamado })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="Problema">Problema</option>
              <option value="Requisição">Requisição</option>
              <option value="Mudança">Mudança</option>
            </select>
          </div>

          {/* Tipo de Problema - Específico do Setor */}
          {formData.setor_destino_id && tiposProblemaDisponiveis.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <label className="block text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                🔧 Qual o tipo de problema ou solicitação? <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={tipoProblemaCompleto}
                onChange={(e) => handleTipoProblemaChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">Selecione o tipo...</option>
                {tiposProblemaDisponiveis.map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Escolha o tipo mais adequado ao seu problema ou solicitação
              </p>
            </div>
          )}

          {/* Categorização - APENAS para setor TI */}
          {tipoProblemaSelecionado && setores.find(s => s.id === formData.setor_destino_id)?.nome === 'TI' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoria {tipoProblemaSelecionado !== 'Outros' && <span className="text-red-500">*</span>}
                </label>
                <select
                  required={tipoProblemaSelecionado !== 'Outros'}
                  value={formData.categoria_id || ''}
                  onChange={(e) => handleCategoriaChange(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Selecione a categoria...</option>
                  {categorias
                    .filter(cat => cat.tipo === 'categoria' && cat.tipo_problema === tipoProblemaSelecionado)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subcategoria {tipoProblemaSelecionado === 'Outros' && <span className="text-red-500">*</span>}
                </label>
                <select
                  required={tipoProblemaSelecionado === 'Outros'}
                  value={formData.subcategoria_id || ''}
                  onChange={(e) => handleSubcategoriaChange(parseInt(e.target.value))}
                  disabled={!subcategorias.length}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-500"
                >
                  <option value="">Selecione...</option>
                  {subcategorias.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item {tipoProblemaSelecionado !== 'Outros' && <span className="text-red-500">*</span>}
                </label>
                <select
                  required={tipoProblemaSelecionado !== 'Outros'}
                  value={formData.item_id || ''}
                  onChange={(e) => {
                    const itemId = parseInt(e.target.value);
                    setFormData({ ...formData, item_id: itemId });
                    
                    // Verificar se o item tem prioridade automática
                    const item = itens.find(i => i.id === itemId);
                    if (item?.prioridade_automatica) {
                      setPrioridadeAutomatica(item.prioridade_automatica);
                    } else {
                      // Se não tem no item, manter da subcategoria ou categoria
                      const subcategoria = subcategorias.find(c => c.id === formData.subcategoria_id);
                      const categoria = categorias.find(c => c.id === formData.categoria_id);
                      setPrioridadeAutomatica(subcategoria?.prioridade_automatica || categoria?.prioridade_automatica || null);
                    }
                  }}
                  disabled={!itens.length}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-500"
                >
                  <option value="">Selecione o item...</option>
                  {itens.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Título - Complementar (se não escolheu tipo do setor, OU não é TI, OU escolheu "Outros" no TI) */}
          {(!formData.setor_destino_id || tiposProblemaDisponiveis.length === 0 || (tipoProblemaSelecionado === 'Outros' && setores.find(s => s.id === formData.setor_destino_id)?.nome === 'TI') || (tipoProblemaSelecionado && setores.find(s => s.id === formData.setor_destino_id)?.nome !== 'TI')) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Resumo do problema ou solicitação"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descrição <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva detalhadamente o problema ou solicitação"
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Impacto e Urgência */}
          {prioridadeAutomatica ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                🎯 Prioridade Automática: {prioridadeAutomatica}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Esta categoria possui prioridade fixa definida pelo sistema. Os campos de impacto e urgência não se aplicam.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Impacto</label>
                <select
                  value={formData.impacto || ''}
                  onChange={(e) => setFormData({ ...formData, impacto: e.target.value as Impacto })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="Baixo">Baixo</option>
                  <option value="Médio">Médio</option>
                  <option value="Alto">Alto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Urgência</label>
                <select
                  value={formData.urgencia || ''}
                  onChange={(e) => setFormData({ ...formData, urgencia: e.target.value as Urgencia })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            </div>
          )}

          {/* Afeta Paciente - Para Manutenção, Hotelaria e Rouparia */}
          {['Manutenção', 'Hotelaria', 'Rouparia'].includes(setores.find(s => s.id === formData.setor_destino_id)?.nome || '') && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
              <label className="block text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
                🏥 Este problema afeta ou pode afetar os pacientes? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="afeta_paciente"
                    value="true"
                    checked={formData.afeta_paciente === true}
                    onChange={() => setFormData({ ...formData, afeta_paciente: true })}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sim, afeta pacientes (SLA: 4 horas)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="afeta_paciente"
                    value="false"
                    checked={formData.afeta_paciente === false}
                    onChange={() => setFormData({ ...formData, afeta_paciente: false })}
                    className="w-4 h-4 text-gray-600 focus:ring-gray-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Não afeta pacientes (SLA: 6 horas)</span>
                </label>
              </div>
              <p className="text-xs text-red-700 dark:text-red-400 mt-2">
                ⚠️ Problemas que afetam pacientes têm prioridade máxima e prazo reduzido
              </p>
            </div>
          )}

          {/* Informações adicionais */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unidade</label>
            <select
              value={formData.unidade_id || ''}
              onChange={(e) => setFormData({ ...formData, unidade_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Selecione...</option>
              {unidades.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ambiente / Equipamento</label>
            <input
              type="text"
              value={formData.ambiente || ''}
              onChange={(e) => setFormData({ ...formData, ambiente: e.target.value })}
              placeholder="Ex: Computador 123, Sala 456, Sistema XYZ"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Passos para Reproduzir</label>
            <textarea
              value={formData.passos_reproduzir || ''}
              onChange={(e) => setFormData({ ...formData, passos_reproduzir: e.target.value })}
              placeholder="Como reproduzir o problema (opcional)"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Anexos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Anexos (Imagens, Documentos, etc.)
            </label>
            
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleArquivosSelecionados}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="text-gray-400 dark:text-gray-500" size={32} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Clique para selecionar arquivos ou arraste aqui
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, PDF, DOC, XLS (máx. 10MB cada)
                </span>
              </label>
            </div>

            {/* Lista de arquivos selecionados */}
            {arquivos.length > 0 && (
              <div className="mt-4 space-y-2">
                {arquivos.map((arquivo, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    {arquivo.preview && (
                      <img
                        src={arquivo.preview}
                        alt={arquivo.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    {!arquivo.preview && (
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                        <Paperclip size={20} className="text-gray-500 dark:text-gray-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {arquivo.file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatarTamanho(arquivo.file.size)}
                        {arquivo.uploading && ' • Enviando...'}
                        {arquivo.uploaded && ' • ✓ Enviado'}
                        {arquivo.error && ` • ✗ ${arquivo.error}`}
                      </p>
                    </div>

                    {!arquivo.uploading && !loading && (
                      <button
                        type="button"
                        onClick={() => removerArquivo(index)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Criando..." : "Criar Chamado"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Avaliações Pendentes */}
      {mostrarModalAvaliacoes && avaliacoesPendentes.length > 0 && (
        <ModalAvaliacoesPendentes
          chamados={avaliacoesPendentes}
          onClose={() => setMostrarModalAvaliacoes(false)}
          onAvaliar={handleAvaliar}
        />
      )}
    </Layout>
  );
}
