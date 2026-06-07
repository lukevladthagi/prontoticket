// @ts-nocheck
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import type { MochaUser } from "@getmocha/users-service/shared";

// Import routes
import chamadosRouter from "./routes/chamados";
import chamadosAnexosRouter from "./routes/chamados-anexos";
import categoriasRouter from "./routes/categorias";
import notificacoesRouter from "./routes/notificacoes";
import userProfilesRouter from "./routes/user-profiles";
import dashboardRouter from "./routes/dashboard";
import unidadesRouter from "./routes/unidades";
import slasRouter from "./routes/slas";
import gruposRouter from "./routes/grupos";
import artigosKBRouter from "./routes/artigos-kb";
import artigosKBAnexosRouter from "./routes/artigos-kb-anexos";
import uploadEditorImageRouter from "./routes/upload-editor-image";
import projetosRouter from "./routes/projetos";
import projetoDocumentosRouter from "./routes/projeto-documentos";
import contratosRouter from "./routes/contratos";
import ativosRouter from "./routes/ativos";
import setoresRouter from "./routes/setores";
import whatsappRouter from "./routes/whatsapp";
import whatsappTestRouter from "./routes/whatsapp-test";
import whatsappDebugRouter from "./routes/whatsapp-debug";
import whatsappSimpleTestRouter from "./routes/whatsapp-simple-test";
import whatsappDiagnosticoRouter from "./routes/whatsapp-diagnostico";
import whatsappTestProducaoRouter from "./routes/whatsapp-test-producao";
import whatsappRawCaptureRouter from "./routes/whatsapp-raw-capture";
import whatsappSimpleRouter from "./routes/whatsapp-simple";
import whatsappInspectRouter from "./routes/whatsapp-inspect";
import whatsappPingRouter from "./routes/whatsapp-ping";
import telegramRouter from "./routes/telegram";
import telegramMessagesRouter from "./routes/telegram-messages";
import authRouter from "./routes/auth";
import filesRouter from "./routes/files";
import anexosRouter from "./routes/anexos";
import historicoRouter from "./routes/historico";
import chamadosRecorrentesRouter from "./routes/chamados-recorrentes";
import manutencoesPreventivas from "./routes/manutencoes-preventivas";
import cronRouter from "./routes/cron";
import cronGamificacaoRouter from "./routes/cron-gamificacao";
import senhasTIRouter from "./routes/senhas-ti";
import diagnosticoSLAHotelariaRouter from "./routes/diagnostico-sla-hotelaria";
import permissoesRouter from "./routes/permissoes";
import permissionsRouter from "./routes/permissions";
import cleanupRouter from "./routes/cleanup";
import fixSlaRouter from "./routes/fix-sla";
import fixSetoresRouter from "./routes/fix-setores";
import diagnosticoSlaRouter from "./routes/diagnostico-sla";
import diagnosticoChamadosRouter from "./routes/diagnostico-chamados";
import gamificacaoRouter from "./routes/gamificacao";
import badgesRouter from "./routes/badges";
import filasRouter from "./routes/filas";
import userSetoresAcessoRouter from "./routes/user-setores-acesso";
import relatorioTicketsRouter from "./routes/relatorio-tickets";
import relatorioAvaliacoesRouter from "./routes/relatorio-avaliacoes";
import relatorioGamificacaoRouter from "./routes/relatorio-gamificacao";
import relatorioClassificacaoRouter from "./routes/relatorio-classificacao";
import diagnosticoSetoresRouter from "./routes/diagnostico-setores";
import diagnosticoDashboardRouter from "./routes/diagnostico-dashboard";
import fixTipoProblemaRouter from "./routes/fix-tipo-problema";
import fixTipoProblemaV2Router from "./routes/fix-tipo-problema-v2";
import fixCategoriasTelegramRouter from "./routes/fix-categorias-telegram";
import debugTimezoneRouter from "./routes/debug-timezone";
import auditoriaSlaRouter from "./routes/auditoria-sla";
import diagnosticoColunasRouter from "./routes/diagnostico-colunas";
import fixSetorSolicitanteRouter from "./routes/fix-setor-solicitante";
import fixTelegramNullRouter from "./routes/fix-telegram-null";
import relatorioSetoresRouter from "./routes/relatorio-setores";
import diagnosticoFechamentoRouter from "./routes/diagnostico-fechamento";
import diagnosticoSlaNuloRouter from "./routes/diagnostico-sla-nulo";
import corrigirSlaReclassificadoRouter from "./routes/corrigir-sla-reclassificado";
import fixSlaTelegramRouter from "./routes/fix-sla-telegram";
import fixSlaReabertoMvRouter from "./routes/fix-sla-reaberto-mv";
import fixSetorRecorrenteRouter from "./routes/fix-setor-recorrente";
import analiseSlaRouter from "./routes/analise-sla";
import limparPrazoRespostaRouter from "./routes/limpar-prazo-resposta";
import diagnosticoTicketRouter from "./routes/diagnostico-ticket";
import corrigirSlaPausadoRouter from "./routes/corrigir-sla-pausado";
import fixManutencaoTiRouter from "./routes/fix-manutencao-ti";
import avaliacoesPendentesRouter from "./routes/avaliacoes-pendentes";
import corrigirSlaSetoresRouter from "./routes/corrigir-sla-setores";

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// CORS middleware
app.use("/*", cors());

// Logger global para debug - TEMPORÁRIO
app.use("/api/whatsapp*", async (c, next) => {
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  console.log(`[GLOBAL LOGGER] ${method} ${path}`);
  
  // Salvar no banco para debug
  try {
    const env = c.env as any;
    await env.DB.prepare(`
      INSERT INTO whatsapp_conversas (telefone, chat_id, phone_number, mensagem, tipo)
      VALUES (?, ?, ?, ?, 'debug')
    `).bind('logger', 'logger', method, path).run();
  } catch (e) {
    console.error('[GLOBAL LOGGER] Erro ao salvar:', e);
  }
  
  await next();
});

// Auth endpoints
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "Código de autorização não fornecido" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const user = c.get("user");
  
  // Criar ou atualizar perfil do usuário automaticamente
  if (user) {
    try {
      // Primeiro verificar se já existe um perfil com esse user_id
      const existingProfile = await c.env.DB.prepare(`
        SELECT id FROM user_profiles WHERE user_id = ?
      `).bind(user.id).first();

      if (!existingProfile) {
        // Verificar se existe um perfil com o mesmo email (vindo do Telegram/WhatsApp)
        const profileByEmail = await c.env.DB.prepare(`
          SELECT id, perfil FROM user_profiles WHERE email = ? AND user_id IS NULL
        `).bind(user.email).first();

        if (profileByEmail) {
          // Vincular o user_id do Google ao perfil existente
          await c.env.DB.prepare(`
            UPDATE user_profiles 
            SET user_id = ?, 
                nome = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            user.id,
            user.google_user_data?.name || user.google_user_data?.given_name || user.email.split('@')[0],
            profileByEmail.id
          ).run();
        } else {
          // Criar perfil automaticamente com perfil padrão "solicitante"
          await c.env.DB.prepare(`
            INSERT INTO user_profiles (user_id, email, nome, perfil, ativo)
            VALUES (?, ?, ?, 'solicitante', 1)
          `).bind(
            user.id,
            user.email,
            user.google_user_data?.name || user.google_user_data?.given_name || user.email.split('@')[0]
          ).run();
        }
      }
    } catch (error) {
      console.error('Erro ao criar perfil do usuário:', error);
    }
  }
  
  return c.json(user);
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// Teste Twilio direto
app.get("/api/twilio-test", async (c) => {
  const env = c.env as any;
  const phone = c.req.query('phone') || '+15557903312';
  
  try {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_WHATSAPP_NUMBER;
    
    if (!accountSid) return c.json({ error: 'TWILIO_ACCOUNT_SID não configurado' });
    if (!authToken) return c.json({ error: 'TWILIO_AUTH_TOKEN não configurado' });
    if (!from) return c.json({ error: 'TWILIO_WHATSAPP_NUMBER não configurado' });
    
    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: '✅ Teste TicketHPC'
      })
    });

    const result = await response.json();
    
    return c.json({ 
      ok: response.ok,
      status: response.status,
      from,
      to,
      twilio: result
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Protected routes
app.route("/api/user-profiles", userProfilesRouter);
app.route("/api/chamados", chamadosRouter);
app.route("/api/chamados", chamadosAnexosRouter);
app.route("/api/categorias", categoriasRouter);
app.route("/api/notificacoes", notificacoesRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/unidades", unidadesRouter);
app.route("/api/slas", slasRouter);
app.route("/api/grupos", gruposRouter);
app.route("/api/artigos-kb", artigosKBRouter);
app.route("/api/artigos-kb", artigosKBAnexosRouter);
app.route("/api/upload-editor-image", uploadEditorImageRouter);
app.route("/api/projetos", projetosRouter);
app.route("/api/projeto-documentos", projetoDocumentosRouter);
app.route("/api/contratos", contratosRouter);
app.route("/api/ativos", ativosRouter);
app.route("/api/setores", setoresRouter);
app.route("/api/whatsapp", whatsappRouter);
app.route("/api/whatsapp-test", whatsappTestRouter);
app.route("/api/whatsapp-debug", whatsappDebugRouter);
app.route("/api/whatsapp-simple-test", whatsappSimpleTestRouter);
app.route("/api/whatsapp-diagnostico", whatsappDiagnosticoRouter);
app.route("/api/whatsapp-test-producao", whatsappTestProducaoRouter);
app.route("/api/whatsapp-raw-capture", whatsappRawCaptureRouter);
app.route("/api/whatsapp-simple", whatsappSimpleRouter);
app.route("/api/whatsapp-inspect", whatsappInspectRouter);
app.route("/api/whatsapp-ping", whatsappPingRouter);
app.route("/api/telegram", telegramRouter);
app.route("/api/telegram-messages", telegramMessagesRouter);
app.route("/api/auth", authRouter);
app.route("/api/files", filesRouter);
app.route("/api/anexos", anexosRouter);
app.route("/api/historico", historicoRouter);
app.route("/api/chamados-recorrentes", chamadosRecorrentesRouter);
app.route("/api/manutencoes-preventivas", manutencoesPreventivas);
app.route("/api/cron", cronRouter);
app.route("/api/cron/gamificacao", cronGamificacaoRouter);
app.route("/api/senhas-ti", senhasTIRouter);
app.route("/api/permissoes", permissoesRouter);
app.route("/api/permissions", permissionsRouter);
app.route("/api/cleanup", cleanupRouter);
app.route("/api/fix-sla", fixSlaRouter);
app.route("/api/fix-setores", fixSetoresRouter);
app.route("/api/diagnostico-sla", diagnosticoSlaRouter);
app.route("/api/diagnostico-chamados", diagnosticoChamadosRouter);
app.route("/api/diagnostico-sla-hotelaria", diagnosticoSLAHotelariaRouter);
app.route("/api/gamificacao", gamificacaoRouter);
app.route("/api/badges", badgesRouter);
app.route("/api/filas", filasRouter);
app.route("/api/user-setores-acesso", userSetoresAcessoRouter);
app.route("/api/relatorio-tickets", relatorioTicketsRouter);
app.route("/api/relatorio-avaliacoes", relatorioAvaliacoesRouter);
app.route("/api/relatorio-gamificacao", relatorioGamificacaoRouter);
app.route("/api/relatorio-classificacao", relatorioClassificacaoRouter);
app.route("/api/diagnostico-setores", diagnosticoSetoresRouter);
app.route("/api/diagnostico-dashboard", diagnosticoDashboardRouter);
app.route("/api/fix-tipo-problema", fixTipoProblemaRouter);
app.route("/api/fix-tipo-problema-v2", fixTipoProblemaV2Router);
app.route("/api/fix-categorias-telegram", fixCategoriasTelegramRouter);
app.route("/api/debug", debugTimezoneRouter);
app.route("/api/auditoria-sla", auditoriaSlaRouter);
app.route("/api/diagnostico-colunas", diagnosticoColunasRouter);
app.route("/api/fix-setor-solicitante", fixSetorSolicitanteRouter);
app.route("/api/fix-telegram-null", fixTelegramNullRouter);
app.route("/api/relatorio-setores", relatorioSetoresRouter);
app.route("/api/diagnostico-fechamento", diagnosticoFechamentoRouter);
app.route("/api/diagnostico-sla-nulo", diagnosticoSlaNuloRouter);
app.route("/api/corrigir-sla-reclassificado", corrigirSlaReclassificadoRouter);
app.route("/api/fix-sla-telegram", fixSlaTelegramRouter);
app.route("/api/fix-sla-reaberto-mv", fixSlaReabertoMvRouter);
app.route("/api/fix-setor-recorrente", fixSetorRecorrenteRouter);
app.route("/api/analise-sla", analiseSlaRouter);
app.route("/api/limpar-prazo-resposta", limparPrazoRespostaRouter);
app.route("/api/diagnostico-ticket", diagnosticoTicketRouter);
app.route("/api/corrigir-sla-pausado", corrigirSlaPausadoRouter);
app.route("/api/fix-manutencao-ti", fixManutencaoTiRouter);
app.route("/api/avaliacoes-pendentes", avaliacoesPendentesRouter);
app.route("/api/corrigir-sla-setores", corrigirSlaSetoresRouter);

// Endpoint manual para processar recorrentes (temporário para testes)
app.get("/api/processar-recorrentes-manual", async (c) => {
  const { processarChamadosRecorrentes } = await import('./scheduled');
  await processarChamadosRecorrentes(c.env);
  return c.json({ success: true, message: "Processamento de recorrentes executado" });
});

// Debug: verificar recorrentes no banco
app.get("/api/debug-recorrentes", async (c) => {
  const { results: recorrentes } = await c.env.DB.prepare(
    "SELECT id, titulo, frequencia, ativo, proximo_chamado_em, created_at FROM chamados_recorrentes ORDER BY created_at DESC"
  ).all();
  
  const { results: chamados } = await c.env.DB.prepare(
    "SELECT id, numero, titulo, origem_recorrente_id, created_at FROM chamados WHERE origem_recorrente_id IS NOT NULL ORDER BY created_at DESC LIMIT 10"
  ).all();
  
  return c.json({ 
    total_recorrentes: recorrentes.length,
    recorrentes,
    chamados_gerados: chamados.length,
    chamados
  });
});

// Teste simples do Twilio
app.get("/api/test-twilio", async (c) => {
  const env = c.env as any;
  const phone = c.req.query('phone');
  
  try {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_WHATSAPP_NUMBER;
    
    if (!phone) return c.json({ error: 'Adicione ?phone=+5511999999999' });
    if (!accountSid) return c.json({ error: 'TWILIO_ACCOUNT_SID não configurado' });
    if (!authToken) return c.json({ error: 'TWILIO_AUTH_TOKEN não configurado' });
    if (!from) return c.json({ error: 'TWILIO_WHATSAPP_NUMBER não configurado' });
    
    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: '✅ Teste do TicketHPC - funcionando!'
      })
    });

    const result = await response.json();
    
    return c.json({ 
      success: response.ok,
      status: response.status,
      from,
      to,
      result
    });
    
  } catch (error) {
    return c.json({ 
      error: String(error),
      message: error instanceof Error ? error.message : undefined
    }, 500);
  }
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const { processarChamadosRecorrentes, processarManutencoesPreventivas, resetarGamificacaoMensal } = await import('./scheduled');
    ctx.waitUntil(Promise.all([
      processarChamadosRecorrentes(env),
      processarManutencoesPreventivas(env),
      resetarGamificacaoMensal(env)
    ]));
  },
};
