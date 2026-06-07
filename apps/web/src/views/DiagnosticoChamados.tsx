"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useUserProfile } from "@/hooks/useUserProfile";
import { AlertCircle } from "lucide-react";

interface DiagnosticoData {
  usuario: {
    id: string;
    email: string;
    perfil: string;
    setor_id: number | null;
  };
  filtro: {
    setor_id: string | null;
    whereClause: string;
  };
  setor_info: any;
  filas: any[];
  chamados_abertos: {
    total: number;
    chamados: any[];
  };
  chamados_em_atendimento: {
    total: number;
    chamados: any[];
  };
}

interface Setor {
  id: number;
  nome: string;
}

export default function DiagnosticoChamadosPage() {
  const { profile } = useUserProfile();
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [setorFiltro, setSetorFiltro] = useState<string>('');
  const [setores, setSetores] = useState<Setor[]>([]);

  useEffect(() => {
    fetchSetores();
  }, []);

  const fetchSetores = async () => {
    try {
      const response = await fetch("/api/setores", {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const setoresFiltrados = data.filter((s: any) => s.ativo && s.atende_ticket);
        setSetores(setoresFiltrados);
      }
    } catch (error) {
      console.error("Erro ao buscar setores:", error);
    }
  };

  const fetchDiagnostico = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (setorFiltro) params.append('setor_id', setorFiltro);
      
      const url = `/api/diagnostico-chamados?${params.toString()}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDiagnostico(data);
      } else {
        const error = await response.json();
        alert(error.error || "Erro ao buscar diagnóstico");
      }
    } catch (error) {
      console.error("Erro ao buscar diagnóstico:", error);
      alert("Erro ao buscar diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Diagnóstico de Chamados do Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Esta página mostra exatamente quais chamados o dashboard está contando
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Setor
              </label>
              <select
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos os Setores</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchDiagnostico}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Carregando..." : "Buscar"}
            </button>
          </div>
        </div>

        {diagnostico && (
          <div className="space-y-6">
            {/* Informações do Usuário */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Informações do Usuário
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{diagnostico.usuario.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Perfil</p>
                  <p className="font-medium text-gray-900 dark:text-white">{diagnostico.usuario.perfil}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Setor ID</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {diagnostico.usuario.setor_id || "Nenhum"}
                  </p>
                </div>
              </div>
            </div>

            {/* Filtros Aplicados */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Filtros Aplicados
              </h2>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded font-mono text-sm">
                {diagnostico.filtro.whereClause}
              </div>
            </div>

            {/* Setor e Filas */}
            {diagnostico.setor_info && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Informações do Setor
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Setor</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {diagnostico.setor_info.nome} (ID: {diagnostico.setor_info.id})
                    </p>
                  </div>
                  {diagnostico.filas.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Filas</p>
                      <div className="space-y-2">
                        {diagnostico.filas.map((fila: any) => (
                          <div key={fila.id} className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {fila.nome} (ID: {fila.id})
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Tipo: {fila.tipo} | Ativo: {fila.ativo ? 'Sim' : 'Não'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chamados Abertos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Chamados Abertos ({diagnostico.chamados_abertos.total})
              </h2>
              {diagnostico.chamados_abertos.chamados.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">Nenhum chamado aberto encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Ticket
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Título
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Prioridade
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Setor ID
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Fila ID
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {diagnostico.chamados_abertos.chamados.map((chamado: any) => (
                        <tr key={chamado.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.numero_ticket}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.titulo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.status}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.prioridade}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.setor_destino_id || 'NULL'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.fila_id || 'NULL'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Chamados Em Atendimento */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Chamados Em Atendimento ({diagnostico.chamados_em_atendimento.total})
              </h2>
              {diagnostico.chamados_em_atendimento.chamados.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">Nenhum chamado em atendimento encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Ticket
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Título
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Prioridade
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Setor ID
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Fila ID
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {diagnostico.chamados_em_atendimento.chamados.map((chamado: any) => (
                        <tr key={chamado.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.numero_ticket}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.titulo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.status}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.prioridade}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.setor_destino_id || 'NULL'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {chamado.fila_id || 'NULL'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
