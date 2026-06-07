import { Hono } from "hono";
import { resetarPontosMensais } from "../services/gamificacao";

const router = new Hono<{ Bindings: Env }>();

// Endpoint para resetar pontos mensais (chamado automaticamente no dia 1 de cada mês)
router.post("/resetar-mensal", async (c) => {
  // Validar token secreto
  const authHeader = c.req.header("Authorization");
  const expectedToken = c.env.CRON_SECRET_TOKEN;

  if (!expectedToken) {
    return c.json({ error: "CRON_SECRET_TOKEN não configurado" }, 500);
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return c.json({ error: "Token inválido" }, 401);
  }

  try {
    await resetarPontosMensais(c.env.DB);
    
    return c.json({
      sucesso: true,
      mensagem: "Pontos mensais resetados e histórico salvo com sucesso",
      data_execucao: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao resetar pontos mensais:', error);
    return c.json({
      error: "Erro ao resetar pontos mensais",
      detalhes: error instanceof Error ? error.message : "Erro desconhecido"
    }, 500);
  }
});

export default router;
