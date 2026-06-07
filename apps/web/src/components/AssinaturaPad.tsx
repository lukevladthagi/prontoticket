"use client";

import { useRef, useEffect, useState } from 'react';
import { Eraser, Upload, Pen } from 'lucide-react';

interface AssinaturaPadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function AssinaturaPad({ onSave, onCancel }: AssinaturaPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Configurar canvas para alta resolução
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    context.scale(2, 2);

    // Estilo da linha
    context.strokeStyle = '#000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Fundo branco
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImage(dataUrl);
      setIsEmpty(false);
    };
    reader.readAsDataURL(file);
  };

  const saveSignature = () => {
    if (mode === 'upload') {
      if (uploadedImage) {
        onSave(uploadedImage);
      }
    } else {
      const canvas = canvasRef.current;
      if (!canvas || isEmpty) return;

      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const handleModeChange = (newMode: 'draw' | 'upload') => {
    setMode(newMode);
    setIsEmpty(true);
    setUploadedImage(null);
    if (newMode === 'draw') {
      clearCanvas();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Assinatura</h3>
        
        {/* Abas para escolher modo */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            onClick={() => handleModeChange('draw')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              mode === 'draw'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pen size={18} />
            Desenhar
          </button>
          <button
            onClick={() => handleModeChange('upload')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              mode === 'upload'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload size={18} />
            Fazer Upload
          </button>
        </div>

        {/* Área de assinatura */}
        {mode === 'draw' ? (
          <div className="border-2 border-gray-300 rounded-lg mb-4 bg-white">
            <canvas
              ref={canvasRef}
              className="w-full h-64 touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg mb-4 bg-gray-50 p-8">
            {uploadedImage ? (
              <div className="text-center">
                <img
                  src={uploadedImage}
                  alt="Assinatura"
                  className="max-h-48 mx-auto mb-4"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Escolher outra imagem
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-600 mb-4">
                  Clique para fazer upload de uma imagem da sua assinatura
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Selecionar Imagem
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Formatos aceitos: PNG, JPG, JPEG
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-3">
          {mode === 'draw' && (
            <button
              onClick={clearCanvas}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Eraser size={18} />
              Limpar
            </button>
          )}
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={saveSignature}
            disabled={isEmpty}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salvar Assinatura
          </button>
        </div>
      </div>
    </div>
  );
}
