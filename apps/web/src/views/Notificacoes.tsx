"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-shim";
import Layout from "@/components/Layout";
import { Bell, Check, CheckCheck, Volume2, VolumeX, AlertCircle } from "lucide-react";
import type { Notificacao } from "@/shared/types";
import { useNotifications } from "@/hooks/useNotifications";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { BrowserNotificationService } from "@/utils/notifications";

export default function NotificacoesPage() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'nao-lidas'>('todas');
  const [showSettings, setShowSettings] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState<string>('Inicializando...');
  
  const { refreshCount, unreadCount } = useNotifications();
  const {
    isSupported,
    permission,
    isEnabled,
    soundEnabled,
    requestPermission,
    toggleNotifications,
    toggleSound
  } = useBrowserNotifications();

  // Monitor de status do sistema de notificações
  useEffect(() => {
    const updateStatus = () => {
      const now = new Date().toLocaleTimeString('pt-BR');
      setMonitoringStatus(`Ativo - ${now}`);
    };
    
    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchNotificacoes();
  }, [filtro]);

  const fetchNotificacoes = async () => {
    try {
      const params = new URLSearchParams();
      if (filtro === 'nao-lidas') {
        params.append('lida', 'false');
      }

      const response = await fetch(`/api/notificacoes?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNotificacoes(data);
      }
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoLida = async (id: number) => {
    try {
      await fetch(`/api/notificacoes/${id}/lida`, { method: 'PUT' });
      fetchNotificacoes();
      refreshCount();
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  };

  const marcarTodasComoLidas = async () => {
    try {
      await fetch('/api/notificacoes/marcar-todas-lidas', { method: 'PUT' });
      fetchNotificacoes();
      refreshCount();
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  const handleClickNotificacao = async (notificacao: Notificacao) => {
    if (!notificacao.lida) {
      await marcarComoLida(notificacao.id);
    }
    if (notificacao.chamado_id) {
      navigate(`/chamados/${notificacao.chamado_id}`);
    }
  };

  const diagnosticarNotificacoes = () => {
    console.log('\n🔍 ===== DIAGNÓSTICO DE NOTIFICAÇÕES =====');
    console.log('Timestamp:', new Date().toLocaleString('pt-BR'));
    console.log('\n1. SUPORTE DO NAVEGADOR:');
    console.log('   - Notificações suportadas:', 'Notification' in window);
    console.log('   - Service Worker suportado:', 'serviceWorker' in navigator);
    console.log('   - Permissão atual:', Notification.permission);
    
    console.log('\n2. CONFIGURAÇÕES LOCALSTORAGE:');
    console.log('   - notifications_enabled:', localStorage.getItem('notifications_enabled'));
    console.log('   - notification_sound_enabled:', localStorage.getItem('notification_sound_enabled'));
    
    console.log('\n3. SERVICE WORKER:');
    navigator.serviceWorker.getRegistrations().then(regs => {
      console.log('   - Registros ativos:', regs.length);
      regs.forEach((reg, i) => {
        console.log(`   - SW ${i + 1}:`, reg.active?.scriptURL || 'não ativo');
      });
    });
    
    console.log('\n4. ESTADO DOS HOOKS:');
    console.log('   - isSupported:', isSupported);
    console.log('   - permission:', permission);
    console.log('   - isEnabled:', isEnabled);
    console.log('   - soundEnabled:', soundEnabled);
    console.log('   - unreadCount:', unreadCount);
    
    console.log('\n===== FIM DO DIAGNÓSTICO =====\n');
    alert('Diagnóstico completo! Verifique o console (F12) para detalhes.');
  };

  const testarNotificacao = async () => {
    console.log('🧪 TESTE DE NOTIFICAÇÃO MANUAL');
    const uniqueTag = `teste-notificacao-${Date.now()}`;
    await BrowserNotificationService.sendNotification({
      title: 'Teste de Notificação',
      body: 'Se você está vendo isso, as notificações do navegador estão funcionando!',
      tag: uniqueTag,
      requireInteraction: true
    });
  };

  const testarNotificacaoDireta = () => {
    console.log('\n🧪 TESTE DIRETO (SEM SERVICE WORKER)');
    console.log('⚠️ Este teste bypassa completamente o Service Worker');
    console.log('⚠️ e usa a Notification API nativa do navegador');
    
    if (Notification.permission !== 'granted') {
      alert('Permissão de notificação não concedida!');
      return;
    }
    
    try {
      const notification = new Notification('🧪 TESTE DIRETO', {
        body: 'Esta é uma notificação criada DIRETAMENTE pela API nativa, sem Service Worker',
        icon: 'https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/b4d52216-85e6-4a21-b93e-45671531bdd3/040c14e4-eeac-4642-9796-b7d1dd537ef2.png',
        tag: `teste-direto-${Date.now()}`,
        requireInteraction: true,
        silent: false
      });
      
      console.log('✅ Notificação direta criada:', notification);
      
      notification.onclick = () => {
        console.log('👆 Clicou na notificação direta!');
        notification.close();
      };
      
      notification.onerror = (error) => {
        console.error('❌ Erro na notificação direta:', error);
      };
      
      notification.onshow = () => {
        console.log('✅ Notificação EXIBIDA com sucesso!');
      };
      
      notification.onclose = () => {
        console.log('🔒 Notificação fechada');
      };
      
    } catch (error) {
      console.error('❌ Erro ao criar notificação direta:', error);
      alert('Erro: ' + (error as Error).message);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notificações</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
            >
              <Bell size={16} />
              Configurações
            </button>
            {notificacoes.some(n => !n.lida) && (
              <button
                onClick={marcarTodasComoLidas}
                className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                <CheckCheck size={16} />
                Marcar todas como lidas
              </button>
            )}
          </div>
        </div>

        {/* Configurações de Notificações do Navegador */}
        {showSettings && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configurações de Notificações do Navegador</h2>
            
            {/* Status do Sistema de Monitoramento */}
            <div className="space-y-3">
              {/* Versão do Sistema */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Versão do Sistema
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 font-mono">
                    {BrowserNotificationService.VERSION} | Build: {new Date().toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
              
              {/* Status do Monitoramento */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">
                    Sistema de Monitoramento
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {monitoringStatus} | {unreadCount} não lidas | Console (F12) para logs detalhados
                  </p>
                </div>
              </div>
            </div>
            
            {!isSupported ? (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    Navegador não suportado
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Seu navegador não suporta notificações. Por favor, use Chrome, Firefox, Edge ou Safari para receber notificações do sistema.
                  </p>
                </div>
              </div>
            ) : permission === 'denied' ? (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    Notificações bloqueadas
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Você bloqueou as notificações deste site. Para habilitar, clique no ícone de cadeado na barra de endereços e permita notificações.
                  </p>
                </div>
              </div>
            ) : permission === 'default' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receba notificações instantâneas no navegador quando houver novos chamados, comentários ou alterações importantes.
                </p>
                <button
                  onClick={requestPermission}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Permitir Notificações do Navegador
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Toggle de Notificações */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Notificações do Navegador
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Receba alertas mesmo quando a aba não estiver ativa
                    </p>
                  </div>
                  <button
                    onClick={() => toggleNotifications(!isEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle de Som */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {soundEnabled ? (
                      <Volume2 className="text-gray-600 dark:text-gray-400" size={20} />
                    ) : (
                      <VolumeX className="text-gray-600 dark:text-gray-400" size={20} />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Som de Notificação
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Tocar um som quando receber notificações
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSound(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      soundEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        soundEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-4">
                  <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    As notificações funcionam mesmo quando o TicketHPC não está aberto (navegador precisa estar em execução).
                  </p>
                </div>

                {/* Botões de Teste e Diagnóstico */}
                <div className="flex flex-col gap-3 mt-4">
                  <div className="flex gap-3">
                    <button
                      onClick={testarNotificacao}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      🧪 Testar Notificação
                    </button>
                    <button
                      onClick={diagnosticarNotificacoes}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      🔍 Diagnóstico Completo
                    </button>
                  </div>
                  <button
                    onClick={testarNotificacaoDireta}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    ⚡ Teste Direto (Bypass Service Worker)
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    O teste direto usa a API nativa do navegador, sem Service Worker
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2">
          <button
            onClick={() => setFiltro('todas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === 'todas'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltro('nao-lidas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === 'nao-lidas'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Não lidas
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : notificacoes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <Bell className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {filtro === 'nao-lidas' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filtro === 'nao-lidas'
                ? 'Você está em dia com suas notificações'
                : 'As notificações aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm divide-y divide-gray-200 dark:divide-gray-700">
            {notificacoes.map((notificacao) => (
              <div
                key={notificacao.id}
                onClick={() => handleClickNotificacao(notificacao)}
                className={`p-6 cursor-pointer transition-colors ${
                  notificacao.lida ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : 'bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notificacao.lida ? 'bg-gray-100 dark:bg-gray-700' : 'bg-indigo-100 dark:bg-indigo-900/30'
                  }`}>
                    <Bell size={20} className={notificacao.lida ? 'text-gray-600 dark:text-gray-400' : 'text-indigo-600 dark:text-indigo-400'} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className={`font-semibold ${
                        notificacao.lida ? 'text-gray-900 dark:text-white' : 'text-indigo-900 dark:text-indigo-300'
                      }`}>
                        {notificacao.titulo}
                      </h3>
                      {!notificacao.lida && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            marcarComoLida(notificacao.id);
                          }}
                          className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded transition-colors"
                          title="Marcar como lida"
                        >
                          <Check size={16} className="text-indigo-600 dark:text-indigo-400" />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">{notificacao.mensagem}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(notificacao.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
