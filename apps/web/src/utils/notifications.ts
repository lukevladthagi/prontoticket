// Utilitário para gerenciar notificações do navegador usando API nativa

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
}

export class BrowserNotificationService {
  static readonly VERSION = '4.0-SIMPLE';

  static isSupported(): boolean {
    return 'Notification' in window;
  }

  static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    if (this.getPermission() === 'granted') return 'granted';

    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return 'denied';
    }
  }

  static async registerServiceWorker(): Promise<void> {
    // Service Worker desabilitado
    return;
  }

  static async sendNotification(options: NotificationOptions): Promise<void> {
    console.log('🔔 sendNotification chamado:', { options });
    
    // Verificações básicas
    const supported = this.isSupported();
    const permission = this.getPermission();
    console.log('📋 Suporte:', supported, 'Permissão:', permission);
    
    if (!supported) {
      console.warn('❌ Notificações não suportadas');
      return;
    }
    
    if (permission !== 'granted') {
      console.warn('❌ Permissão negada:', permission);
      return;
    }

    // Verificar se usuário desabilitou nas configurações
    const enabled = localStorage.getItem('notifications_enabled');
    console.log('⚙️ Configuração enabled:', enabled);
    
    if (enabled === 'false') {
      console.warn('❌ Notificações desabilitadas pelo usuário');
      return;
    }

    try {
      // Tocar som se habilitado
      if (localStorage.getItem('notification_sound_enabled') !== 'false') {
        console.log('🔊 Tocando som...');
        this.playNotificationSound();
      }

      // Criar notificação com tag única
      const notifOptions = {
        body: options.body,
        icon: options.icon || 'https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/b4d52216-85e6-4a21-b93e-45671531bdd3/040c14e4-eeac-4642-9796-b7d1dd537ef2.png',
        tag: `${options.tag || 'notif'}-${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
        silent: false
      };
      
      console.log('✨ Criando notificação:', options.title, notifOptions);
      const notification = new Notification(options.title, notifOptions);
      
      console.log('✅ Notificação criada com sucesso!', notification);

      notification.onclick = () => {
        console.log('👆 Notificação clicada');
        window.focus();
        if (options.url) {
          window.location.href = options.url;
        }
        notification.close();
      };
      
      notification.onshow = () => {
        console.log('👁️ Notificação exibida na tela');
      };
      
      notification.onerror = (error) => {
        console.error('❌ Erro ao exibir notificação:', error);
      };
      
      notification.onclose = () => {
        console.log('🚪 Notificação fechada');
      };

    } catch (error) {
      console.error('❌ ERRO ao criar notificação:', error);
    }
  }

  // Tocar som de notificação
  private static playNotificationSound(): void {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZizcIGWi77eefTRAMUKfj8LZjHAY4ktfyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQUrgc7y2Yk3CBlou+3nn00QDFC34/C2YhsGOJHX8sx5LAUkd8fw3ZBABRU=');
      audio.volume = 0.3;
      audio.play().catch(err => console.warn('Não foi possível tocar o som:', err));
    } catch (error) {
      console.warn('Erro ao tocar som de notificação:', error);
    }
  }

  // Limpar todas as notificações (não disponível sem Service Worker)
  static async clearAllNotifications(): Promise<void> {
    console.log('ℹ️ clearAllNotifications não disponível sem Service Worker');
    return;
  }
}

// Helper para enviar notificações específicas do sistema

export async function notifyNewTicket(ticketNumber: string, ticketId: number): Promise<void> {
  await BrowserNotificationService.sendNotification({
    title: '🎫 Novo Chamado Atribuído',
    body: `Chamado ${ticketNumber} foi atribuído a você`,
    url: `/chamado/${ticketId}`,
    tag: `ticket-${ticketId}`,
    requireInteraction: true
  });
}

export async function notifyTicketStatusChange(ticketNumber: string, newStatus: string, ticketId: number): Promise<void> {
  const emoji = newStatus === 'Resolvido' ? '✅' : newStatus === 'Fechado' ? '🔒' : '🔄';
  await BrowserNotificationService.sendNotification({
    title: `${emoji} Status do Chamado Alterado`,
    body: `Chamado ${ticketNumber} mudou para: ${newStatus}`,
    url: `/chamado/${ticketId}`,
    tag: `ticket-status-${ticketId}`
  });
}

export async function notifyNewComment(ticketNumber: string, author: string, ticketId: number): Promise<void> {
  await BrowserNotificationService.sendNotification({
    title: '💬 Novo Comentário',
    body: `${author} comentou no chamado ${ticketNumber}`,
    url: `/chamado/${ticketId}`,
    tag: `comment-${ticketId}`
  });
}

export async function notifyScheduledMaintenance(equipmentName: string, maintenanceId: number): Promise<void> {
  await BrowserNotificationService.sendNotification({
    title: '⚠️ Manutenção Próxima',
    body: `Manutenção preventiva de ${equipmentName} próxima do vencimento`,
    url: '/manutencao',
    tag: `maintenance-${maintenanceId}`,
    requireInteraction: true
  });
}

export async function notifyProjectApproval(projectName: string, projectId: number): Promise<void> {
  await BrowserNotificationService.sendNotification({
    title: '📋 Aprovação de Projeto',
    body: `Projeto "${projectName}" requer sua aprovação`,
    url: `/projetos`,
    tag: `project-${projectId}`,
    requireInteraction: true
  });
}
