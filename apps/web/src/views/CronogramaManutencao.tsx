"use client";

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock, Filter, Plus } from 'lucide-react';
import Layout from '../components/Layout';

interface ManutencaoPreventiva {
  id: number;
  nome_equipamento: string;
  tipo_equipamento: string;
  patrimonio: string;
  modelo: string;
  numero_serie: string;
  local: string;
  setor_nome: string;
  unidade_nome: string;
  grupo_nome: string;
  periodicidade_dias: number;
  ultima_manutencao_data: string;
  proxima_manutencao_data: string;
  status: 'Em dia' | 'Próximo do vencimento' | 'Atrasado';
  observacoes: string;
  historico?: any[];
}

interface Filtros {
  status: string;
  setor_id: string;
  unidade_id: string;
  tipo_equipamento: string;
}

export default function CronogramaManutencao() {
  const [manutencoes, setManutencoes] = useState<ManutencaoPreventiva[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalRealizarAberto, setModalRealizarAberto] = useState(false);
  const [manutencaoSelecionada, setManutencaoSelecionada] = useState<ManutencaoPreventiva | null>(null);
  const [filtros, setFiltros] = useState<Filtros>({
    status: '',
    setor_id: '',
    unidade_id: '',
    tipo_equipamento: ''
  });

  useEffect(() => {
    carregarDados();
    carregarSetores();
    carregarUnidades();
    carregarGrupos();
  }, [filtros]);

  const carregarDados = async () => {
    try {
      const params = new URLSearchParams();
      if (filtros.status) params.append('status', filtros.status);
      if (filtros.setor_id) params.append('setor_id', filtros.setor_id);
      if (filtros.unidade_id) params.append('unidade_id', filtros.unidade_id);

      const response = await fetch(`/api/manutencoes-preventivas?${params}`);
      const data = await response.json();
      
      let filtered = data;
      if (filtros.tipo_equipamento) {
        filtered = data.filter((m: ManutencaoPreventiva) => 
          m.tipo_equipamento.toLowerCase().includes(filtros.tipo_equipamento.toLowerCase())
        );
      }
      
      setManutencoes(filtered);
    } catch (error) {
      console.error('Erro ao carregar manutenções:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarSetores = async () => {
    try {
      const response = await fetch('/api/setores');
      const data = await response.json();
      setSetores(data);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const carregarUnidades = async () => {
    try {
      const response = await fetch('/api/unidades');
      const data = await response.json();
      setUnidades(data);
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const carregarGrupos = async () => {
    try {
      const response = await fetch('/api/grupos');
      const data = await response.json();
      setGrupos(data);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  };

  const criarManutencao = async (data: any) => {
    try {
      const response = await fetch('/api/manutencoes-preventivas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Erro na resposta:', result);
        alert(`Erro ao criar manutenção: ${result.error || 'Erro desconhecido'}\n\nDetalhes: ${result.details || 'Nenhum detalhe disponível'}`);
        return;
      }
      
      setModalNovoAberto(false);
      carregarDados();
    } catch (error) {
      console.error('Erro ao criar manutenção:', error);
      alert('Erro ao criar manutenção. Verifique o console para mais detalhes.');
    }
  };

  const editarManutencao = async (id: number, data: any) => {
    try {
      const response = await fetch(`/api/manutencoes-preventivas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Erro na resposta:', result);
        alert(`Erro ao editar manutenção: ${result.error || 'Erro desconhecido'}\n\nDetalhes: ${result.details || 'Nenhum detalhe disponível'}`);
        return;
      }
      
      setModalEditarAberto(false);
      setManutencaoSelecionada(null);
      carregarDados();
    } catch (error) {
      console.error('Erro ao editar manutenção:', error);
      alert('Erro ao editar manutenção. Verifique o console para mais detalhes.');
    }
  };

  const registrarManutencao = async (data: any) => {
    try {
      await fetch(`/api/manutencoes-preventivas/${manutencaoSelecionada?.id}/realizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      setModalRealizarAberto(false);
      setManutencaoSelecionada(null);
      carregarDados();
    } catch (error) {
      console.error('Erro ao registrar manutenção:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em dia':
        return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'Próximo do vencimento':
        return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'Atrasado':
        return 'bg-red-500/20 text-red-700 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Em dia':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'Próximo do vencimento':
        return <Clock className="w-4 h-4" />;
      case 'Atrasado':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatarData = (data: string) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularDiasRestantes = (dataProxima: string) => {
    const hoje = new Date();
    const proxima = new Date(dataProxima);
    const diff = Math.floor((proxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return `${Math.abs(diff)} dias atrasado`;
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return `${diff} dias`;
  };

  const tiposEquipamento = Array.from(new Set(manutencoes.map(m => m.tipo_equipamento)));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cronograma de Manutenção Preventiva</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Controle e acompanhamento de manutenções preventivas</p>
          </div>
          <button
            onClick={() => setModalNovoAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Manutenção
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filtros</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                <option value="Em dia">Em dia</option>
                <option value="Próximo do vencimento">Próximo do vencimento</option>
                <option value="Atrasado">Atrasado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Setor</label>
              <select
                value={filtros.setor_id}
                onChange={(e) => setFiltros({ ...filtros, setor_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {setores.map(setor => (
                  <option key={setor.id} value={setor.id}>{setor.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade</label>
              <select
                value={filtros.unidade_id}
                onChange={(e) => setFiltros({ ...filtros, unidade_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todas</option>
                {unidades.map(unidade => (
                  <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Equipamento</label>
              <select
                value={filtros.tipo_equipamento}
                onChange={(e) => setFiltros({ ...filtros, tipo_equipamento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {tiposEquipamento.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{manutencoes.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Em dia</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {manutencoes.filter(m => m.status === 'Em dia').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Próximas</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {manutencoes.filter(m => m.status === 'Próximo do vencimento').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Atrasadas</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {manutencoes.filter(m => m.status === 'Atrasado').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Equipamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Patrimônio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Modelo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Local
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Última Manutenção
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Próxima Manutenção
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                ) : manutencoes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma manutenção preventiva cadastrada
                    </td>
                  </tr>
                ) : (
                  manutencoes.map((manutencao) => (
                    <tr key={manutencao.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{manutencao.nome_equipamento}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{manutencao.setor_nome}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{manutencao.tipo_equipamento}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{manutencao.patrimonio || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{manutencao.modelo || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-300">{manutencao.local}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{manutencao.unidade_nome}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                        {formatarData(manutencao.ultima_manutencao_data)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-300">{formatarData(manutencao.proxima_manutencao_data)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{calcularDiasRestantes(manutencao.proxima_manutencao_data)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(manutencao.status)}`}>
                          {getStatusIcon(manutencao.status)}
                          {manutencao.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setManutencaoSelecionada(manutencao);
                              setModalEditarAberto(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              setManutencaoSelecionada(manutencao);
                              setModalRealizarAberto(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Registrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Nova Manutenção */}
        {modalNovoAberto && (
          <ModalNovaManutencao
            setores={setores}
            unidades={unidades}
            grupos={grupos}
            onClose={() => setModalNovoAberto(false)}
            onSalvar={criarManutencao}
          />
        )}

        {/* Modal Editar Manutenção */}
        {modalEditarAberto && manutencaoSelecionada && (
          <ModalEditarManutencao
            manutencao={manutencaoSelecionada}
            unidades={unidades}
            grupos={grupos}
            onClose={() => {
              setModalEditarAberto(false);
              setManutencaoSelecionada(null);
            }}
            onSalvar={(data: any) => editarManutencao(manutencaoSelecionada.id, data)}
          />
        )}

        {/* Modal Registrar Manutenção */}
        {modalRealizarAberto && manutencaoSelecionada && (
          <ModalRegistrarManutencao
            manutencao={manutencaoSelecionada}
            onClose={() => {
              setModalRealizarAberto(false);
              setManutencaoSelecionada(null);
            }}
            onSalvar={registrarManutencao}
          />
        )}
      </div>
    </Layout>
  );
}

function ModalNovaManutencao({ setores, unidades, grupos, onClose, onSalvar }: any) {
  const [form, setForm] = useState({
    nome_equipamento: '',
    tipo_equipamento: '',
    patrimonio: '',
    modelo: '',
    numero_serie: '',
    local: '',
    unidade_id: '',
    setor_id: '',
    periodicidade_dias: '30',
    dias_aviso_antecipado: '7',
    ultima_manutencao_data: '',
    proxima_manutencao_data: '',
    responsavel_id: '',
    grupo_responsavel_id: '',
    checklist: '',
    observacoes: '',
    gerar_chamado_automatico: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar({
      ...form,
      periodicidade_dias: parseInt(form.periodicidade_dias),
      dias_aviso_antecipado: parseInt(form.dias_aviso_antecipado),
      unidade_id: form.unidade_id || null,
      setor_id: form.setor_id || null,
      grupo_responsavel_id: form.grupo_responsavel_id || null,
      responsavel_id: form.responsavel_id || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Nova Manutenção Preventiva</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Cadastre um equipamento no cronograma de manutenção</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informações do Equipamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Informações do Equipamento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Equipamento *
                </label>
                <input
                  type="text"
                  value={form.nome_equipamento}
                  onChange={(e) => setForm({ ...form, nome_equipamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Bomba de Infusão"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Equipamento *
                </label>
                <input
                  type="text"
                  value={form.tipo_equipamento}
                  onChange={(e) => setForm({ ...form, tipo_equipamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Equipamento Médico"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Patrimônio
                </label>
                <input
                  type="text"
                  value={form.patrimonio}
                  onChange={(e) => setForm({ ...form, patrimonio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 4026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Philips CM 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número de Série
                </label>
                <input
                  type="text"
                  value={form.numero_serie}
                  onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: SHC 4B903982"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Local
                </label>
                <input
                  type="text"
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: UTI 3 LEITO 1"
                />
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Localização</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unidade
                </label>
                <select
                  value={form.unidade_id}
                  onChange={(e) => setForm({ ...form, unidade_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {unidades.map((unidade: any) => (
                    <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Setor
                </label>
                <select
                  value={form.setor_id}
                  onChange={(e) => setForm({ ...form, setor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {setores.map((setor: any) => (
                    <option key={setor.id} value={setor.id}>{setor.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Configuração da Manutenção */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configuração da Manutenção</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Periodicidade (dias) *
                </label>
                <input
                  type="number"
                  value={form.periodicidade_dias}
                  onChange={(e) => setForm({ ...form, periodicidade_dias: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 30, 90, 180"
                  required
                  min="1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A cada quantos dias deve ser feita a manutenção</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Avisar com antecedência (dias)
                </label>
                <input
                  type="number"
                  value={form.dias_aviso_antecipado}
                  onChange={(e) => setForm({ ...form, dias_aviso_antecipado: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 7"
                  min="1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quantos dias antes avisar sobre a manutenção</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Última Manutenção
                </label>
                <input
                  type="date"
                  value={form.ultima_manutencao_data}
                  onChange={(e) => setForm({ ...form, ultima_manutencao_data: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Próxima Manutenção *
                </label>
                <input
                  type="date"
                  value={form.proxima_manutencao_data}
                  onChange={(e) => setForm({ ...form, proxima_manutencao_data: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Grupo Responsável
                </label>
                <select
                  value={form.grupo_responsavel_id}
                  onChange={(e) => setForm({ ...form, grupo_responsavel_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {grupos.map((grupo: any) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Checklist e Observações */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Checklist de Manutenção
              </label>
              <textarea
                value={form.checklist}
                onChange={(e) => setForm({ ...form, checklist: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Liste os itens que devem ser verificados durante a manutenção..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Observações
              </label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observações adicionais sobre o equipamento ou manutenção..."
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.gerar_chamado_automatico}
                  onChange={(e) => setForm({ ...form, gerar_chamado_automatico: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Gerar chamado automaticamente quando próximo do vencimento
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cadastrar Manutenção
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalEditarManutencao({ manutencao, unidades, grupos, onClose, onSalvar }: any) {
  const [form, setForm] = useState({
    nome_equipamento: manutencao.nome_equipamento || '',
    tipo_equipamento: manutencao.tipo_equipamento || '',
    patrimonio: manutencao.patrimonio || '',
    modelo: manutencao.modelo || '',
    numero_serie: manutencao.numero_serie || '',
    local: manutencao.local || '',
    unidade_id: manutencao.unidade_id || '',
    setor_id: manutencao.setor_id || '',
    periodicidade_dias: manutencao.periodicidade_dias?.toString() || '30',
    dias_aviso_antecipado: manutencao.dias_aviso_antecipado?.toString() || '7',
    proxima_manutencao_data: manutencao.proxima_manutencao_data?.split('T')[0] || '',
    grupo_responsavel_id: manutencao.grupo_responsavel_id || '',
    checklist: manutencao.checklist || '',
    observacoes: manutencao.observacoes || '',
    gerar_chamado_automatico: manutencao.gerar_chamado_automatico !== false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar({
      ...form,
      periodicidade_dias: parseInt(form.periodicidade_dias),
      dias_aviso_antecipado: parseInt(form.dias_aviso_antecipado),
      unidade_id: form.unidade_id || null,
      setor_id: form.setor_id || null,
      grupo_responsavel_id: form.grupo_responsavel_id || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Editar Manutenção Preventiva</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Atualize as informações do equipamento</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informações do Equipamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Informações do Equipamento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Equipamento *
                </label>
                <input
                  type="text"
                  value={form.nome_equipamento}
                  onChange={(e) => setForm({ ...form, nome_equipamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Equipamento *
                </label>
                <input
                  type="text"
                  value={form.tipo_equipamento}
                  onChange={(e) => setForm({ ...form, tipo_equipamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patrimônio
                </label>
                <input
                  type="text"
                  value={form.patrimonio}
                  onChange={(e) => setForm({ ...form, patrimonio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Localização</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade
                </label>
                <select
                  value={form.unidade_id}
                  onChange={(e) => setForm({ ...form, unidade_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {unidades.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local *
                </label>
                <input
                  type="text"
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Configuração da Manutenção */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configuração da Manutenção</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Periodicidade (dias) *
                </label>
                <input
                  type="number"
                  value={form.periodicidade_dias}
                  onChange={(e) => setForm({ ...form, periodicidade_dias: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avisar com antecedência (dias)
                </label>
                <input
                  type="number"
                  value={form.dias_aviso_antecipado}
                  onChange={(e) => setForm({ ...form, dias_aviso_antecipado: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Próxima Manutenção *
                </label>
                <input
                  type="date"
                  value={form.proxima_manutencao_data}
                  onChange={(e) => setForm({ ...form, proxima_manutencao_data: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grupo Responsável
                </label>
                <select
                  value={form.grupo_responsavel_id}
                  onChange={(e) => setForm({ ...form, grupo_responsavel_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {grupos.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Checklist e Observações */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Checklist de Manutenção
              </label>
              <textarea
                value={form.checklist}
                onChange={(e) => setForm({ ...form, checklist: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.gerar_chamado_automatico}
                  onChange={(e) => setForm({ ...form, gerar_chamado_automatico: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Gerar chamado automaticamente quando próximo do vencimento
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalRegistrarManutencao({ manutencao, onClose, onSalvar }: any) {
  const [form, setForm] = useState({
    data_execucao: new Date().toISOString().split('T')[0],
    checklist_completo: false,
    itens_checklist: '',
    observacoes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Registrar Manutenção Realizada</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{manutencao.nome_equipamento}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data de Execução *
            </label>
            <input
              type="date"
              value={form.data_execucao}
              onChange={(e) => setForm({ ...form, data_execucao: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.checklist_completo}
                onChange={(e) => setForm({ ...form, checklist_completo: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Checklist completo</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Itens do Checklist
            </label>
            <textarea
              value={form.itens_checklist}
              onChange={(e) => setForm({ ...form, itens_checklist: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descreva os itens verificados..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observações
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Observações adicionais..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Registrar Manutenção
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
