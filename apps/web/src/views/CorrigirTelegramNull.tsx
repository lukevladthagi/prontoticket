"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  ativo: number;
  telegram_user_id: string | null;
  diagnostic: string;
}

export default function CorrigirTelegramNull() {
  const [loading, setLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState<Usuario[] | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscarDiagnostico = async () => {
    setLoading(true);
    setErro(null);
    setResultado(null);
    
    try {
      const response = await fetch('/api/fix-telegram-null/diagnostico', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDiagnostico(data.usuarios);
      } else {
        const error = await response.json();
        setErro(error.error || 'Erro ao buscar diagnóstico');
      }
    } catch (error) {
      setErro('Erro ao conectar com o servidor');
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const corrigirDados = async () => {
    if (!confirm('Deseja corrigir os dados dos usuários com telegram_user_id = "null"?')) {
      return;
    }

    setLoading(true);
    setErro(null);
    
    try {
      const response = await fetch('/api/fix-telegram-null/corrigir', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setResultado(data);
        // Atualizar diagnóstico após correção
        setTimeout(buscarDiagnostico, 1000);
      } else {
        const error = await response.json();
        setErro(error.error || error.details || 'Erro ao corrigir dados');
      }
    } catch (error) {
      setErro('Erro ao conectar com o servidor');
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Corrigir Telegram User ID</h1>
        <p className="text-muted-foreground">
          Ferramenta para corrigir usuários com telegram_user_id contendo o texto "null" em vez de NULL no banco de dados
        </p>
      </div>

      <div className="space-y-6">
        {/* Ações */}
        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
            <CardDescription>
              Execute o diagnóstico para ver os usuários afetados, depois clique em corrigir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={buscarDiagnostico}
                disabled={loading}
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {loading ? 'Carregando...' : 'Buscar Diagnóstico'}
              </Button>
              
              <Button
                onClick={corrigirDados}
                disabled={loading || !diagnostico}
                variant="default"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {loading ? 'Corrigindo...' : 'Corrigir Dados'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Erro */}
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {/* Resultado da Correção */}
        {resultado && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Correção realizada com sucesso!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {resultado.usuariosCorrigidos} usuário(s) corrigido(s)
                </p>
                {resultado.verificacao && resultado.verificacao.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold mb-1">Verificação:</p>
                    <ul className="text-sm space-y-1">
                      {resultado.verificacao.map((u: any) => (
                        <li key={u.id}>
                          {u.nome} - telegram_user_id: {u.telegram_user_id === null ? '✅ NULL' : `❌ "${u.telegram_user_id}"`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Diagnóstico */}
        {diagnostico && (
          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico de Usuários</CardTitle>
              <CardDescription>
                Total de {diagnostico.length} técnico(s), gestor(es) e admin(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Perfil</th>
                      <th className="text-left p-2">Ativo</th>
                      <th className="text-left p-2">Diagnóstico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostico.map((usuario) => (
                      <tr 
                        key={usuario.id} 
                        className={`border-b ${
                          usuario.diagnostic === 'STRING null' 
                            ? 'bg-yellow-50 dark:bg-yellow-950' 
                            : ''
                        }`}
                      >
                        <td className="p-2">{usuario.id}</td>
                        <td className="p-2">{usuario.nome}</td>
                        <td className="p-2 text-sm">{usuario.email}</td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs ${
                            usuario.perfil === 'admin' 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                              : usuario.perfil === 'gestor'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {usuario.perfil}
                          </span>
                        </td>
                        <td className="p-2">
                          {usuario.ativo ? (
                            <span className="text-green-600">✓ Ativo</span>
                          ) : (
                            <span className="text-red-600">✗ Inativo</span>
                          )}
                        </td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                            usuario.diagnostic === 'SQL NULL' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : usuario.diagnostic === 'STRING null'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {usuario.diagnostic}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {diagnostico.some(u => u.diagnostic === 'STRING null') && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>⚠️ Atenção:</strong> Existem usuários com telegram_user_id contendo o texto "null" em vez de NULL no banco.
                    Isso impede que eles apareçam na lista de técnicos disponíveis. Clique em "Corrigir Dados" para resolver.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
