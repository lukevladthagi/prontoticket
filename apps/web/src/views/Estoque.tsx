"use client";

import { useState, useEffect } from "react";
import { Package, Plus, AlertTriangle, TrendingUp, Search } from "lucide-react";
import type { ItemEstoque, Setor } from "@/shared/types";
import ModalEstoque from "../components/ModalEstoque";
import Layout from "../components/Layout";

export default function Estoque() {
  const [items, setItems] = useState<ItemEstoque[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"todos" | "baixo">("todos");

  useEffect(() => {
    fetchItems();
    fetchSetores();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/estoque', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSetores = async () => {
    try {
      const response = await fetch('/api/setores', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSetores(data);
      }
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "todos" || 
                         (filter === "baixo" && item.quantidade_atual <= item.quantidade_minima);
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = items.filter(item => item.quantidade_atual <= item.quantidade_minima).length;
  const totalValue = items.reduce((sum, item) => sum + (item.quantidade_atual * (item.valor_unitario || 0)), 0);

  return (
    <Layout>
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Estoque</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Controle de materiais consumíveis</p>
        </div>
        <button
          onClick={() => {
            setSelectedItem(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          <Plus size={20} />
          Novo Item
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total de Itens</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{items.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />
            </div>
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Estoque Baixo</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{lowStockCount}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="text-green-600 dark:text-green-400" size={24} />
            </div>
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Valor Total</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("todos")}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                filter === "todos"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter("baixo")}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                filter === "baixo"
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Estoque Baixo
            </button>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Setor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor Unit.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Localização
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Carregando...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const setor = setores.find(s => s.id === item.setor_id);
                  const isBaixo = item.quantidade_atual <= item.quantidade_minima;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{item.nome}</div>
                          {item.descricao && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{item.descricao}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                        {item.codigo || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                        {setor?.nome || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isBaixo ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                            {item.quantidade_atual}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-sm">
                            {item.unidade_medida}
                          </span>
                          {isBaixo && (
                            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Mínimo: {item.quantidade_minima} {item.unidade_medida}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                        {item.valor_unitario
                          ? item.valor_unitario.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                        {item.localizacao || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setModalOpen(true);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-sm"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <ModalEstoque
          item={selectedItem}
          onClose={() => {
            setModalOpen(false);
            setSelectedItem(null);
          }}
          onSave={() => {
            setModalOpen(false);
            setSelectedItem(null);
            fetchItems();
          }}
        />
      )}
    </div>
    </Layout>
  );
}
