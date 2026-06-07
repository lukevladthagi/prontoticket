import { Hono } from 'hono';
import { getDataHoraBrasil } from '../utils/timezone';

const app = new Hono();

app.get('/timezone', async (c) => {
  const now = new Date();
  
  const debug = {
    // Hora do servidor
    serverTime: now.toISOString(),
    serverTimeLocal: now.toString(),
    
    // Informações do timezone
    timezoneOffset: now.getTimezoneOffset(),
    
    // Resultado da nossa função
    getDataHoraBrasil: getDataHoraBrasil(),
    
    // Cálculos detalhados
    calculations: {
      nowGetTime: now.getTime(),
      timezoneOffsetMinutes: now.getTimezoneOffset(),
      timezoneOffsetMs: now.getTimezoneOffset() * 60000,
      utcTime: now.getTime() + (now.getTimezoneOffset() * 60000),
      brasiliaOffset: 3 * 60 * 60 * 1000,
      brasiliaTime: (now.getTime() + (now.getTimezoneOffset() * 60000)) - (3 * 60 * 60 * 1000),
    },
    
    // Para comparação
    expectedBrasilTime: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString(),
  };
  
  return c.json(debug);
});

export default app;
