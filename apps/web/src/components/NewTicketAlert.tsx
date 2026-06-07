"use client";

import { useNewTicketsAlert } from "@/hooks/useNewTicketsAlert";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function NewTicketAlert() {
  const { hasNewTickets, newTicketsCount, dismissAlert } = useNewTicketsAlert();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (hasNewTickets) {
      setIsVisible(true);
    }
  }, [hasNewTickets]);

  const handleDismiss = () => {
    setIsVisible(false);
    dismissAlert();
  };

  if (!isVisible || !hasNewTickets) return null;

  return (
    <>
      {/* Overlay escuro de fundo */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={handleDismiss}
      />
      
      {/* Modal centralizado */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto animate-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-2xl rounded-2xl px-10 py-8 flex flex-col items-center gap-6 border-4 border-white min-w-[450px] max-w-[500px]">
            <div className="bg-white rounded-full p-4 animate-bounce">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-bold mb-2">
                {newTicketsCount === 1 ? 'NOVO TICKET!' : `${newTicketsCount} NOVOS TICKETS!`}
              </h3>
              <p className="text-lg opacity-90">
                {newTicketsCount === 1 
                  ? 'Um novo chamado foi criado' 
                  : `${newTicketsCount} novos chamados foram criados`}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="bg-white text-red-600 hover:bg-gray-100 rounded-full px-8 py-3 font-bold transition-colors text-lg shadow-lg"
            >
              OK, ENTENDI
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
