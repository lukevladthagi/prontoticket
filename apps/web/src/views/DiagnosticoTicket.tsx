"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DiagnosticoTicket() {
  const [numero, setNumero] = useState("");
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exemploTickets, setExemploTickets] = useState<any[]>([]);

  useEffect(() => {
    carregarExemplos();
  }, []);

  const carregarExemplos = async () => {
    try {
      const response = await fetch("/api/diagnostico-ticket");
      if (response.ok) {
        const data = await response.json();
        setExemploTickets(data.tickets || []);
      }
    } catch (err) {
      console.error("Erro ao carregar exemplos:", err);
    }
  };

  const buscarTicket = async () => {
    if (!numero.trim()) {
      setError("Digite um número de ticket");
      return;
    }

    setLoading(true);
    setError("");
    setDiagnostico(null);

    try {
      const response = await fetch(`/api/diagnostico-ticket/${numero}`);
      
      if (!response.ok) {
        throw new Error("Ticket não encontrado");
      }

      const data = await response.json();
      setDiagnostico(data);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Diagnóstico de Ticket
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Verificar campos de SLA pausado em ticket específico
        </p>
      </div>

      {/* Exemplos de tickets */}
      {exemploTickets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Tickets Recentes (20 últimos)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">ID</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Número</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">SLA Pausado</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {exemploTickets.map((ticket, idx) => (
                  <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{ticket.id}</td>
                    <td className="px-4 py-2 font-mono text-blue-600 dark:text-blue-400">
                      {ticket.numero}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{ticket.status}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      {ticket.sla_pausado_em ? "Sim" : "Não"}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white text-xs">
                      {ticket.sla_pausado_motivo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campo de busca */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Digite o número do ticket (ex: TKT-004025 ou 004025)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            onKeyPress={(e) => e.key === "Enter" && buscarTicket()}
          />
          <Button onClick={buscarTicket} disabled={loading}>
            <Search className="mr-2" size={18} />
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Resultado do diagnóstico */}
      {diagnostico && (
        <div className="space-y-6">
          {/* Informações básicas */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Informações Básicas
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Número:</span>
                <p className="font-semibold text-gray-900 dark:text-white">{diagnostico.numero}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <p className="font-semibold text-gray-900 dark:text-white">{diagnostico.status}</p>
              </div>
            </div>
          </div>

          {/* Campos SLA Pausado */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Campos SLA Pausado
            </h2>
            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  sla_pausado_em
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Valor:</span>
                    <p className="font-mono text-gray-900 dark:text-white">
                      {JSON.stringify(diagnostico.campos_sla_pausado.sla_pausado_em.valor)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
                    <p className="font-mono text-gray-900 dark:text-white">
                      {diagnostico.campos_sla_pausado.sla_pausado_em.tipo}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">is_null:</span>
                    <p className="font-mono text-gray-900 dark:text-white">
                      {String(diagnostico.campos_sla_pausado.sla_pausado_em.is_null)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">is_undefined:</span>
                    <p className="font-mono text-gray-900 dark:text-white">
                      {String(diagnostico.campos_sla_pausado.sla_pausado_em.is_undefined)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">is_empty_string:</span>
                    <p className="font-mono text-gray-900 dark:text-white">
                      {String(diagnostico.campos_sla_pausado.sla_pausado_em.is_empty_string)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">truthy:</span>
                    <p className={`font-mono ${
                      diagnostico.campos_sla_pausado.sla_pausado_em.truthy 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {String(diagnostico.campos_sla_pausado.sla_pausado_em.truthy)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  sla_pausado_motivo
                </h3>
                <div className="text-sm">
                  <p className="font-mono text-gray-900 dark:text-white">
                    {JSON.stringify(diagnostico.campos_sla_pausado.sla_pausado_motivo.valor)}
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  tempo_pausado_minutos
                </h3>
                <div className="text-sm">
                  <p className="font-mono text-gray-900 dark:text-white">
                    {JSON.stringify(diagnostico.campos_sla_pausado.tempo_pausado_minutos.valor)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Campos SLA */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Campos SLA
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">prazo_resposta:</span>
                <p className="font-mono text-gray-900 dark:text-white text-sm">
                  {JSON.stringify(diagnostico.campos_sla.prazo_resposta.valor)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">data_primeira_resposta:</span>
                <p className="font-mono text-gray-900 dark:text-white text-sm">
                  {JSON.stringify(diagnostico.campos_sla.data_primeira_resposta.valor)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">prazo_solucao:</span>
                <p className="font-mono text-gray-900 dark:text-white text-sm">
                  {JSON.stringify(diagnostico.campos_sla.prazo_solucao.valor)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">data_resolucao:</span>
                <p className="font-mono text-gray-900 dark:text-white text-sm">
                  {JSON.stringify(diagnostico.campos_sla.data_resolucao.valor)}
                </p>
              </div>
            </div>
          </div>

          {/* Objeto completo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Ticket Completo (JSON)
            </h2>
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(diagnostico.ticket_completo, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
