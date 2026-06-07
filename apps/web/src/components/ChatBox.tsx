"use client";

import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-shim";
import type { Comentario } from "@/shared/types";

interface ChatBoxProps {
  chamadoId: number;
}

export default function ChatBox({ chamadoId }: ChatBoxProps) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<Comentario[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef<number>(0);
  const shouldAutoScrollRef = useRef<boolean>(true);

  useEffect(() => {
    fetchMensagens();
    
    // Polling a cada 15 segundos para simular tempo real
    pollingRef.current = window.setInterval(() => {
      fetchMensagens();
    }, 15000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [chamadoId]);

  useEffect(() => {
    // Só faz scroll automático se:
    // 1. Houver novas mensagens (não apenas refresh)
    // 2. O usuário estiver perto do final do chat
    if (mensagens.length > previousMessageCountRef.current) {
      const container = messagesContainerRef.current;
      if (container && shouldAutoScrollRef.current) {
        scrollToBottom();
      }
    }
    previousMessageCountRef.current = mensagens.length;
  }, [mensagens]);

  // Detecta quando o usuário rola manualmente
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Verifica se está perto do final (dentro de 100px do fim)
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    shouldAutoScrollRef.current = isNearBottom;
  };

  const fetchMensagens = async () => {
    try {
      const response = await fetch(`/api/chamados/${chamadoId}/comentarios`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMensagens(data);
        setErro(null);
      } else if (response.status === 401) {
        setErro('Você precisa estar autenticado para ver as mensagens');
      } else {
        setErro('Erro ao carregar mensagens');
      }
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      setErro('Erro de conexão ao carregar mensagens');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || enviando) return;

    // Verificar se o usuário está autenticado
    if (!user) {
      setErro('Você precisa estar autenticado para enviar mensagens. Faça login novamente.');
      return;
    }

    setEnviando(true);
    setDigitando(false);
    setErro(null);

    try {
      const response = await fetch(`/api/chamados/${chamadoId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          conteudo: novaMensagem,
          tipo: 'publico',
        }),
      });

      if (response.ok) {
        setNovaMensagem("");
        await fetchMensagens();
      } else {
        // Tentar ler a mensagem de erro do servidor
        let errorMessage = 'Erro ao enviar mensagem. Tente novamente.';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Se não conseguir ler o JSON, usar mensagem padrão
        }

        if (response.status === 401) {
          setErro('Você precisa estar autenticado. Faça login novamente.');
        } else if (response.status === 403) {
          setErro('Você não tem permissão para comentar neste chamado.');
        } else if (response.status === 404) {
          setErro('Chamado não encontrado.');
        } else if (response.status === 500) {
          setErro('Erro no servidor. Por favor, tente novamente em alguns instantes.');
        } else {
          setErro(errorMessage);
        }
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setErro('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNovaMensagem(e.target.value);
    setDigitando(e.target.value.length > 0);
  };

  const formatarHora = (data: string) => {
    const date = new Date(data);
    // Converter para horário de Brasília (UTC-3)
    const brasiliaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return brasiliaTime.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const formatarData = (data: string) => {
    const date = new Date(data);
    // Converter para horário de Brasília (UTC-3)
    const brasiliaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    
    // Obter hoje e ontem em Brasília
    const agora = new Date();
    const hojeBrasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const ontemBrasilia = new Date(hojeBrasilia.getTime() - 24 * 60 * 60 * 1000);

    const dataBrasiliaStr = brasiliaTime.toISOString().split('T')[0];
    const hojeBrasiliaStr = hojeBrasilia.toISOString().split('T')[0];
    const ontemBrasiliaStr = ontemBrasilia.toISOString().split('T')[0];

    if (dataBrasiliaStr === hojeBrasiliaStr) {
      return 'Hoje';
    } else if (dataBrasiliaStr === ontemBrasiliaStr) {
      return 'Ontem';
    } else {
      return brasiliaTime.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        timeZone: 'UTC'
      });
    }
  };

  const agruparPorData = (mensagens: Comentario[]) => {
    const grupos: { [key: string]: Comentario[] } = {};
    
    mensagens.forEach((msg) => {
      const data = formatarData(msg.created_at);
      if (!grupos[data]) {
        grupos[data] = [];
      }
      grupos[data].push(msg);
    });

    return grupos;
  };

  const mensagensAgrupadas = agruparPorData(mensagens);
  const ehMinhaMensagem = (autorId: string) => autorId === user?.id;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
            <MessageCircle className="text-white" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Chat do Chamado</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Comunique-se em tempo real</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {erro && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-700 dark:text-red-400 text-sm">{erro}</p>
          </div>
        )}
        
        {Object.keys(mensagensAgrupadas).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <MessageCircle size={48} className="mb-3 opacity-50" />
            <p>Nenhuma mensagem ainda</p>
            <p className="text-sm">Inicie a conversa!</p>
          </div>
        ) : (
          Object.entries(mensagensAgrupadas).map(([data, msgs]) => (
            <div key={data}>
              {/* Separador de data */}
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {data}
                </div>
              </div>

              {/* Mensagens do dia */}
              {msgs.map((msg) => {
                const ehMinha = ehMinhaMensagem(msg.autor_id);
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${ehMinha ? 'justify-end' : 'justify-start'} mb-3`}
                  >
                    <div className={`max-w-[70%] ${ehMinha ? 'order-2' : 'order-1'}`}>
                      {!ehMinha && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-1">{msg.autor_nome}</p>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          msg.tipo === 'sistema'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-center text-sm italic'
                            : ehMinha
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200 rounded-bl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                      </div>
                      <p className={`text-xs text-gray-500 dark:text-gray-400 mt-1 px-1 ${ehMinha ? 'text-right' : 'text-left'}`}>
                        {formatarHora(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Indicador de digitação */}
      {digitando && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 italic">
          Você está digitando...
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleEnviar} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {!user && (
          <div className="mb-3 text-center">
            <p className="text-sm text-amber-600 dark:text-amber-400">Você precisa estar autenticado para enviar mensagens</p>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={novaMensagem}
            onChange={handleInputChange}
            placeholder={user ? "Digite sua mensagem..." : "Faça login para enviar mensagens"}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={enviando || !user}
          />
          <button
            type="submit"
            disabled={!novaMensagem.trim() || enviando || !user}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={18} />
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
