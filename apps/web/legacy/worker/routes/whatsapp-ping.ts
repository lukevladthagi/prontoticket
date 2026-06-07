import { Hono } from 'hono';

const whatsappPing = new Hono();

whatsappPing.post('/', async (c) => {
  return c.text('PONG');
});

whatsappPing.get('/', async (c) => {
  return c.text('PING-GET');
});

export default whatsappPing;
