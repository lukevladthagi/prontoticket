"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ModalProjeto from "@/components/ModalProjeto";
import { FolderKanban, Plus, Clock, TrendingUp, BarChart3 } from "lucide-react";
import type { Projeto, StatusProjeto, ProjetoTarefa } from "@/shared/types";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState<Projeto | null>(null);
  const [projetoArrastando, setProjetoArrastando] = useState<Projeto | null>(null);
  const [visualizacao, setVisualizacao] = useState<'kanban' | 'gantt'>('kanban');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [tarefasPorProjeto, setTarefasPorProjeto] = useState<Record<number, ProjetoTarefa[]>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const colunas: { status: StatusProjeto; label: string; color: string }[] = [
    { status: 'Aguardando Aprovação', label: 'Aguardando Aprovação', color: 'bg-blue-50 border-blue-200' },
    { status: 'Planejamento', label: 'Em Planejamento', color: 'bg-cyan-50 border-cyan-200' },
    { status: 'Em andamento', label: 'Em Andamento', color: 'bg-indigo-50 border-indigo-200' },
    { status: 'Pausado', label: 'Em Homologação', color: 'bg-amber-50 border-amber-200' },
    { status: 'Concluído', label: 'Concluído', color: 'bg-purple-50 border-purple-200' },
  ];

  const statusColors: Record<StatusProjeto, string> = {
    'Aguardando Aprovação': 'bg-blue-100 text-blue-700',
    'Planejamento': 'bg-cyan-100 text-cyan-700',
    'Em andamento': 'bg-indigo-100 text-indigo-700',
    'Pausado': 'bg-amber-100 text-amber-700',
    'Concluído': 'bg-purple-100 text-purple-700',
    'Cancelado': 'bg-red-100 text-red-700',
  };

  useEffect(() => {
    fetchProjetos();
  }, []);

  useEffect(() => {
    if (projetos.length > 0) {
      fetchTarefas();
    }
  }, [projetos]);

  const fetchProjetos = async () => {
    try {
      const response = await fetch("/api/projetos");
      if (response.ok) {
        const data = await response.json();
        setProjetos(data);
      }
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTarefas = async () => {
    const tarefasMap: Record<number, ProjetoTarefa[]> = {};
    
    for (const projeto of projetos) {
      try {
        const response = await fetch(`/api/projetos/${projeto.id}/tarefas`);
        if (response.ok) {
          const tarefas = await response.json();
          tarefasMap[projeto.id] = tarefas;
        }
      } catch (error) {
        console.error(`Erro ao buscar tarefas do projeto ${projeto.id}:`, error);
      }
    }
    
    setTarefasPorProjeto(tarefasMap);
  };

  const handleNovoClick = () => {
    setProjetoSelecionado(null);
    setModalAberto(true);
  };

  const handleEditClick = (projeto: Projeto) => {
    setProjetoSelecionado(projeto);
    setModalAberto(true);
  };

  const handleModalClose = () => {
    setModalAberto(false);
    setProjetoSelecionado(null);
  };

  const handleModalSave = () => {
    fetchProjetos();
    handleModalClose();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const projeto = projetos.find(p => p.id === event.active.id);
    setProjetoArrastando(projeto || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setProjetoArrastando(null);

    if (!over) return;

    const projetoId = active.id as number;
    const novoStatus = over.id as StatusProjeto;

    const projeto = projetos.find(p => p.id === projetoId);
    if (!projeto || projeto.status === novoStatus) return;

    // Atualizar localmente primeiro para feedback imediato
    setProjetos(projetos.map(p => 
      p.id === projetoId ? { ...p, status: novoStatus } : p
    ));

    // Atualizar no backend
    try {
      const response = await fetch(`/api/projetos/${projetoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...projeto, status: novoStatus }),
      });

      if (!response.ok) {
        // Reverter mudança se falhar
        setProjetos(projetos);
        alert('Erro ao atualizar status do projeto');
      }
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      setProjetos(projetos);
      alert('Erro ao atualizar status do projeto');
    }
  };

  const getProjetosPorStatus = (status: StatusProjeto) => {
    return projetos.filter(p => p.status === status);
  };

  const projetosParaGantt = (): Task[] => {
    const tasks: Task[] = [];
    
    projetos
      .filter(p => p.data_inicio && p.data_fim_prevista)
      .forEach((projeto) => {
        const inicio = new Date(projeto.data_inicio!);
        const fim = new Date(projeto.data_fim_prevista!);
        
        // Garantir que as datas são válidas
        if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
          return;
        }

        // Garantir que a data de fim é depois da data de início
        const dataFim = fim > inicio ? fim : new Date(inicio.getTime() + 86400000);

        // Adicionar projeto como task
        tasks.push({
          id: `projeto-${projeto.id}`,
          name: projeto.nome,
          start: inicio,
          end: dataFim,
          progress: projeto.status === 'Concluído' ? 100 : 
                   projeto.status === 'Em andamento' ? 50 :
                   projeto.status === 'Pausado' ? 50 : 0,
          type: 'project',
          styles: {
            backgroundColor: projeto.status === 'Concluído' ? '#9333ea' :
                            projeto.status === 'Em andamento' ? '#4f46e5' :
                            projeto.status === 'Pausado' ? '#f59e0b' :
                            projeto.status === 'Planejamento' ? '#06b6d4' : '#3b82f6',
            progressColor: '#ffffff',
            backgroundSelectedColor: '#7c3aed',
          },
        });

        // Adicionar tarefas do projeto
        const tarefas = tarefasPorProjeto[projeto.id] || [];
        tarefas
          .filter(t => t.prazo)
          .forEach((tarefa) => {
            const prazoDate = new Date(tarefa.prazo!);
            
            if (isNaN(prazoDate.getTime())) {
              return;
            }

            // Tarefas têm apenas um dia de duração
            const tarefaInicio = new Date(prazoDate);
            const tarefaFim = new Date(prazoDate);
            tarefaFim.setHours(23, 59, 59);

            tasks.push({
              id: `tarefa-${tarefa.id}`,
              name: `  ${tarefa.titulo}`,
              start: tarefaInicio,
              end: tarefaFim,
              progress: tarefa.concluido ? 100 : 0,
              type: 'task',
              project: `projeto-${projeto.id}`,
              styles: {
                backgroundColor: tarefa.concluido ? '#10b981' : '#94a3b8',
                progressColor: '#ffffff',
                backgroundSelectedColor: tarefa.concluido ? '#059669' : '#64748b',
              },
            });
          });
      });
    
    return tasks;
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projetos</h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
              <button
                onClick={() => setVisualizacao('kanban')}
                className={`px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors ${
                  visualizacao === 'kanban'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FolderKanban size={18} />
                Kanban
              </button>
              <button
                onClick={() => setVisualizacao('gantt')}
                className={`px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors ${
                  visualizacao === 'gantt'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <BarChart3 size={18} />
                Gantt
              </button>
            </div>
            <button
              onClick={handleNovoClick}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Novo Projeto
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : projetos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <FolderKanban className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum projeto cadastrado</h3>
            <p className="text-gray-600 dark:text-gray-400">Os projetos de TI aparecerão aqui</p>
          </div>
        ) : visualizacao === 'gantt' ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Cronograma de Projetos</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode(ViewMode.Day)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    viewMode === ViewMode.Day
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Dia
                </button>
                <button
                  onClick={() => setViewMode(ViewMode.Week)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    viewMode === ViewMode.Week
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setViewMode(ViewMode.Month)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    viewMode === ViewMode.Month
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Mês
                </button>
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              {projetosParaGantt().length > 0 ? (
                <Gantt
                  tasks={projetosParaGantt()}
                  viewMode={viewMode}
                  locale="pt-BR"
                  listCellWidth=""
                  columnWidth={viewMode === ViewMode.Month ? 60 : viewMode === ViewMode.Week ? 65 : 30}
                  onDoubleClick={(task) => {
                    const projeto = projetos.find(p => p.id === Number(task.id));
                    if (projeto) handleEditClick(projeto);
                  }}
                />
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>Nenhum projeto com datas definidas</p>
                  <p className="text-sm mt-2">Adicione datas de início e fim aos projetos para visualizá-los no Gantt</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-5 gap-4 pb-8">
              {colunas.map((coluna) => (
                <KanbanColumn
                  key={coluna.status}
                  status={coluna.status}
                  label={coluna.label}
                  color={coluna.color}
                  projetos={getProjetosPorStatus(coluna.status)}
                  onProjetoClick={handleEditClick}
                  statusColors={statusColors}
                  tarefasPorProjeto={tarefasPorProjeto}
                />
              ))}
            </div>

            <DragOverlay>
              {projetoArrastando ? (
                <ProjetoCard
                  projeto={projetoArrastando}
                  isDragging
                  statusColors={statusColors}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {modalAberto && (
          <ModalProjeto
            projeto={projetoSelecionado}
            onClose={handleModalClose}
            onSave={handleModalSave}
          />
        )}
      </div>
    </Layout>
  );
}

interface KanbanColumnProps {
  status: StatusProjeto;
  label: string;
  color: string;
  projetos: Projeto[];
  onProjetoClick: (projeto: Projeto) => void;
  statusColors: Record<StatusProjeto, string>;
  tarefasPorProjeto: Record<number, ProjetoTarefa[]>;
}

function KanbanColumn({ status, label, color, projetos, onProjetoClick, statusColors, tarefasPorProjeto }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 ${color} dark:bg-gray-800 dark:border-gray-600 min-h-[600px] flex flex-col`}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 rounded-t-xl">
        <h2 className="font-semibold text-gray-900 dark:text-white">{label}</h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">{projetos.length}</span>
      </div>
      
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {projetos.map((projeto) => (
          <DraggableProjetoCard
            key={projeto.id}
            projeto={projeto}
            onClick={() => onProjetoClick(projeto)}
            statusColors={statusColors}
            tarefasPorProjeto={tarefasPorProjeto}
          />
        ))}
      </div>
    </div>
  );
}

interface DraggableProjetoCardProps {
  projeto: Projeto;
  onClick: () => void;
  statusColors: Record<StatusProjeto, string>;
  tarefasPorProjeto: Record<number, ProjetoTarefa[]>;
}

function DraggableProjetoCard({ projeto, onClick, statusColors, tarefasPorProjeto }: DraggableProjetoCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: projeto.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    cursor: 'grabbing',
  } : {
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <ProjetoCard projeto={projeto} isDragging={isDragging} statusColors={statusColors} tarefasPorProjeto={tarefasPorProjeto} />
    </div>
  );
}

interface ProjetoCardProps {
  projeto: Projeto;
  isDragging?: boolean;
  statusColors: Record<StatusProjeto, string>;
  tarefasPorProjeto?: Record<number, ProjetoTarefa[]>;
}

function ProjetoCard({ projeto, isDragging = false, statusColors, tarefasPorProjeto = {} }: ProjetoCardProps) {
  const tarefas = tarefasPorProjeto[projeto.id] || [];
  const tarefasConcluidas = tarefas.filter(t => t.concluido).length;
  const totalTarefas = tarefas.length;
  const porcentagem = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;

  // Calcular progresso esperado baseado no tempo
  let progressoEsperado = 0;
  let temDatas = false;
  if (projeto.data_inicio && projeto.data_fim_prevista) {
    const inicio = new Date(projeto.data_inicio);
    const fim = new Date(projeto.data_fim_prevista);
    const hoje = new Date();
    
    if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime()) && fim > inicio) {
      temDatas = true;
      const totalDias = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
      const diasDecorridos = (hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
      progressoEsperado = Math.max(0, Math.min(100, Math.round((diasDecorridos / totalDias) * 100)));
    }
  }

  return (
    <div
      className={`bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-all ${
        isDragging ? 'rotate-3 opacity-80' : 'cursor-pointer'
      }`}
    >
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">{projeto.nome}</h3>
      
      {projeto.descricao && (
        <p className="text-gray-600 dark:text-gray-400 text-xs mb-3 line-clamp-2">{projeto.descricao}</p>
      )}
      
      <div className="space-y-2 text-xs">
        {projeto.sponsor && (
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <TrendingUp size={12} />
            <span className="truncate">{projeto.sponsor}</span>
          </div>
        )}
        {projeto.data_fim_prevista && (
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <Clock size={12} />
            <span>{new Date(projeto.data_fim_prevista).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>

      {totalTarefas > 0 && (
        <div className="mt-3">
          <div className="relative w-full bg-gray-200 dark:bg-gray-600 rounded-full h-6 overflow-hidden">
            {/* Barra de progresso real (tarefas concluídas) */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 flex items-center justify-center"
              style={{ width: `${porcentagem}%` }}
            >
              {porcentagem > 15 && (
                <span className="text-white text-xs font-semibold">
                  {porcentagem}%
                </span>
              )}
            </div>
            
            {/* Linha indicadora do progresso esperado baseado no tempo */}
            {temDatas && progressoEsperado > 0 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-white dark:bg-gray-200 shadow-md z-10 transition-all duration-300"
                style={{ left: `${progressoEsperado}%` }}
                title={`Progresso esperado: ${progressoEsperado}%`}
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-white dark:bg-gray-200 rounded-full shadow-md"></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white dark:bg-gray-200 rounded-full shadow-md"></div>
              </div>
            )}
            
            {porcentagem <= 15 && (
              <span className="absolute inset-0 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-semibold">
                {porcentagem}%
              </span>
            )}
          </div>
          
          {/* Legenda do indicador de tempo */}
          {temDatas && progressoEsperado > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-1.5 h-1.5 bg-white dark:bg-gray-300 border border-gray-400 dark:border-gray-500 rounded-full"></div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Esperado: {progressoEsperado}%
                {porcentagem >= progressoEsperado ? ' ✓' : ' ⚠'}
              </span>
            </div>
          )}
        </div>
      )}

      {projeto.status && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[projeto.status]}`}>
            {projeto.status}
          </span>
        </div>
      )}
    </div>
  );
}
