"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-shim";
import Layout from "@/components/Layout";
import { Save, MessageCircle, Unlink, Copy, Check } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { Unidade } from "@/shared/types";

export default function PerfilPage() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUserProfile();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramCodeExpires, setTelegramCodeExpires] = useState<string | null>(null);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    telefone: '',
    setor: '',
    unidade_id: 0,
  });

  useEffect(() => {
    fetchUnidades();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        telefone: profile.telefone || '',
        setor: profile.setor || '',
        unidade_id: profile.unidade_id || 0,
      });
    }
  }, [profile]);

  const fetchUnidades = async () => {
    try {
      const response = await fetch("/api/unidades");
      if (response.ok) {
        const data = await response.json();
        setUnidades(data);
      }
    } catch (error) {
      console.error("Erro ao buscar unidades:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/user-profiles/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await refreshProfile();
        alert("Perfil atualizado com sucesso!");
      } else {
        alert("Erro ao atualizar perfil");
      }
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      alert("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const generateTelegramCode = async () => {
    try {
      const response = await fetch("/api/user-profiles/me/telegram-link-code", {
        method: "POST",
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setTelegramCode(data.code);
        setTelegramCodeExpires(data.expires_at);
      } else {
        alert("Erro ao gerar código de vinculação");
      }
    } catch (error) {
      console.error("Erro ao gerar código:", error);
      alert("Erro ao gerar código de vinculação");
    }
  };

  const unlinkTelegram = async () => {
    if (!confirm("Tem certeza que deseja desvincular sua conta do Telegram?")) {
      return;
    }

    setUnlinkingTelegram(true);
    try {
      const response = await fetch("/api/user-profiles/me/telegram", {
        method: "DELETE",
        credentials: 'include'
      });

      if (response.ok) {
        await refreshProfile();
        alert("Telegram desvinculado com sucesso!");
      } else {
        alert("Erro ao desvincular Telegram");
      }
    } catch (error) {
      console.error("Erro ao desvincular Telegram:", error);
      alert("Erro ao desvincular Telegram");
    } finally {
      setUnlinkingTelegram(false);
    }
  };

  const copyCode = () => {
    if (telegramCode) {
      navigator.clipboard.writeText(telegramCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTimeRemaining = () => {
    if (!telegramCodeExpires) return '';
    const now = new Date();
    const expires = new Date(telegramCodeExpires);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Expirado';
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Atualizar timer a cada segundo quando há código
  useEffect(() => {
    if (telegramCode && telegramCodeExpires) {
      const interval = setInterval(() => {
        const now = new Date();
        const expires = new Date(telegramCodeExpires);
        if (now >= expires) {
          setTelegramCode(null);
          setTelegramCodeExpires(null);
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [telegramCode, telegramCodeExpires]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {user?.google_user_data.name?.[0] || user?.email[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>

        {/* Informações da Conta Google */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações da Conta</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Nome</label>
              <p className="text-gray-900">{user?.google_user_data.name || 'Não informado'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">E-mail</label>
              <p className="text-gray-900">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Perfil</label>
              <p className="text-gray-900 capitalize">{profile?.perfil || 'Carregando...'}</p>
            </div>
          </div>
        </div>

        {/* Vinculação Telegram */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <MessageCircle className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Telegram</h2>
                <p className="text-sm text-gray-600">Receba notificações no Telegram</p>
              </div>
            </div>
            {profile?.telegram_user_id && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                ✓ Vinculado
              </span>
            )}
          </div>

          {profile?.telegram_user_id ? (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Usuário do Telegram:</strong> {profile.telegram_username ? `@${profile.telegram_username}` : 'Configurado'}
                </p>
                <p className="text-sm text-gray-600">
                  Você receberá notificações de chamados automaticamente no Telegram.
                </p>
              </div>
              <button
                onClick={unlinkTelegram}
                disabled={unlinkingTelegram}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                <Unlink size={18} />
                {unlinkingTelegram ? 'Desvinculando...' : 'Desvincular Telegram'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {!telegramCode ? (
                <div>
                  <p className="text-gray-700 mb-4">
                    Vincule sua conta do Telegram para receber notificações de chamados diretamente no app.
                  </p>
                  <button
                    onClick={generateTelegramCode}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <MessageCircle size={18} />
                    Gerar Código de Vinculação
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 border border-blue-200">
                  <p className="text-sm text-gray-700 mb-4">
                    <strong>Passo 1:</strong> Copie o código abaixo
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 bg-gray-50 border-2 border-blue-600 rounded-lg px-4 py-3 text-center">
                      <span className="text-3xl font-bold text-blue-600 tracking-wider">{telegramCode}</span>
                    </div>
                    <button
                      onClick={copyCode}
                      className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      title="Copiar código"
                    >
                      {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Passo 2:</strong> Abra o bot no Telegram e envie este código
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    ⏱️ Código expira em: {getTimeRemaining()}
                  </p>
                  <button
                    onClick={generateTelegramCode}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Gerar novo código
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Formulário de Edição */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Informações Adicionais</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Setor</label>
            <input
              type="text"
              value={formData.setor}
              onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
              placeholder="Ex: TI, Enfermagem, Recepção"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unidade</label>
            <select
              value={formData.unidade_id}
              onChange={(e) => setFormData({ ...formData, unidade_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value={0}>Selecione uma unidade</option>
              {unidades.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>
                  {unidade.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
