"use client";

import { useState } from 'react';
import { Link } from '@/lib/router-shim';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface DiagnosticoResult {
  observacao: string;
  total_tickets_ti: number;
  tickets_com_categoria: number;
  tickets_sem_categoria: number;
  tickets: any[];
}

interface CorrecaoResult {
  success: boolean;
  created_category: boolean;
  fallback_used: boolean;
  tickets_sem_tipo_atualizados: number;
  tickets_categorizados: number;
  categoria_utilizada_id: number;
  avisos?: string[];
  mensagem: string;
}

export default function CorrigirCategoriasTelegram() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoResult | null>(null);
  const [correcao, setCorrecao] = useState<CorrecaoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executarDiagnostico = async () => {
    setLoading(true);
    setError(null);
    setCorrecao(null);
    
    try {
      const response = await fetch('/api/fix-categorias-telegram/diagnostico');
      if (!response.ok) {
        throw new Error('Erro ao executar diagnóstico');
      }
      const data = await response.json();
      setDiagnostico(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const executarCorrecao = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fix-categorias-telegram/corrigir', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Mostrar erro mas com detalhes estruturados
        setError(data.details || 'Erro ao executar correção');
        if (data.avisos?.length > 0) {
          console.warn('Avisos durante correção:', data.avisos);
        }
        return;
      }
      
      setCorrecao(data);
      // Atualizar diagnóstico após correção
      await executarDiagnostico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Corrigir Categorias - Tickets Telegram</h1>
        <p className="text-muted-foreground mt-2">
          Associa automaticamente categorias aos tickets criados via Telegram que estão sem classificação
        </p>
      </div>

      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>Erro ao executar correção</span>
          </div>
        </Card>
      )}

      <div className="grid gap-6">
        {/* Diagnóstico */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Diagnóstico</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Verificar quantos tickets da TI estão sem categoria
          </p>
          
          <Button 
            onClick={executarDiagnostico} 
            disabled={loading}
            className="mb-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              'Executar Diagnóstico'
            )}
          </Button>

          {diagnostico && (
            <div className="mt-4 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {diagnostico.observacao}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-2xl font-bold">{diagnostico.total_tickets_ti}</div>
                  <div className="text-sm text-muted-foreground">Total Telegram</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {diagnostico.tickets_com_categoria}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-400">Com Categoria</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-900">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {diagnostico.tickets_sem_categoria}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-400">Sem Categoria</div>
                </div>
              </div>

              {diagnostico.tickets.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Tickets sem categoria ({diagnostico.tickets.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">Número</th>
                          <th className="text-left p-2">Tipo Problema</th>
                          <th className="text-left p-2">Setor</th>
                          <th className="text-left p-2">Título</th>
                          <th className="text-left p-2">Criado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagnostico.tickets.map((ticket: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-muted/50">
                            <td className="p-2">
                              <Link 
                                to={`/chamados/${ticket.id}`}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                              >
                                {ticket.numero}
                              </Link>
                            </td>
                            <td className="p-2">{ticket.tipo_problema || '-'}</td>
                            <td className="p-2">{ticket.setor_nome}</td>
                            <td className="p-2 max-w-xs truncate">{ticket.titulo}</td>
                            <td className="p-2">{new Date(ticket.created_at).toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Executar Correção */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Executar Correção</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Esta ação vai buscar e associar categorias aos tickets da TI sem categoria, baseando-se no tipo de problema e setor de cada ticket.
          </p>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-900 mb-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              ℹ️ Esta ação irá buscar e associar categorias para TODOS os tickets da TI que ainda não possuem categoria, independente da origem (Telegram, Web, WhatsApp, etc.).
            </p>
          </div>
          
          <Button 
            onClick={executarCorrecao} 
            disabled={loading || (diagnostico?.tickets_sem_categoria === 0)}
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              'Executar Correção'
            )}
          </Button>

          {correcao && (
            <div className="mt-4 space-y-4">
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Correção executada com sucesso!</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400">
                  {correcao.mensagem}
                </p>
                
                {/* Indicadores de status */}
                <div className="mt-3 flex gap-3 text-xs">
                  {correcao.created_category && (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      ✨ Categoria criada automaticamente
                    </span>
                  )}
                  {correcao.fallback_used && (
                    <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                      ⚠️ Categoria fallback utilizada
                    </span>
                  )}
                </div>
              </div>

              {/* Avisos */}
              {correcao.avisos && correcao.avisos.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                    ⚠️ Avisos durante o processamento:
                  </h4>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                    {correcao.avisos.map((aviso, idx) => (
                      <li key={idx}>• {aviso}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-2xl font-bold">{correcao.tickets_sem_tipo_atualizados}</div>
                  <div className="text-sm text-muted-foreground">Tickets com tipo atualizado</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {correcao.tickets_categorizados}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-400">Tickets categorizados</div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Categoria utilizada: ID {correcao.categoria_utilizada_id}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
