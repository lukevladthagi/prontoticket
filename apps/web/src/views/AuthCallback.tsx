"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-shim";
import { useAuth } from "@/lib/auth-shim";

export default function AuthCallbackPage() {
  const { exchangeCodeForSessionToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Autenticando...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Primeiro, autentica com Google
        await exchangeCodeForSessionToken();
        
        // Verifica se tem telegram_user_id para vincular
        const telegramUserId = searchParams.get('telegram_user_id');
        const whatsappPhone = searchParams.get('whatsapp_phone');
        
        if (telegramUserId) {
          setMessage("Vinculando sua conta do Telegram...");
          
          // Vincular Telegram ao Google
          const response = await fetch('/api/auth/link-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId })
          });

          if (!response.ok) {
            throw new Error('Erro ao vincular conta do Telegram');
          }
          
          setMessage("Conta vinculada com sucesso!");
          setTimeout(() => navigate("/dashboard"), 1000);
        } else if (whatsappPhone) {
          setMessage("Vinculando sua conta do WhatsApp...");
          
          // Vincular WhatsApp ao Google
          const response = await fetch('/api/auth/link-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ whatsapp_phone: whatsappPhone })
          });

          if (!response.ok) {
            throw new Error('Erro ao vincular conta do WhatsApp');
          }
          
          setMessage("Conta vinculada com sucesso!");
          setTimeout(() => navigate("/dashboard"), 1000);
        } else {
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Erro na autenticação:", error);
        setMessage("Erro ao autenticar. Redirecionando...");
        setTimeout(() => navigate("/"), 2000);
      }
    };

    handleCallback();
  }, [exchangeCodeForSessionToken, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
