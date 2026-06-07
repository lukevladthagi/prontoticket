/**
 * Utilitários para conversão de datas para o horário do Brasil (UTC-3)
 */

/**
 * Converte uma data/hora do banco para objeto Date
 * NOTA: O banco já salva em horário Brasil (UTC-3), então não fazemos conversão aqui
 * @param dataString - String de data em formato ISO ou timestamp
 * @returns Date
 */
export function converterParaHorarioBrasil(dataString: string | Date): Date {
  const data = typeof dataString === 'string' ? new Date(dataString) : dataString;
  return data;
}

/**
 * Formata uma data no formato brasileiro com horário
 * @param dataString - String de data em formato ISO ou timestamp
 * @returns String formatada: "DD/MM/YYYY HH:MM"
 */
export function formatarDataHoraBrasil(dataString: string | Date): string {
  const data = converterParaHorarioBrasil(dataString);
  
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

/**
 * Formata apenas a data no formato brasileiro
 * @param dataString - String de data em formato ISO ou timestamp
 * @returns String formatada: "DD/MM/YYYY"
 */
export function formatarDataBrasil(dataString: string | Date): string {
  const data = converterParaHorarioBrasil(dataString);
  
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata apenas o horário no formato brasileiro
 * @param dataString - String de data em formato ISO ou timestamp
 * @returns String formatada: "HH:MM"
 */
export function formatarHorarioBrasil(dataString: string | Date): string {
  const data = converterParaHorarioBrasil(dataString);
  
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  
  return `${hora}:${minuto}`;
}

/**
 * Retorna a data/hora atual do Brasil
 */
export function getHorarioBrasilAtual(): Date {
  // Subtrair 3 horas do horário UTC do navegador para obter Brasil
  const now = new Date();
  return new Date(now.getTime() - (3 * 60 * 60 * 1000));
}
