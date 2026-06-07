"use client";

import { useEffect, useState, useRef, useCallback } from 'react';

export function useNewTicketsAlert() {
  const [hasNewTickets, setHasNewTickets] = useState(false);
  const [newTicketsCount, setNewTicketsCount] = useState(0);
  const previousCountRef = useRef<number>(-1);
  const isInitializedRef = useRef(false);

  const fetchTicketCount = useCallback(async () => {
    try {
      const response = await fetch('/api/chamados?status=Novo&limit=999&alerta_global=true');
      if (response.ok) {
        const data = await response.json();
        const newCount = data.chamados ? data.chamados.length : 0;
        
        if (newCount > previousCountRef.current && previousCountRef.current >= 0) {
          setHasNewTickets(true);
          setNewTicketsCount(newCount - previousCountRef.current);
          
          // Auto-dismiss após 10 segundos
          setTimeout(() => {
            setHasNewTickets(false);
          }, 10000);
        }
        
        previousCountRef.current = newCount;
      }
    } catch (error) {
      console.error('Erro ao verificar novos tickets:', error);
    }
  }, []);

  const dismissAlert = useCallback(() => {
    setHasNewTickets(false);
  }, []);

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;
    
    fetchTicketCount();

    const interval = setInterval(fetchTicketCount, 20000);
    return () => {
      clearInterval(interval);
      isInitializedRef.current = false;
    };
  }, [fetchTicketCount]);

  return {
    hasNewTickets,
    newTicketsCount,
    dismissAlert
  };
}
