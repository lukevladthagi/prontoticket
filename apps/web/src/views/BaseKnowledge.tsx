"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { BookOpen, Search, Eye, ThumbsUp, ThumbsDown, Plus, X, FileText, BookMarked, HelpCircle, ClipboardList, CheckSquare, Shield, BookOpenCheck, Paperclip, Upload, Printer, Download, Trash2, Edit } from "lucide-react";
import type { ArtigoKB, TipoDocumento } from "@/shared/types";
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

const iconesDocumento = {
  'Artigo': FileText,
  'Tutorial': BookMarked,
  'Guia': BookOpen,
  'FAQ': HelpCircle,
  'Procedimento': ClipboardList,
  'Checklist': CheckSquare,
  'Política': Shield,
  'Manual': BookOpenCheck,
};

const coresDocumento = {
  'Artigo': 'bg-blue-100 text-blue-700 border-blue-200',
  'Tutorial': 'bg-purple-100 text-purple-700 border-purple-200',
  'Guia': 'bg-green-100 text-green-700 border-green-200',
  'FAQ': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Procedimento': 'bg-orange-100 text-orange-700 border-orange-200',
  'Checklist': 'bg-pink-100 text-pink-700 border-pink-200',
  'Política': 'bg-red-100 text-red-700 border-red-200',
  'Manual': 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

interface Anexo {
  id: number;
  nome_arquivo: string;
  url: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  created_at: string;
}

interface ArquivoUpload {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  error?: string;
}

export default function BaseKnowledgePage() {
  const [artigos, setArtigos] = useState<ArtigoKB[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [artigoSelecionado, setArtigoSelecionado] = useState<ArtigoKB | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [novoArtigo, setNovoArtigo] = useState({
    titulo: '',
    conteudo: '',
    tipo_documento: 'Artigo' as TipoDocumento,
    palavras_chave: '',
  });

  useEffect(() => {
    // Verifica se usuário é do setor TI para permitir edição
    const verificarPermissao = async () => {
      try {
        const response = await fetch('/api/users/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          // Apenas TI (setor 1) pode criar/editar/excluir
          setPodeEditar(data.profile?.setor_id === 1);
        }
      } catch (error) {
        console.error('Erro ao verificar permissão:', error);
      }
    };
    verificarPermissao();
  }, []);

  useEffect(() => {
    carregarArtigos();
  }, [busca]);

  const carregarArtigos = async () => {
    try {
      const response = await fetch('/api/artigos-kb', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setArtigos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar artigos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (artigo: ArtigoKB) => {
    setNovoArtigo({
      titulo: artigo.titulo,
      conteudo: artigo.conteudo,
      tipo_documento: artigo.tipo_documento,
      palavras_chave: artigo.palavras_chave || '',
    });
    setModoEdicao(true);
    setMostrarModal(true);
  };

  const handleExcluir = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/artigos-kb/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await carregarArtigos();
        setArtigoSelecionado(null);
        alert('Artigo excluído com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao excluir artigo:', error);
      alert('Erro ao excluir artigo');
    }
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artigoSelecionado) return;

    setSalvando(true);
    try {
      const response = await fetch(`/api/artigos-kb/${artigoSelecionado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(novoArtigo),
      });

      if (response.ok) {
        await carregarArtigos();
        const artigoAtualizado = await response.json();
        setArtigoSelecionado(artigoAtualizado);
        setMostrarModal(false);
        setModoEdicao(false);
        setNovoArtigo({
          titulo: '',
          conteudo: '',
          tipo_documento: 'Artigo',
          palavras_chave: '',
        });
        alert('Artigo atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar artigo:', error);
      alert('Erro ao atualizar artigo');
    } finally {
      setSalvando(false);
    }
  };

  const visualizarArtigo = async (id: number) => {
    try {
      const response = await fetch(`/api/artigos-kb/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setArtigoSelecionado(data);
        fetchAnexos(id);
      }
    } catch (error) {
      console.error("Erro ao carregar artigo:", error);
    }
  };

  const fetchAnexos = async (artigoId: number) => {
    try {
      const response = await fetch(`/api/artigos-kb/${artigoId}/anexos`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnexos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar anexos:", error);
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

  const handleCriarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se está em modo edição, chama função de editar
    if (modoEdicao) {
      return handleSalvarEdicao(e);
    }

    setSalvando(true);

    try {
      const response = await fetch('/api/artigos-kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(novoArtigo),
      });

      if (response.ok) {
        const artigo = await response.json();

        // Upload de arquivos se houver
        if (arquivos.length > 0) {
          for (let i = 0; i < arquivos.length; i++) {
            const arquivo = arquivos[i];
            setArquivos((prev) => {
              const updated = [...prev];
              updated[i].uploading = true;
              return updated;
            });

            try {
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

              await fetch(`/api/artigos-kb/${artigo.id}/anexos`, {
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

        setMostrarModal(false);
        setNovoArtigo({
          titulo: '',
          conteudo: '',
          tipo_documento: 'Artigo',
          palavras_chave: '',
        });
        setArquivos([]);
        carregarArtigos();
        visualizarArtigo(artigo.id);
        alert('Artigo criado com sucesso!');
      } else {
        alert('Erro ao criar artigo. Tente novamente.');
      }
    } catch (error) {
      console.error("Erro ao criar artigo:", error);
      alert('Erro ao criar artigo. Verifique sua conexão.');
    } finally {
      setSalvando(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const deletarAnexo = async (anexoId: number) => {
    if (!artigoSelecionado) return;
    
    if (!confirm('Deseja realmente excluir este anexo?')) return;

    try {
      const response = await fetch(`/api/artigos-kb/${artigoSelecionado.id}/anexos/${anexoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchAnexos(artigoSelecionado.id);
      }
    } catch (error) {
      console.error('Erro ao deletar anexo:', error);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Base de Conhecimento</h1>
          {podeEditar && (
            <button
              onClick={() => setMostrarModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Novo Documento
            </button>
          )}
        </div>

        {/* Busca */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm print:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar artigos por título, conteúdo ou palavras-chave..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Artigos */}
          <div className="lg:col-span-1 print:hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-white">Documentos ({artigos.length})</h2>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                </div>
              ) : artigos.length === 0 ? (
                <div className="p-8 text-center">
                  <BookOpen className="mx-auto text-gray-400 dark:text-gray-500 mb-3" size={32} />
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Nenhum documento encontrado</p>
                  {podeEditar && (
                    <button
                      onClick={() => setMostrarModal(true)}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-500 font-medium"
                    >
                      Criar primeiro documento
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                  {artigos.map((artigo) => {
                    const Icone = iconesDocumento[artigo.tipo_documento] || FileText;
                    return (
                      <button
                        key={artigo.id}
                        onClick={() => visualizarArtigo(artigo.id)}
                        className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          artigoSelecionado?.id === artigo.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icone size={20} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">{artigo.titulo}</h3>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${coresDocumento[artigo.tipo_documento]}`}>
                                {artigo.tipo_documento}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Eye size={12} />
                                {artigo.visualizacoes}
                              </span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp size={12} />
                                {artigo.util_sim}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo do Artigo */}
          <div className="lg:col-span-2">
            {artigoSelecionado ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-start justify-between mb-4 print:mb-8">
                  <div className="flex items-start gap-3 flex-1">
                    {(() => {
                      const Icone = iconesDocumento[artigoSelecionado.tipo_documento] || FileText;
                      return <Icone size={32} className="text-indigo-600 dark:text-indigo-400 mt-1" />;
                    })()}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${coresDocumento[artigoSelecionado.tipo_documento]}`}>
                          {artigoSelecionado.tipo_documento}
                        </span>
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{artigoSelecionado.titulo}</h1>
                    </div>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    {podeEditar && (
                      <>
                        <button
                          onClick={() => handleEditar(artigoSelecionado)}
                          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Edit size={16} />
                          Editar
                        </button>
                        <button
                          onClick={() => handleExcluir(artigoSelecionado.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm border border-red-300 dark:border-red-600 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={16} />
                          Excluir
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleImprimir}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Printer size={16} />
                      Imprimir
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 print:text-xs">
                  <span className="flex items-center gap-1">
                    <Eye size={14} />
                    {artigoSelecionado.visualizacoes} visualizações
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={14} />
                    {artigoSelecionado.util_sim} úteis
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown size={14} />
                    {artigoSelecionado.util_nao} não úteis
                  </span>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {artigoSelecionado.conteudo}
                  </ReactMarkdown>
                </div>

                {/* Anexos */}
                {anexos.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Paperclip size={16} />
                      Anexos ({anexos.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {anexos.map((anexo) => {
                        return (
                        <div
                          key={anexo.id}
                          className="relative flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group"
                        >
                          <a
                            href={anexo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir ${anexo.nome_arquivo} em nova aba`}
                            className="absolute inset-0 rounded-lg"
                          />
                          
                          {anexo.tipo_arquivo?.startsWith('image/') ? (
                            <img
                              src={anexo.url}
                              alt={anexo.nome_arquivo}
                              className="w-12 h-12 object-cover rounded pointer-events-none"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center pointer-events-none">
                              <Paperclip size={20} className="text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0 pointer-events-none">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {anexo.nome_arquivo}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {anexo.tamanho ? formatarTamanho(anexo.tamanho) : 'Tamanho desconhecido'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 print:hidden relative z-10">
                            {podeEditar && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deletarAnexo(anexo.id);
                                }}
                                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            <Download size={16} className="text-indigo-500 dark:text-indigo-400 pointer-events-none" />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {artigoSelecionado.palavras_chave && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Palavras-chave:</p>
                    <div className="flex flex-wrap gap-2">
                      {artigoSelecionado.palavras_chave.split(',').map((palavra, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs"
                        >
                          {palavra.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
                <BookOpen className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Selecione um documento
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Clique em um documento da lista ao lado para visualizar seu conteúdo
                </p>
                {podeEditar && (
                  <button
                    onClick={() => setMostrarModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    <Plus size={16} />
                    Criar Novo Documento
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Criação */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {modoEdicao ? 'Editar Documento' : 'Criar Novo Documento'}
              </h2>
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setModoEdicao(false);
                  setArquivos([]);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-900 dark:text-white" />
              </button>
            </div>

            <form onSubmit={handleCriarArtigo} className="p-6 space-y-6">
              {/* Tipo de Documento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tipo de Documento <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.keys(iconesDocumento) as TipoDocumento[]).map((tipo) => {
                    const Icone = iconesDocumento[tipo];
                    const isSelected = novoArtigo.tipo_documento === tipo;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setNovoArtigo({ ...novoArtigo, tipo_documento: tipo })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <Icone size={24} className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'} />
                        <span className={`text-xs font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {tipo}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={novoArtigo.titulo}
                  onChange={(e) => setNovoArtigo({ ...novoArtigo, titulo: e.target.value })}
                  placeholder="Ex: Como configurar impressora de rede"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Conteúdo */}
              <div data-color-mode="auto">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conteúdo (Markdown) <span className="text-red-500">*</span>
                </label>
                <MDEditor
                  value={novoArtigo.conteudo}
                  onChange={(value) => setNovoArtigo({ ...novoArtigo, conteudo: value || '' })}
                  height={400}
                  preview="live"
                  hideToolbar={false}
                  enableScroll={true}
                  visibleDragbar={true}
                  highlightEnable={true}
                  previewOptions={{
                    remarkPlugins: [remarkGfm],
                    rehypePlugins: [rehypeRaw, rehypeSanitize],
                  }}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Suporta Markdown: títulos (#), listas (- ou 1.), código (`código` ou ```), links, tabelas, etc.
                </p>
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
                      Clique para selecionar arquivos
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      PNG, JPG, PDF, DOC, XLS (máx. 10MB cada)
                    </span>
                  </label>
                </div>

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

                        {!arquivo.uploading && !salvando && (
                          <button
                            type="button"
                            onClick={() => removerArquivo(index)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Palavras-chave */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Palavras-chave (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={novoArtigo.palavras_chave}
                  onChange={(e) => setNovoArtigo({ ...novoArtigo, palavras_chave: e.target.value })}
                  placeholder="impressora, rede, configuração, windows"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModal(false);
                    setModoEdicao(false);
                    setArquivos([]);
                  }}
                  disabled={salvando}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando...' : modoEdicao ? 'Atualizar Documento' : 'Criar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .prose, .prose * {
            visibility: visible;
          }
          .prose {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </Layout>
  );
}
