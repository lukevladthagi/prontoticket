"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertCircle, Wrench } from "lucide-react";
import { useUserProfile } from "../hooks/useUserProfile";

interface ManutencaoPreventiva {
  id: number;
  ativo_id: number;
  nome_equipamento: string;
  tipo_equipamento: string;
  patrimonio: string | null;
  modelo: string | null;
  local: string;
  periodicidade_dias: number;
  dias_aviso_antecipado: number;
  ultima_manutencao_data: string | null;
  proxima_manutencao_data: string;
  status: string;
  checklist: string | null;
  observacoes: string | null;
  unidade_nome: string | null;
  setor_nome: string | null;
  grupo_nome: string | null;
}

interface EventoCalendario {
  manutencao: ManutencaoPreventiva;
  data: Date;
}

export default function CalendarioManutencaoPage() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [manutencoes, setManutencoes] = useState<ManutencaoPreventiva[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [setorFiltro, setSetorFiltro] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [eventosSelecionados, setEventosSelecionados] = useState<EventoCalendario[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);

  useEffect(() => {
    if (profile && profile.perfil === 'solicitante') {
      navigate('/');
    } else {
      fetchManutencoes();
      fetchSetores();
    }
  }, [profile]);

  const fetchManutencoes = async () => {
    try {
      const response = await fetch('/api/manutencoes-preventivas');
      if (response.ok) {
        const data = await response.json();
        setManutencoes(data);
      }
    } catch (error) {
      console.error('Erro ao buscar manutenções:', error);
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

  const getDiasNoMes = (data: Date) => {
    const ano = data.getFullYear();
    const mes = data.getMonth();
    return new Date(ano, mes + 1, 0).getDate();
  };

  const getPrimeiroDiaSemana = (data: Date) => {
    const ano = data.getFullYear();
    const mes = data.getMonth();
    return new Date(ano, mes, 1).getDay();
  };

  const calcularOcorrencias = (manutencao: ManutencaoPreventiva, mesData: Date): Date[] => {
    const ocorrencias: Date[] = [];
    const proximaData = new Date(manutencao.proxima_manutencao_data);
    const ano = mesData.getFullYear();
    const mesNum = mesData.getMonth();
    
    // Se a próxima manutenção está neste mês, adiciona
    if (proximaData.getFullYear() === ano && proximaData.getMonth() === mesNum) {
      ocorrencias.push(proximaData);
    }
    
    // Calcula ocorrências futuras baseadas na periodicidade
    let dataAtual = new Date(proximaData);
    while (dataAtual.getFullYear() === ano && dataAtual.getMonth() === mesNum) {
      if (dataAtual.getDate() !== proximaData.getDate() || dataAtual.getTime() !== proximaData.getTime()) {
        ocorrencias.push(new Date(dataAtual));
      }
      dataAtual = new Date(dataAtual.getTime() + manutencao.periodicidade_dias * 24 * 60 * 60 * 1000);
    }
    
    return ocorrencias;
  };

  const manutencoesFiltradas = setorFiltro 
    ? manutencoes.filter(m => m.setor_nome === setorFiltro)
    : manutencoes;

  const getEventosParaDia = (dia: number): EventoCalendario[] => {
    const eventos: EventoCalendario[] = [];

    manutencoesFiltradas.forEach((manutencao) => {
      const ocorrencias = calcularOcorrencias(manutencao, mesAtual);
      ocorrencias.forEach((ocorrencia) => {
        if (ocorrencia.getDate() === dia) {
          eventos.push({ manutencao, data: ocorrencia });
        }
      });
    });

    return eventos;
  };

  const getCorStatus = (status: string) => {
    switch (status) {
      case 'Atrasado':
        return 'bg-red-100 text-red-700';
      case 'Próximo do vencimento':
        return 'bg-yellow-100 text-yellow-700';
      case 'Em dia':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const renderCalendario = () => {
    const diasNoMes = getDiasNoMes(mesAtual);
    const primeiroDia = getPrimeiroDiaSemana(mesAtual);
    const dias = [];

    // Dias vazios antes do primeiro dia
    for (let i = 0; i < primeiroDia; i++) {
      dias.push(
        <div key={`vazio-${i}`} className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 min-h-[100px]"></div>
      );
    }

    // Dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const eventos = getEventosParaDia(dia);
      const hoje = new Date();
      const ehHoje = 
        dia === hoje.getDate() && 
        mesAtual.getMonth() === hoje.getMonth() && 
        mesAtual.getFullYear() === hoje.getFullYear();

      dias.push(
        <div
          key={dia}
          onClick={() => {
            const dataSelecionada = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia);
            setDiaSelecionado(dataSelecionada);
            setEventosSelecionados(eventos);
          }}
          className={`border border-gray-200 dark:border-gray-600 p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
            ehHoje ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-600' : 'bg-white dark:bg-gray-800'
          }`}
        >
          <div className={`font-semibold text-sm mb-1 ${ehHoje ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
            {dia}
            {ehHoje && <span className="ml-1 text-xs">(Hoje)</span>}
          </div>
          <div className="space-y-1">
            {eventos.slice(0, 3).map((evento, idx) => (
              <div
                key={idx}
                className={`text-xs px-2 py-1 rounded truncate ${getCorStatus(evento.manutencao.status)}`}
                title={`${evento.manutencao.nome_equipamento} - ${evento.manutencao.local}`}
              >
                <Wrench className="inline-block mr-1" size={10} />
                {evento.manutencao.nome_equipamento}
              </div>
            ))}
            {eventos.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                +{eventos.length - 3} mais
              </div>
            )}
          </div>
        </div>
      );
    }

    return dias;
  };

  const proximoMes = () => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1));
    setDiaSelecionado(null);
    setEventosSelecionados([]);
  };

  const mesAnterior = () => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1));
    setDiaSelecionado(null);
    setEventosSelecionados([]);
  };

  const hoje = () => {
    setMesAtual(new Date());
    setDiaSelecionado(null);
    setEventosSelecionados([]);
  };

  const formatarMesAno = (data: Date) => {
    return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Calendar className="text-blue-600 dark:text-blue-400" size={36} />
              Calendário de Manutenção
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Visualize as manutenções preventivas programadas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Setor:</label>
              <select
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.nome}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => navigate('/cronograma-manutencao')}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
            >
              Gerenciar Cronograma
            </button>
          </div>
        </div>

        {/* Controles do Calendário */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={mesAnterior}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-900 dark:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                {formatarMesAno(mesAtual)}
              </h2>
              <button
                onClick={hoje}
                className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors font-medium"
              >
                Hoje
              </button>
            </div>

            <button
              onClick={proximoMes}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-900 dark:text-white"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Grid do Calendário */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
              <div key={dia} className="p-3 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm">
                {dia}
              </div>
            ))}
          </div>

          {/* Dias do mês */}
          <div className="grid grid-cols-7">
            {renderCalendario()}
          </div>
        </div>

        {/* Detalhes do Dia Selecionado */}
        {diaSelecionado && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="text-blue-600 dark:text-blue-400" size={20} />
              {diaSelecionado.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </h3>

            {eventosSelecionados.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertCircle className="mx-auto mb-2" size={32} />
                <p>Nenhuma manutenção preventiva programada para este dia</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventosSelecionados
                  .sort((a, b) => a.manutencao.nome_equipamento.localeCompare(b.manutencao.nome_equipamento))
                  .map((evento, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Wrench className="text-blue-600 dark:text-blue-400" size={18} />
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {evento.manutencao.nome_equipamento}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getCorStatus(evento.manutencao.status)}`}>
                              {evento.manutencao.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <div>
                              <span className="font-medium">Tipo:</span> {evento.manutencao.tipo_equipamento}
                            </div>
                            <div>
                              <span className="font-medium">Local:</span> {evento.manutencao.local}
                            </div>
                            {evento.manutencao.patrimonio && (
                              <div>
                                <span className="font-medium">Patrimônio:</span> {evento.manutencao.patrimonio}
                              </div>
                            )}
                            {evento.manutencao.unidade_nome && (
                              <div>
                                <span className="font-medium">Unidade:</span> {evento.manutencao.unidade_nome}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              Periodicidade: {evento.manutencao.periodicidade_dias} dias
                            </span>
                            {evento.manutencao.grupo_nome && (
                              <span>
                                Responsável: {evento.manutencao.grupo_nome}
                              </span>
                            )}
                          </div>

                          {evento.manutencao.observacoes && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Observações:</span> {evento.manutencao.observacoes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legenda</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-blue-50 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-600 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Dia atual</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-900 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Manutenção em dia</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Próximo do vencimento</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-100 dark:bg-red-900 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Manutenção atrasada</span>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Total de Equipamentos</div>
            <div className="text-3xl font-bold">{manutencoesFiltradas.length}</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Manutenções Este Mês</div>
            <div className="text-3xl font-bold">
              {manutencoesFiltradas.reduce((total, manut) => {
                return total + calcularOcorrencias(manut, mesAtual).length;
              }, 0)}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Próximas do Vencimento</div>
            <div className="text-3xl font-bold">
              {manutencoesFiltradas.filter(m => m.status === 'Próximo do vencimento').length}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
