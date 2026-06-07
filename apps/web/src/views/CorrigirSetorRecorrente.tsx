"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface ChamadoRecorrente {
  id: number;
  titulo: string;
  descricao: string;
  tipo: string;
  frequencia: string;
  solicitante_setor: string | null;
  ativo: number;
  created_at: string;
  chamados_gerados?: number;
}

interface Atualizacao {
  id: number;
  setor: string;
}

interface ChamadoIndividual {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  origem: string;
  origem_recorrente_id: number | null;
  data_abertura: string;
}

export default function CorrigirSetorRecorrente() {
  const [abaAtiva, setAbaAtiva] = useState<"templates" | "chamados">("chamados");
  const [recorrentes, setRecorrentes] = useState<ChamadoRecorrente[]>([]);
  const [chamados, setChamados] = useState<ChamadoIndividual[]>([]);
  const [loading, setLoading] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [setoresSelecionados, setSetoresSelecionados] = useState<Record<number, string>>({});
  const [corrigirChamadosGerados, setCorrigirChamadosGerados] = useState(true);
  const [setorPadrao, setSetorPadrao] = useState("");

  const setoresDisponiveis = [
    "TI",
    "RH",
    "Financeiro",
    "Marketing",
    "Comercial",
    "Compras",
    "Manutenção",
    "Hotelaria",
    "Rouparia",
    "Call Center",
    "Central de navegação",
  ];

  const carregarRecorrentes = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/fix-setor-recorrente/diagnostico");
      const data = await response.json();

      if (response.ok) {
        setRecorrentes(data.recorrentes || []);
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao carregar dados" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const carregarChamados = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/fix-setor-recorrente/chamados-sem-setor");
      const data = await response.json();

      if (response.ok) {
        setChamados(data.chamados || []);
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao carregar dados" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSetorChange = (id: number, setor: string) => {
    setSetoresSelecionados((prev) => ({
      ...prev,
      [id]: setor,
    }));
  };

  const corrigirLote = async () => {
    if (Object.keys(setoresSelecionados).length === 0) {
      setMessage({ type: "error", text: "Selecione ao menos um setor para corrigir" });
      return;
    }

    setCorrigindo(true);
    setMessage(null);

    try {
      const atualizacoes: Atualizacao[] = Object.entries(setoresSelecionados).map(([id, setor]) => ({
        id: parseInt(id),
        setor,
      }));

      const response = await fetch("/api/fix-setor-recorrente/corrigir-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          atualizacoes,
          corrigir_chamados_gerados: corrigirChamadosGerados
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: "success", 
          text: data.chamados_atualizados 
            ? `${data.message}. ${data.chamados_atualizados} chamado(s) gerado(s) também foram atualizados.`
            : data.message
        });
        setSetoresSelecionados({});
        carregarRecorrentes();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao corrigir" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setCorrigindo(false);
    }
  };

  const corrigirChamadosEmLote = async () => {
    if (!setorPadrao) {
      setMessage({ type: "error", text: "Selecione um setor padrão" });
      return;
    }

    setCorrigindo(true);
    setMessage(null);

    try {
      const response = await fetch("/api/fix-setor-recorrente/corrigir-chamados-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setor_padrao: setorPadrao }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message });
        setSetorPadrao("");
        carregarChamados();
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao corrigir" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setCorrigindo(false);
    }
  };

  useEffect(() => {
    if (abaAtiva === "templates") {
      carregarRecorrentes();
    } else {
      carregarChamados();
    }
  }, [abaAtiva]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Corrigir Setor Solicitante</h1>
          <p className="text-muted-foreground mt-2">
            Atribua o setor solicitante para chamados que ainda não possuem essa informação
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setAbaAtiva("chamados")}
            className={`px-4 py-2 font-medium transition-colors ${
              abaAtiva === "chamados"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Chamados Individuais ({chamados.length})
          </button>
          <button
            onClick={() => setAbaAtiva("templates")}
            className={`px-4 py-2 font-medium transition-colors ${
              abaAtiva === "templates"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Templates Recorrentes ({recorrentes.length})
          </button>
        </div>

        {/* Aba Chamados Individuais */}
        {abaAtiva === "chamados" && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button onClick={carregarChamados} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Atualizar
              </Button>

              <div className="flex items-center gap-2 flex-1">
                <select
                  className="border border-border rounded px-3 py-2 bg-background text-foreground"
                  value={setorPadrao}
                  onChange={(e) => setSetorPadrao(e.target.value)}
                >
                  <option value="">Selecione o setor...</option>
                  {setoresDisponiveis.map((setor) => (
                    <option key={setor} value={setor}>
                      {setor}
                    </option>
                  ))}
                </select>

                <Button onClick={corrigirChamadosEmLote} disabled={corrigindo || !setorPadrao}>
                  {corrigindo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Atribuir a Todos
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chamados.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">Tudo certo!</p>
                <p className="text-muted-foreground mt-2">Não há chamados sem setor solicitante</p>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 dark:text-blue-300 font-semibold">
                    {chamados.length} chamado{chamados.length !== 1 ? "s" : ""} sem setor solicitante
                  </p>
                  <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">
                    Selecione um setor padrão e clique em "Atribuir a Todos" para corrigir todos de uma vez
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Número</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Título</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Status</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Origem</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Data Abertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chamados.slice(0, 100).map((chamado) => (
                        <tr key={chamado.id} className="hover:bg-muted/50">
                          <td className="border border-border p-3 text-foreground font-mono">{chamado.numero}</td>
                          <td className="border border-border p-3 text-foreground">
                            <div className="max-w-md truncate">{chamado.titulo}</div>
                          </td>
                          <td className="border border-border p-3 text-foreground">{chamado.status}</td>
                          <td className="border border-border p-3 text-foreground">{chamado.origem}</td>
                          <td className="border border-border p-3 text-foreground">
                            {new Date(chamado.data_abertura).toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {chamados.length > 100 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Mostrando os primeiros 100 de {chamados.length} chamados
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Aba Templates Recorrentes */}
        {abaAtiva === "templates" && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button onClick={carregarRecorrentes} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Atualizar
              </Button>

              <Button onClick={corrigirLote} disabled={corrigindo || Object.keys(setoresSelecionados).length === 0}>
                {corrigindo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Alterações ({Object.keys(setoresSelecionados).length})
              </Button>

              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={corrigirChamadosGerados}
                  onChange={(e) => setCorrigirChamadosGerados(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Também corrigir chamados já gerados (incluindo fechados)</span>
              </label>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recorrentes.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">Tudo certo!</p>
                <p className="text-muted-foreground mt-2">
                  Não há chamados recorrentes sem setor solicitante
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 dark:text-blue-300 font-semibold">
                    {recorrentes.length} chamado{recorrentes.length !== 1 ? "s" : ""} recorrente
                    {recorrentes.length !== 1 ? "s" : ""} sem setor solicitante
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border p-3 text-left text-foreground font-semibold">ID</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Título</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Tipo</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Frequência</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Chamados Gerados</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">Ativo</th>
                        <th className="border border-border p-3 text-left text-foreground font-semibold">
                          Setor Solicitante
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recorrentes.map((recorrente) => (
                        <tr key={recorrente.id} className="hover:bg-muted/50">
                          <td className="border border-border p-3 text-foreground">{recorrente.id}</td>
                          <td className="border border-border p-3 text-foreground">
                            <div className="max-w-xs">
                              <p className="font-medium">{recorrente.titulo}</p>
                              {recorrente.descricao && (
                                <p className="text-sm text-muted-foreground truncate">{recorrente.descricao}</p>
                              )}
                            </div>
                          </td>
                          <td className="border border-border p-3 text-foreground">{recorrente.tipo}</td>
                          <td className="border border-border p-3 text-foreground">{recorrente.frequencia}</td>
                          <td className="border border-border p-3 text-center text-foreground">
                            <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded text-sm font-semibold">
                              {recorrente.chamados_gerados || 0}
                            </span>
                          </td>
                          <td className="border border-border p-3 text-foreground">
                            {recorrente.ativo ? (
                              <span className="text-green-600 dark:text-green-400">Sim</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">Não</span>
                            )}
                          </td>
                          <td className="border border-border p-3">
                            <select
                              className="w-full border border-border rounded px-3 py-2 bg-background text-foreground"
                              value={setoresSelecionados[recorrente.id] || ""}
                              onChange={(e) => handleSetorChange(recorrente.id, e.target.value)}
                            >
                              <option value="">Selecione...</option>
                              {setoresDisponiveis.map((setor) => (
                                <option key={setor} value={setor}>
                                  {setor}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
