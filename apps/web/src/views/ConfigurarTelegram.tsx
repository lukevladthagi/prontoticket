"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function ConfigurarTelegramPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'not_configured'>('loading');
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);

  const checkWebhookStatus = async () => {
    try {
      setStatus('loading');
      const response = await fetch('/api/telegram/webhook-info');
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.includes('TELEGRAM_BOT_TOKEN não configurado')) {
          setStatus('not_configured');
          setErrorMessage('Token do Telegram não configurado');
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Erro ao verificar webhook');
        }
        return;
      }
      
      setWebhookInfo(data.result);
      
      if (data.result.url && data.result.url.includes('/api/telegram/webhook')) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage('Webhook não está configurado corretamente');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Erro ao conectar com a API');
    }
  };

  const configurarWebhook = async () => {
    try {
      setIsSettingWebhook(true);
      const response = await fetch('/api/telegram/set-webhook');
      const html = await response.text();
      
      // Verificar se contém a mensagem de sucesso
      if (html.includes('Webhook Configurado com Sucesso')) {
        setStatus('success');
        await checkWebhookStatus();
      } else if (html.includes('Token não configurado')) {
        setStatus('not_configured');
        setErrorMessage('Configure o TELEGRAM_BOT_TOKEN primeiro em Settings');
      } else {
        setStatus('error');
        setErrorMessage('Erro ao configurar webhook');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Erro ao configurar webhook');
    } finally {
      setIsSettingWebhook(false);
    }
  };

  useEffect(() => {
    checkWebhookStatus();
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configurar Telegram Bot</h1>
          <p className="text-gray-600 mt-2">
            Configure o webhook do Telegram para receber mensagens dos usuários
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {status === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Verificando configuração...</p>
              </div>
            </div>
          )}

          {status === 'not_configured' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 mb-2">Token não configurado</h3>
                    <p className="text-yellow-800 text-sm">
                      Para ativar o webhook do Telegram, você precisa configurar o <code className="bg-yellow-100 px-2 py-1 rounded">TELEGRAM_BOT_TOKEN</code> primeiro.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Passos para configurar:</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Clique nos 3 pontinhos (...) no canto superior direito</li>
                  <li>Selecione "Settings"</li>
                  <li>Procure por <code className="bg-gray-100 px-2 py-1 rounded text-sm">TELEGRAM_BOT_TOKEN</code></li>
                  <li>Cole o token que o @BotFather forneceu</li>
                  <li>Clique em "Save"</li>
                  <li>Volte a esta página e clique em "Verificar Novamente"</li>
                </ol>
              </div>

              <button
                onClick={checkWebhookStatus}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Verificar Novamente
              </button>
            </div>
          )}

          {status === 'error' && !errorMessage.includes('Token') && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <XCircle className="w-6 h-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-2">Webhook não configurado</h3>
                    <p className="text-red-800 text-sm">{errorMessage}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={configurarWebhook}
                disabled={isSettingWebhook}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSettingWebhook ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Configurar Webhook'
                )}
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-2">✅ Webhook configurado com sucesso!</h3>
                    <p className="text-green-800 text-sm">
                      O bot do Telegram está pronto para receber mensagens dos usuários.
                    </p>
                  </div>
                </div>
              </div>

              {webhookInfo && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900">Informações do Webhook:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">URL:</span>
                      <code className="text-gray-900 bg-white px-2 py-1 rounded border border-gray-200">
                        {webhookInfo.url}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mensagens Pendentes:</span>
                      <span className="text-gray-900 font-medium">{webhookInfo.pending_update_count}</span>
                    </div>
                    {webhookInfo.last_error_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Último Erro:</span>
                        <span className="text-red-600 text-xs">{webhookInfo.last_error_message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">🎉 Próximos Passos:</h4>
                <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
                  <li>Abra o Telegram</li>
                  <li>Procure seu bot</li>
                  <li>Envie uma mensagem teste (ex: "Olá" ou "Preciso de ajuda")</li>
                  <li>O bot deve responder usando IA!</li>
                </ol>
              </div>

              <button
                onClick={checkWebhookStatus}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Status
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
