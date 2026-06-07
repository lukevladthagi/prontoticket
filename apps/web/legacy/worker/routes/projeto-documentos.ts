import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";
import type { UserProfile } from "../../shared/types";
import { getDataHoraBrasil } from "../utils/timezone";

interface ProjetoDocumento {
  id: number;
  projeto_id: number;
  tipo: 'abertura' | 'encerramento';
  conteudo: string;
  assinatura_gerente_url: string | null;
  assinatura_gerente_nome: string | null;
  assinatura_gerente_data: string | null;
  assinatura_sponsor_url: string | null;
  assinatura_sponsor_nome: string | null;
  assinatura_sponsor_data: string | null;
  assinatura_aprovador_url: string | null;
  assinatura_aprovador_nome: string | null;
  assinatura_aprovador_data: string | null;
  status: 'Rascunho' | 'Aguardando assinaturas' | 'Assinado';
  criador_id: string;
  criador_nome: string;
  created_at: string;
  updated_at: string;
}

const router = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar documentos de um projeto
router.get("/:projetoId", authMiddleware, async (c) => {
  const projetoId = c.req.param("projetoId");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projeto_documentos WHERE projeto_id = ? ORDER BY created_at DESC"
  ).bind(projetoId).all<ProjetoDocumento>();

  return c.json(results);
});

// Buscar documento específico
router.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const documento = await c.env.DB.prepare(
    "SELECT * FROM projeto_documentos WHERE id = ?"
  ).bind(id).first<ProjetoDocumento>();

  if (!documento) {
    return c.json({ error: "Documento não encontrado" }, 404);
  }

  return c.json(documento);
});

// Criar novo documento (upload de PDF)
router.post("/:projetoId", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const projetoId = c.req.param("projetoId");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const tipo = formData.get('tipo') as string;

  if (!file || !tipo) {
    return c.json({ error: "Arquivo e tipo são obrigatórios" }, 400);
  }

  if (file.type !== 'application/pdf') {
    return c.json({ error: "Apenas arquivos PDF são permitidos" }, 400);
  }

  // Upload do PDF para R2
  const fileName = `projetos/${projetoId}/${tipo}_${Date.now()}.pdf`;
  const arrayBuffer = await file.arrayBuffer();
  
  if (!c.env.R2_BUCKET) {
    return c.json({ error: "Armazenamento não disponível" }, 500);
  }
  
  await c.env.R2_BUCKET.put(fileName, arrayBuffer, {
    httpMetadata: { contentType: 'application/pdf' }
  });

  const documentoUrl = `https://019b70ea-2ee4-7efb-bf84-ec44f0dfafc1.mochausercontent.com/${fileName}`;

  // Salvar no banco de dados
  const result = await c.env.DB.prepare(
    `INSERT INTO projeto_documentos (
      projeto_id, tipo, conteudo, status, criador_id, criador_nome
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    projetoId,
    tipo,
    documentoUrl,
    'Aguardando assinaturas',
    user.id,
    profile.nome
  ).run();

  const documento = await c.env.DB.prepare(
    "SELECT * FROM projeto_documentos WHERE id = ?"
  ).bind(result.meta.last_row_id).first<ProjetoDocumento>();

  return c.json(documento, 201);
});

// Atualizar documento
router.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || !['gestor', 'admin'].includes(profile.perfil)) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE projeto_documentos SET 
      conteudo = ?, status = ?, updated_at = ?
     WHERE id = ?`
  ).bind(body.conteudo, body.status, getDataHoraBrasil(), id).run();

  const documento = await c.env.DB.prepare(
    "SELECT * FROM projeto_documentos WHERE id = ?"
  ).bind(id).first<ProjetoDocumento>();

  return c.json(documento);
});

// Assinar documento
router.post("/:id/assinar", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  const body = await c.req.json();
  const { assinatura_data_url, papel } = body; // papel: 'gerente', 'sponsor', 'aprovador'

  // Converter data URL para blob e fazer upload para R2
  const base64Data = assinatura_data_url.split(',')[1];
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  
  const fileName = `assinaturas/${id}_${papel}_${Date.now()}.png`;
  
  if (!c.env.R2_BUCKET) {
    return c.json({ error: "Armazenamento não disponível" }, 500);
  }
  
  await c.env.R2_BUCKET.put(fileName, binaryData, {
    httpMetadata: { contentType: 'image/png' }
  });

  const assinaturaUrl = `https://019b70ea-2ee4-7efb-bf84-ec44f0dfafc1.mochausercontent.com/${fileName}`;

  // Atualizar documento com assinatura
  let updateQuery = '';
  if (papel === 'gerente') {
    updateQuery = `UPDATE projeto_documentos SET 
      assinatura_gerente_url = ?,
      assinatura_gerente_nome = ?,
      assinatura_gerente_data = ?,
      updated_at = ?
     WHERE id = ?`;
  } else if (papel === 'sponsor') {
    updateQuery = `UPDATE projeto_documentos SET 
      assinatura_sponsor_url = ?,
      assinatura_sponsor_nome = ?,
      assinatura_sponsor_data = ?,
      updated_at = ?
     WHERE id = ?`;
  } else if (papel === 'aprovador') {
    updateQuery = `UPDATE projeto_documentos SET 
      assinatura_aprovador_url = ?,
      assinatura_aprovador_nome = ?,
      assinatura_aprovador_data = ?,
      updated_at = ?
     WHERE id = ?`;
  }

  await c.env.DB.prepare(updateQuery).bind(assinaturaUrl, profile.nome, getDataHoraBrasil(), getDataHoraBrasil(), id).run();

  // Verificar se todas as assinaturas necessárias foram coletadas
  const documento = await c.env.DB.prepare(
    "SELECT * FROM projeto_documentos WHERE id = ?"
  ).bind(id).first<ProjetoDocumento>();

  if (documento) {
    const todasAssinadas = 
      documento.assinatura_gerente_url && 
      documento.assinatura_sponsor_url && 
      documento.assinatura_aprovador_url;

    if (todasAssinadas && documento.status !== 'Assinado') {
      await c.env.DB.prepare(
        `UPDATE projeto_documentos SET status = 'Assinado', updated_at = ? WHERE id = ?`
      ).bind(getDataHoraBrasil(), id).run();
    }
  }

  const documentoAtualizado = await c.env.DB.prepare(
    "SELECT * FROM projeto_documentos WHERE id = ?"
  ).bind(id).first<ProjetoDocumento>();

  return c.json(documentoAtualizado);
});

// Deletar documento
router.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first<UserProfile>();

  if (!profile || profile.perfil !== 'admin') {
    return c.json({ error: "Acesso negado" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM projeto_documentos WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

export default router;
