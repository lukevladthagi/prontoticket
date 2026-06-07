"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ModalContrato from "@/components/ModalContrato";
import { FileText, AlertTriangle, Calendar, Plus } from "lucide-react";
import type { Contrato } from "@/shared/types";

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratosVencendo, setContratosVencendo] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);

  useEffect(() => {
    fetchContratos();
    fetchContratosVencendo();
  }, []);

  const fetchContratos = async () => {
    try {
      const response = await fetch("/api/contratos");
      if (response.ok) {
        const data = await response.json();
        setContratos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar contratos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContratosVencendo = async () => {
    try {
      const response = await fetch("/api/contratos/vencendo");
      if (response.ok) {
        const data = await response.json();
        setContratosVencendo(data);
      }
    } catch (error) {
      console.error("Erro ao buscar contratos vencendo:", error);
    }
  };

  const handleNovoClick = () => {
    setContratoSelecionado(null);
    setModalAberto(true);
  };

  const handleEditClick = (contrato: Contrato) => {
    setContratoSelecionado(contrato);
    setModalAberto(true);
  };

  const handleModalClose = () => {
    setModalAberto(false);
    setContratoSelecionado(null);
  };

  const handleModalSave = () => {
    fetchContratos();
    fetchContratosVencendo();
    handleModalClose();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contratos</h1>
          <button
            onClick={handleNovoClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={20} />
            Novo Contrato
          </button>
        </div>

        {/* Alertas de Vencimento */}
        {contratosVencendo.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24} />
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300">
                Contratos Próximos do Vencimento
              </h2>
            </div>
            <div className="space-y-2">
              {contratosVencendo.map((contrato) => (
                <div key={contrato.id} className="text-sm text-yellow-800 dark:text-yellow-300">
                  • {contrato.descricao || `Contrato ${contrato.numero_contrato}`} - Vence em {new Date(contrato.data_fim).toLocaleDateString('pt-BR')}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : contratos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <FileText className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum contrato cadastrado</h3>
            <p className="text-gray-600 dark:text-gray-400">Os contratos com fornecedores aparecerão aqui</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Número
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Vigência
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {contratos.map((contrato) => (
                    <tr 
                      key={contrato.id} 
                      onClick={() => handleEditClick(contrato)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {contrato.numero_contrato}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {contrato.descricao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(contrato.data_inicio).toLocaleDateString('pt-BR')} até {new Date(contrato.data_fim).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {contrato.valor ? `R$ ${contrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modalAberto && (
          <ModalContrato
            contrato={contratoSelecionado}
            onClose={handleModalClose}
            onSave={handleModalSave}
          />
        )}
      </div>
    </Layout>
  );
}
