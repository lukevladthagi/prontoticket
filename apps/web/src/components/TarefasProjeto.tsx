"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import type { ProjetoTarefa } from "@/shared/types";

interface TarefasProjetoProps {
  projetoId: number;
}

export default function TarefasProjeto({ projetoId }: TarefasProjetoProps) {
  const [tarefas, setTarefas] = useState<ProjetoTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: "",
    duracao_horas: "",
    duracao_minutos: "",
  });
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    fetchTarefas();
  }, [projetoId]);

  const fetchTarefas = async () => {
    try {
      const response = await fetch(`/api/projetos/${projetoId}/tarefas`);
      if (response.ok) {
        const data = await response.json();
        setTarefas(data);
      }
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarefa = async () => {
    if (!novaTarefa.titulo.trim()) return;

    const horas = parseInt(novaTarefa.duracao_horas) || 0;
    const minutos = parseInt(novaTarefa.duracao_minutos) || 0;
    const duracaoTotalMinutos = horas * 60 + minutos;

    setAdicionando(true);
    try {
      const response = await fetch(`/api/projetos/${projetoId}/tarefas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: novaTarefa.titulo,
          duracao_minutos: duracaoTotalMinutos > 0 ? duracaoTotalMinutos : null,
          status: "A fazer",
          concluido: false,
        }),
      });

      if (response.ok) {
        setNovaTarefa({ titulo: "", duracao_horas: "", duracao_minutos: "" });
        fetchTarefas();
      }
    } catch (error) {
      console.error("Erro ao adicionar tarefa:", error);
    } finally {
      setAdicionando(false);
    }
  };

  const handleToggleConcluido = async (tarefa: ProjetoTarefa) => {
    try {
      const response = await fetch(
        `/api/projetos/${projetoId}/tarefas/${tarefa.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...tarefa,
            concluido: !tarefa.concluido,
            status: !tarefa.concluido ? "Concluído" : "A fazer",
          }),
        }
      );

      if (response.ok) {
        fetchTarefas();
      }
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
    }
  };

  const handleDeleteTarefa = async (tarefaId: number) => {
    if (!confirm("Deseja excluir esta tarefa?")) return;

    try {
      const response = await fetch(
        `/api/projetos/${projetoId}/tarefas/${tarefaId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        fetchTarefas();
      }
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
    }
  };

  const handleUpdateDuracao = async (tarefa: ProjetoTarefa, horas: number, minutos: number) => {
    const duracaoTotalMinutos = horas * 60 + minutos;
    
    try {
      const response = await fetch(
        `/api/projetos/${projetoId}/tarefas/${tarefa.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...tarefa,
            duracao_minutos: duracaoTotalMinutos > 0 ? duracaoTotalMinutos : null,
          }),
        }
      );

      if (response.ok) {
        fetchTarefas();
      }
    } catch (error) {
      console.error("Erro ao atualizar duração:", error);
    }
  };

  const calcularTotalDuracao = (): { dias: number; horas: number; minutos: number } => {
    const totalMinutos = tarefas.reduce((acc, t) => acc + (t.duracao_minutos || 0), 0);
    const totalHoras = Math.floor(totalMinutos / 60);
    const dias = Math.floor(totalHoras / 24);
    const horas = totalHoras % 24;
    const minutos = totalMinutos % 60;
    return { dias, horas, minutos };
  };

  const formatarTempoTotal = (total: { dias: number; horas: number; minutos: number }): string => {
    const partes: string[] = [];
    if (total.dias > 0) partes.push(`${total.dias}d`);
    if (total.horas > 0) partes.push(`${total.horas}h`);
    if (total.minutos > 0) partes.push(`${total.minutos}m`);
    return partes.length > 0 ? partes.join(' ') : '0h';
  };

  const tarefasConcluidas = tarefas.filter((t) => t.concluido).length;
  const progresso = tarefas.length > 0 
    ? Math.round((tarefasConcluidas / tarefas.length) * 100) 
    : 0;

  const totalDuracao = calcularTotalDuracao();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progresso e Total de Horas */}
      {tarefas.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progresso do Escopo
                </span>
                <span className="text-sm font-semibold text-indigo-600">
                  {tarefasConcluidas}/{tarefas.length} ({progresso}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progresso}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-3 bg-white/60 rounded-lg px-4 border border-indigo-200">
              <Clock className="text-indigo-600" size={24} />
              <div>
                <div className="text-xs text-gray-600">Tempo total estimado</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {formatarTempoTotal(totalDuracao)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de tarefas */}
      <div className="space-y-2">
        {tarefas.map((tarefa) => {
          const duracaoHoras = tarefa.duracao_minutos ? Math.floor(tarefa.duracao_minutos / 60) : 0;
          const duracaoMinutos = tarefa.duracao_minutos ? tarefa.duracao_minutos % 60 : 0;
          
          return (
            <div
              key={tarefa.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                tarefa.concluido
                  ? "bg-gray-50 border-gray-200"
                  : "bg-white border-gray-300 hover:border-indigo-300"
              }`}
            >
              <button
                onClick={() => handleToggleConcluido(tarefa)}
                className="flex-shrink-0 transition-colors"
              >
                {tarefa.concluido ? (
                  <CheckCircle2 className="text-green-600" size={20} />
                ) : (
                  <Circle className="text-gray-400 hover:text-indigo-600" size={20} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    tarefa.concluido
                      ? "line-through text-gray-500"
                      : "text-gray-900"
                  }`}
                >
                  {tarefa.titulo}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                  <Clock size={14} />
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={duracaoHoras}
                    onChange={(e) => handleUpdateDuracao(tarefa, parseInt(e.target.value) || 0, duracaoMinutos)}
                    className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="h"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={duracaoMinutos}
                    onChange={(e) => {
                      const min = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      handleUpdateDuracao(tarefa, duracaoHoras, min);
                    }}
                    className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="m"
                  />
                  <span className="text-gray-500">h</span>
                </div>

                <button
                  onClick={() => handleDeleteTarefa(tarefa.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Adicionar nova tarefa */}
      <div className="flex gap-2">
        <input
          type="text"
          value={novaTarefa.titulo}
          onChange={(e) =>
            setNovaTarefa({ ...novaTarefa, titulo: e.target.value })
          }
          onKeyPress={(e) => e.key === "Enter" && handleAddTarefa()}
          placeholder="Adicionar item ao escopo..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
          <Clock size={16} className="text-gray-500" />
          <input
            type="number"
            min="0"
            max="999"
            value={novaTarefa.duracao_horas}
            onChange={(e) =>
              setNovaTarefa({ ...novaTarefa, duracao_horas: e.target.value })
            }
            placeholder="h"
            className="w-12 px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
          />
          <span className="text-gray-500">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={novaTarefa.duracao_minutos}
            onChange={(e) => {
              const val = e.target.value;
              const num = parseInt(val) || 0;
              setNovaTarefa({ 
                ...novaTarefa, 
                duracao_minutos: Math.min(59, Math.max(0, num)).toString() 
              });
            }}
            placeholder="m"
            className="w-12 px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
          />
          <span className="text-gray-500 text-sm">h</span>
        </div>
        <button
          onClick={handleAddTarefa}
          disabled={adicionando || !novaTarefa.titulo.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Adicionar
        </button>
      </div>

      {tarefas.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Nenhuma tarefa adicionada ainda. Use o campo acima para adicionar itens ao escopo do projeto.
        </div>
      )}
    </div>
  );
}
