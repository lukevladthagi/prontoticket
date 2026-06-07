"use client";

import { useEffect, useState } from 'react';
import { BrowserNotificationService } from '@/utils/notifications';

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // Verificar suporte
    setIsSupported(BrowserNotificationService.isSupported());
    
    if (BrowserNotificationService.isSupported()) {
      // Verificar permissão atual
      setPermission(BrowserNotificationService.getPermission());

      // Carregar configurações do localStorage
      const notifEnabled = localStorage.getItem('notifications_enabled');
      const soundEnabledStorage = localStorage.getItem('notification_sound_enabled');
      
      setIsEnabled(notifEnabled !== 'false');
      setSoundEnabled(soundEnabledStorage !== 'false');

      // Registrar service worker
      BrowserNotificationService.registerServiceWorker();
    }
  }, []);

  const requestPermission = async () => {
    const result = await BrowserNotificationService.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setIsEnabled(true);
      localStorage.setItem('notifications_enabled', 'true');
    }
    return result;
  };

  const toggleNotifications = (enabled: boolean) => {
    setIsEnabled(enabled);
    localStorage.setItem('notifications_enabled', enabled.toString());
  };

  const toggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('notification_sound_enabled', enabled.toString());
  };

  return {
    isSupported,
    permission,
    isEnabled,
    soundEnabled,
    requestPermission,
    toggleNotifications,
    toggleSound
  };
}
