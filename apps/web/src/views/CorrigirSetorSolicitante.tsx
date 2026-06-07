"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DiagnosticoData {
  total_chamados: number;
  com_setor_preenchido: number;
  sem_setor_mas_corrigivel: number;
  distribuicao: { setor: string; total: number }[];
}

interface CorrecaoResult {
  message: string;
  corrigidos: number;
  total_encontrados: number;
  erros?: string[];
}

export default function CorrigirSetorSolicitante() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [resultado, setResultado] = useState<CorrecaoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarDiagnostico = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fix-setor-solicitante/diagnostico");
      if (!res.ok) throw new Error("Erro ao carregar diagnóstico");
      const data = await res.json();
      setDiagnostico(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executarCorrecao = async () => {
    if (!confirm("Deseja realmente corrigir o setor solicitante de todos os chamados?")) return;
    
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/fix-setor-solicitante/corrigir", { method: "POST" });
      if (!res.ok) throw new Error("Erro ao executar correção");
      const data = await res.json();
      setResultado(data);
      // Recarregar diagnóstico após correção
      await carregarDiagnostico();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Corrigir Setor Solicitante</h1>
        <p className="text-muted-foreground mt-1">
          Preencher o campo setor_solicitante dos chamados com base no setor do usuário solicitante
        </p>
      </div>

      <div className="flex gap-4">
        <Button onClick={carregarDiagnostico} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Carregar Diagnóstico
        </Button>
        
        {diagnostico && diagnostico.sem_setor_mas_corrigivel > 0 && (
          <Button onClick={executarCorrecao} disabled={loading} variant="default">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Executar Correção
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {resultado && (
        <Alert className={resultado.erros && resultado.erros.length > 0 ? "border-yellow-500" : "border-green-500"}>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold">{resultado.message}</div>
            {resultado.erros && resultado.erros.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold text-yellow-600">Erros encontrados:</div>
                <ul className="list-disc list-inside text-sm">
                  {resultado.erros.map((erro, idx) => (
                    <li key={idx}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {diagnostico && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total de Chamados</CardTitle>
              <CardDescription>Quantidade total no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{diagnostico.total_chamados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Com Setor Preenchido</CardTitle>
              <CardDescription>Chamados já corretos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{diagnostico.com_setor_preenchido}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {diagnostico.total_chamados > 0 
                  ? ((diagnostico.com_setor_preenchido / diagnostico.total_chamados) * 100).toFixed(1)
                  : 0}% do total
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Correções Necessárias</CardTitle>
              <CardDescription>Chamados que podem ser corrigidos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-orange-600">{diagnostico.sem_setor_mas_corrigivel}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {diagnostico.total_chamados > 0
                  ? ((diagnostico.sem_setor_mas_corrigivel / diagnostico.total_chamados) * 100).toFixed(1)
                  : 0}% do total
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {diagnostico && diagnostico.distribuicao && diagnostico.distribuicao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Setor</CardTitle>
            <CardDescription>Quantidade de chamados por setor solicitante</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {diagnostico.distribuicao.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className={item.setor === "Não especificado" ? "text-muted-foreground italic" : ""}>
                    {item.setor}
                  </span>
                  <span className="font-semibold">{item.total}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
