import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserNotificationService } from '@/utils/notifications';
import type { Notificacao } from '@/shared/types';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const previousCountRef = useRef<number>(-1);
  const isInitializedRef = useRef(false);

  const fetchAndShowNewNotifications = useCallback(async (quantidadeNovas: number) => {
    try {
      const response = await fetch(`/api/notificacoes?lida=false&limit=${quantidadeNovas}`);
      
      if (response.ok) {
        const notificacoes: Notificacao[] = await response.json();
        
        for (let i = 0; i < quantidadeNovas && i < notificacoes.length; i++) {
          const notif = notificacoes[i];
          
          await BrowserNotificationService.sendNotification({
            title: notif.titulo,
            body: notif.mensagem,
            url: notif.chamado_id ? `/chamados/${notif.chamado_id}` : '/notificacoes',
            tag: `notif-${notif.id}`,
            requireInteraction: false
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar/enviar notificações:', error);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notificacoes/count/nao-lidas');
      if (response.ok) {
        const data = await response.json();
        const newCount = data.count || 0;
        const prevCount = previousCountRef.current;
        
        if (newCount > prevCount && prevCount >= 0) {
          const quantidadeNovas = newCount - prevCount;
          await fetchAndShowNewNotifications(quantidadeNovas);
        }
        
        previousCountRef.current = newCount;
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Erro ao buscar contagem de notificações:', error);
    }
  }, [fetchAndShowNewNotifications]);

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;
    
    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 20000);
    return () => {
      clearInterval(interval);
      isInitializedRef.current = false;
    };
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    refreshCount: fetchUnreadCount
  };
}
