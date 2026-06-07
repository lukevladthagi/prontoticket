"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Package, Plus, FileDown, AlertTriangle } from "lucide-react";
import type { Ativo } from "@/shared/types";
import ModalAtivo from "@/components/ModalAtivo";

export default function AtivosPage() {
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'alugados' | 'patrimonio'>('alugados');
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [modalAberto, setModalAberto] = useState(false);
  const [ativoSelecionado, setAtivoSelecionado] = useState<Ativo | null>(null);

  useEffect(() => {
    fetchAtivos();
  }, [abaAtiva, filtroStatus]);

  const fetchAtivos = async () => {
    try {
      const params = new URLSearchParams();
      params.append("tipo_propriedade", abaAtiva === 'alugados' ? 'Alugado' : 'Patrimônio');
      if (filtroStatus) params.append("status", filtroStatus);

      const response = await fetch(`/api/ativos?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAtivos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar ativos:", error);
    } finally {
      setLoading(false);
    }
  };

  const verificarVencimento = (dataRetirada?: string | null, status?: string | null) => {
    // Não marca como vencido se não tem data de retirada ou se o item já foi devolvido
    if (!dataRetirada || status === 'Devolvido' || status === 'Disponível') return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const retirada = new Date(dataRetirada);
    retirada.setHours(0, 0, 0, 0);
    return retirada < hoje ? 'vencido' : null;
  };

  const getStatusColor = (status: string, tipoPropriedade: string, vencido: boolean): string => {
    // Se está vencido, sempre vermelho
    if (vencido) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }

    // Cores específicas por tipo de propriedade
    if (tipoPropriedade === 'Alugado') {
      const coresAlugados: Record<string, string> = {
        'Em uso': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Com defeito': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        'Em manutenção': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        'Aguardando retirada ou devolução': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        'Devolvido': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Disponível': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      };
      return coresAlugados[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    } else {
      const coresPatrimonio: Record<string, string> = {
        'Em uso': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Disponível': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Com defeito': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Em manutenção': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        'Baixado ou descarte': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
      };
      return coresPatrimonio[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatarData = (data?: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const handleNovoClick = () => {
    setAtivoSelecionado(null);
    setModalAberto(true);
  };

  const handleEditClick = (ativo: Ativo) => {
    setAtivoSelecionado(ativo);
    setModalAberto(true);
  };

  const handleModalClose = () => {
    setModalAberto(false);
    setAtivoSelecionado(null);
  };

  const handleModalSave = () => {
    fetchAtivos();
    handleModalClose();
  };

  const ativosVencidos = ativos.filter(a => verificarVencimento(a.data_retirada, a.status) === 'vencido');

  const gerarRelatorioPDF = () => {
    if (ativos.length === 0) {
      alert('Nenhum item para gerar relatório!');
      return;
    }

    const titulo = abaAtiva === 'alugados' ? 'Relatório de Itens Alugados' : 'Relatório de Patrimônio';
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titulo}</title><style>body{font-family:'Segoe UI',Arial;padding:30px;background:white}header{background:linear-gradient(90deg,#003d82 0%,#0052b3 100%);color:white;padding:20px;border-radius:8px;margin-bottom:30px;text-align:center}.title{margin:0;font-size:24px}.subtitle{margin:5px 0 0;font-size:13px;opacity:0.9}.date{color:#666;font-size:12px;margin-top:15px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#003d82;color:white;padding:12px;text-align:left;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}td{padding:10px;border-bottom:1px solid #ddd;font-size:12px}tr:nth-child(even){background:#f5f7fa}.atrasado{color:#e74c3c;font-weight:700}footer{margin-top:30px;padding-top:20px;border-top:1px solid #ddd;color:#666;font-size:11px;text-align:center}</style></head><body><header><h1 class="title">❤️ Hospital ProntoCardio</h1><p class="subtitle">${titulo}</p><div class="date">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div></header><table>`;

    if (abaAtiva === 'alugados') {
      html += `<tr><th>Código</th><th>Descrição</th><th>Série</th><th>Fornecedor</th><th>Localização</th><th>Responsável</th><th>Status</th><th>Solicitação</th><th>Retirada</th></tr>`;
      ativos.forEach(item => {
        const vencido = verificarVencimento(item.data_retirada, item.status) === 'vencido';
        const statusExibir = (item.status || '') + (vencido ? ' (ATRASADO)' : '');
        const classe = vencido ? ' class="atrasado"' : '';
        html += `<tr><td>${item.codigo_barras || '-'}</td><td>${item.descricao || '-'}</td><td>${item.numero_serie || '-'}</td><td>${item.fornecedor_nome || '-'}</td><td>${item.localizacao || '-'}</td><td>${item.responsavel_nome || '-'}</td><td${classe}>${statusExibir}</td><td>${formatarData(item.data_solicitacao)}</td><td>${formatarData(item.data_retirada)}</td></tr>`;
      });
    } else {
      html += `<tr><th>Código</th><th>Descrição</th><th>Série</th><th>Localização</th><th>Responsável</th><th>Status</th><th>Entrada</th></tr>`;
      ativos.forEach(item => {
        html += `<tr><td>${item.codigo_barras || '-'}</td><td>${item.descricao || '-'}</td><td>${item.numero_serie || '-'}</td><td>${item.localizacao || '-'}</td><td>${item.responsavel_nome || '-'}</td><td>${item.status || '-'}</td><td>${formatarData(item.data_aquisicao)}</td></tr>`;
      });
    }

    html += `</table><footer><p>© ${new Date().getFullYear()} Hospital ProntoCardio - Todos os direitos reservados | Sistema de Rastreamento de Itens</p></footer></body></html>`;
    const novaAba = window.open('', '_blank');
    if (novaAba) {
      novaAba.document.write(html);
      novaAba.document.close();
      setTimeout(() => novaAba.print(), 250);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📊 Rastreamento de Itens</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Controle centralizado de patrimônio e equipamentos alugados</p>
          </div>
          <button
            onClick={handleNovoClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={20} />
            Registrar Item
          </button>
        </div>

        {/* Abas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-b-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="flex">
            <button
              onClick={() => setAbaAtiva('alugados')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                abaAtiva === 'alugados'
                  ? 'bg-indigo-600 text-white border-b-4 border-indigo-700'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              🔄 Itens Alugados (180 dias)
            </button>
            <button
              onClick={() => setAbaAtiva('patrimonio')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                abaAtiva === 'patrimonio'
                  ? 'bg-indigo-600 text-white border-b-4 border-indigo-700'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              🏥 Patrimônio Próprio
            </button>
          </div>
        </div>

        {/* Alertas de Vencimento (apenas para Alugados) */}
        {abaAtiva === 'alugados' && ativosVencidos.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-bold text-red-700 dark:text-red-400 mb-1">
                  ⚠️ {ativosVencidos.length} Item(ns) com Prazo Vencido!
                </div>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {ativosVencidos.map(i => i.descricao || i.tipo).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Filtrar por Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Todos os Status</option>
                <option value="Em uso">Em uso</option>
                <option value="Disponível">Disponível</option>
                <option value="Com defeito">Com defeito</option>
                <option value="Em manutenção">Em manutenção</option>
                {abaAtiva === 'alugados' && <option value="Aguardando retirada ou devolução">Aguardando retirada ou devolução</option>}
                {abaAtiva === 'alugados' && <option value="Devolvido">Devolvido (ao fornecedor)</option>}
                {abaAtiva === 'patrimonio' && <option value="Baixado ou descarte">Baixado ou descarte</option>}
              </select>
            </div>
            <button
              onClick={gerarRelatorioPDF}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md"
            >
              <FileDown size={18} />
              Gerar PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : ativos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center shadow-sm">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum item encontrado</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filtroStatus ? "Tente ajustar os filtros de busca" : 
                abaAtiva === 'alugados' ? "Nenhum item alugado registrado" : "Nenhum item de patrimônio registrado"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ativos.map((ativo) => {
              const vencido = verificarVencimento(ativo.data_retirada, ativo.status) === 'vencido';
              return (
                <div
                  key={ativo.id}
                  onClick={() => handleEditClick(ativo)}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-l-4 shadow-md hover:shadow-lg transition-all cursor-pointer ${
                    vencido ? 'border-red-500' : 'border-indigo-600'
                  }`}
                >
                  {/* Header do Card */}
                  <div className="flex justify-between items-start mb-4 gap-3">
                    <div className="font-semibold text-lg text-indigo-600 dark:text-indigo-400 flex-1">
                      {ativo.descricao || ativo.tipo}
                    </div>
                    {ativo.status && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(ativo.status, ativo.tipo_propriedade || 'Patrimônio', vencido)}`}>
                        {ativo.status}
                      </span>
                    )}
                  </div>

                  {/* Aviso de Atraso */}
                  {vencido && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-500 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="text-red-600 dark:text-red-400" size={16} />
                        <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">
                          ⚠️ Devolução em Atraso
                        </span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                        Prazo de devolução vencido em {formatarData(ativo.data_retirada)}
                      </p>
                    </div>
                  )}

                  {/* Informações */}
                  <div className="space-y-2.5 text-sm border-b border-gray-200 dark:border-gray-700 pb-4 mb-2">
                    {ativo.codigo_barras && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Código:</span>
                        <span className="col-span-2 text-gray-900 dark:text-white font-medium">{ativo.codigo_barras}</span>
                      </div>
                    )}
                    {ativo.numero_serie && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Série:</span>
                        <span className="col-span-2 text-gray-900 dark:text-white font-medium">{ativo.numero_serie}</span>
                      </div>
                    )}
                    {abaAtiva === 'alugados' && ativo.fornecedor_nome && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Fornecedor:</span>
                        <span className="col-span-2 text-gray-900 dark:text-white font-medium">{ativo.fornecedor_nome}</span>
                      </div>
                    )}
                    {ativo.localizacao && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Localização:</span>
                        <span className="col-span-2 text-gray-900 dark:text-white font-medium">{ativo.localizacao}</span>
                      </div>
                    )}
                    {ativo.responsavel_nome && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Responsável:</span>
                        <span className="col-span-2 text-gray-900 dark:text-white font-medium">{ativo.responsavel_nome}</span>
                      </div>
                    )}
                    {abaAtiva === 'alugados' && ativo.data_solicitacao && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Solicitação:</span>
                          <span className="col-span-2 text-gray-900 dark:text-white font-medium">{formatarData(ativo.data_solicitacao)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase">Retirada:</span>
                          <span className={`col-span-2 font-bold ${vencido ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {formatarData(ativo.data_retirada)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Clique para editar
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {modalAberto && (
          <ModalAtivo
            ativo={ativoSelecionado}
            tipoPropriedade={abaAtiva === 'alugados' ? 'Alugado' : 'Patrimônio'}
            onClose={handleModalClose}
            onSave={handleModalSave}
          />
        )}
      </div>
    </Layout>
  );
}
