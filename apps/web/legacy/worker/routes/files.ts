import { Hono } from 'hono';
import { authMiddleware } from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

const files = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Upload de arquivo para R2
files.post('/upload', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'Nenhum arquivo fornecido' }, 400);
    }

    if (!c.env.R2_BUCKET) {
      return c.json({ error: 'Storage não configurado' }, 500);
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const key = `uploads/${timestamp}-${randomStr}.${ext}`;

    // Determinar content-type correto baseado na extensão
    const mimeTypes: Record<string, string> = {
      // Imagens
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      // Documentos Word
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Documentos Excel
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Documentos PowerPoint
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // PDFs e outros
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
    };
    
    const contentType = (ext && mimeTypes[ext]) || file.type || 'application/octet-stream';

    // Fazer upload para R2
    await c.env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: contentType,
      },
      customMetadata: {
        originalName: file.name,
      },
    });

    return c.json({
      success: true,
      key,
      url: key,
      nome_arquivo: file.name,
      tipo_arquivo: file.type,
      tamanho: file.size,
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return c.json({ error: 'Erro ao fazer upload do arquivo' }, 500);
  }
});

// Baixar arquivo do R2
files.get('/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key');
    
    console.log('Tentando buscar arquivo:', key);
    
    if (!c.env.R2_BUCKET) {
      console.error('R2_BUCKET não configurado');
      return c.json({ error: 'Storage não configurado' }, 500);
    }
    
    const object = await c.env.R2_BUCKET.get(key);
    
    if (!object) {
      console.error('Arquivo não encontrado no R2:', key);
      return c.json({ error: 'Arquivo não encontrado' }, 404);
    }

    console.log('Arquivo encontrado:', {
      key,
      tamanho: object.size,
      contentType: object.httpMetadata?.contentType
    });

    const headers = new Headers();
    
    // Configurar content-type
    let contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    
    // Detecção de MIME type baseada na extensão do arquivo
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      // Imagens
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      // Documentos Word
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Documentos Excel
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Documentos PowerPoint
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // PDFs e outros
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
    };
    
    // Se não tem content-type correto, usar baseado na extensão
    if (contentType === 'application/octet-stream' && ext && mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }
    
    headers.set('Content-Type', contentType);
    
    // Configurar cache
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.httpEtag);
    
    // Pegar nome original do arquivo se disponível
    const originalName = object.customMetadata?.originalName || key.split('/').pop() || 'download';
    
    // Determinar se deve abrir no navegador ou fazer download
    const inlineTypes = [
      'image/',           // Todas as imagens
      'application/pdf',  // PDFs
      'text/plain',       // Arquivos de texto
    ];
    
    const shouldOpenInline = inlineTypes.some(type => contentType.startsWith(type));
    
    if (shouldOpenInline) {
      // Abrir no navegador
      headers.set('Content-Disposition', 'inline');
    } else {
      // Fazer download com nome original do arquivo
      const encodedFileName = encodeURIComponent(originalName);
      headers.set('Content-Disposition', `attachment; filename="${originalName}"; filename*=UTF-8''${encodedFileName}`);
    }
    
    // CORS para permitir acesso de qualquer origem
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    
    return c.body(object.body, { headers });
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    return c.json({ error: 'Erro ao baixar arquivo' }, 500);
  }
});

export default files;
