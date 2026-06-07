"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";

interface Ticket {
  id: number;
  numero: string;
  titulo: string;
  status: string;
  data_resolucao: string | null;
  data_resolucao_formatada: string;
  horas_desde_resolucao: string;
  deveria_ser_fechado: boolean;
  avaliacao_nota: number | null;
}

interface DiagnosticoData {
  horario_atual: string;
  horario_atual_br: string;
  limite_2h: string;
  limite_2h_br: string;
  total_tickets: number;
  tickets_para_fechar: number;
  tickets: Ticket[];
}

export default function DiagnosticoFechamento() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [forcarLoading, setForcarLoading] = useState(false);

  const carregarDiagnostico = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/diagnostico-fechamento");
      if (response.ok) {
        const data = await response.json();
        setDiagnostico(data);
      }
    } catch (error) {
      console.error("Erro ao carregar diagnóstico:", error);
    } finally {
      setLoading(false);
    }
  };

  const forcarFechamento = async () => {
    if (!confirm("Deseja forçar o fechamento de todos os tickets elegíveis?")) {
      return;
    }

    setForcarLoading(true);
    try {
      const response = await fetch("/api/diagnostico-fechamento/forcar-fechamento", {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        alert(`${result.tickets_fechados} tickets foram fechados com sucesso!`);
        carregarDiagnostico();
      }
    } catch (error) {
      console.error("Erro ao forçar fechamento:", error);
      alert("Erro ao forçar fechamento");
    } finally {
      setForcarLoading(false);
    }
  };

  useEffect(() => {
    carregarDiagnostico();
  }, []);

  if (loading && !diagnostico) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico de Fechamento Automático</h1>
          <p className="text-muted-foreground mt-1">
            Tickets em "Aguardando Avaliação" sem avaliação há mais de 2 horas
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={carregarDiagnostico} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={forcarFechamento} disabled={forcarLoading || diagnostico?.tickets_para_fechar === 0}>
            {forcarLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Forçar Fechamento
          </Button>
        </div>
      </div>

      {diagnostico && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Horário Atual (BR)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(diagnostico.horario_atual_br).toLocaleString("pt-BR")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Limite (2h atrás)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(diagnostico.limite_2h_br).toLocaleString("pt-BR")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{diagnostico.total_tickets}</div>
                <p className="text-xs text-muted-foreground mt-1">Aguardando avaliação</p>
              </CardContent>
            </Card>

            <Card className="border-yellow-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Para Fechar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {diagnostico.tickets_para_fechar}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Após 2h sem avaliação</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tickets Analisados</CardTitle>
              <CardDescription>
                Tickets em "Aguardando Avaliação" sem avaliação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostico.tickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>Nenhum ticket aguardando fechamento!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {diagnostico.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        ticket.deveria_ser_fechado
                          ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{ticket.numero}</span>
                          <Badge variant="outline">{ticket.status}</Badge>
                          {ticket.deveria_ser_fechado && (
                            <Badge variant="destructive" className="bg-yellow-500">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Deve ser fechado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{ticket.titulo}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{ticket.horas_desde_resolucao}h</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Resolvido: {new Date(ticket.data_resolucao_formatada).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-300">
                Como funciona o fechamento automático?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-blue-800 dark:text-blue-200">
              <p>1. Quando um ticket é resolvido, ele vai para status "Aguardando Avaliação"</p>
              <p>2. O sistema espera o cliente avaliar o atendimento</p>
              <p>3. Se após 2 horas não houver avaliação, o ticket é fechado automaticamente</p>
              <p>4. O fechamento é processado pelo endpoint /api/cron/fechar-tickets</p>
              <p className="font-semibold mt-4">
                ⚠️ Este endpoint precisa estar configurado no Cron-job.org para executar a cada hora
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
