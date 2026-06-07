/**
 * Utilitários para trabalhar com fuso horário do Brasil (Brasília/Ceará - UTC-3)
 */

/**
 * Retorna a data/hora atual no fuso horário de Brasília (UTC-3)
 * Formato ISO para salvar no banco de dados
 */
export function getDataHoraBrasil(): string {
  const now = new Date();
  
  // Converter para UTC primeiro (eliminando qualquer offset do servidor)
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  
  // Brasília é UTC-3, então subtraímos 3 horas do horário UTC
  const brasiliaTime = utcTime - (3 * 60 * 60 * 1000);
  
  // Retornar no formato ISO sem o Z no final
  return new Date(brasiliaTime).toISOString().replace('Z', '').slice(0, 19);
}

/**
 * Converte uma data UTC para horário de Brasília
 */
export function converterParaBrasilia(dataUTC: Date): Date {
  const utcTime = dataUTC.getTime() + (dataUTC.getTimezoneOffset() * 60000);
  const brasiliaTime = utcTime - (3 * 60 * 60 * 1000);
  return new Date(brasiliaTime);
}

/**
 * Retorna a data/hora atual como objeto Date no horário de Brasília
 */
export function getDataBrasil(): Date {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = utcTime - (3 * 60 * 60 * 1000);
  return new Date(brasiliaTime);
}
