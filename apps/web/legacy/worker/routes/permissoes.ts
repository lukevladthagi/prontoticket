import { Hono } from 'hono';
import { authMiddleware } from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';
import type { UserProfile } from '../../shared/types';

const app = new Hono<{ Bindings: Env; Variables: { user?: MochaUser } }>();

// Listar todas as funcionalidades com suas permissões
app.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Acesso negado' }, 401);
  }

  const db = c.env.DB;

  // Verificar se o usuário é gestor ou admin
  const profile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(user.id).first() as UserProfile | null;

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: 'Acesso negado - apenas gestores e admins podem gerenciar permissões' }, 403);
  }
  
  try {
    const funcionalidades = await db.prepare(`
      SELECT * FROM funcionalidades 
      WHERE ativo = 1 
      ORDER BY categoria, ordem, nome
    `).all();

    const permissoes = await db.prepare(`
      SELECT * FROM permissoes
    `).all();

    // Agrupar funcionalidades por categoria
    const categorias: Record<string, any[]> = {};
    for (const func of funcionalidades.results) {
      const categoria = func.categoria as string;
      if (!categorias[categoria]) {
        categorias[categoria] = [];
      }
      
      // Encontrar permissões desta funcionalidade
      const permsFunc = permissoes.results.filter(
        (p: any) => p.funcionalidade_id === func.id
      );
      
      categorias[categoria].push({
        ...func,
        permissoes: permsFunc
      });
    }

    return c.json({ categorias });
  } catch (error) {
    console.error('Erro ao listar funcionalidades:', error);
    return c.json({ error: 'Erro ao listar funcionalidades' }, 500);
  }
});

// Verificar se usuário tem permissão para uma funcionalidade
app.get('/verificar/:codigo', authMiddleware, async (c) => {
  const codigo = c.req.param('codigo');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ permitido: false }, 401);
  }

  const db = c.env.DB;
  
  try {
    // Buscar perfil do usuário
    const profile = await db.prepare(
      'SELECT perfil FROM user_profiles WHERE user_id = ?'
    ).bind(user.id).first() as UserProfile | null;

    if (!profile) {
      return c.json({ permitido: false }, 403);
    }

    // Admins sempre têm acesso
    if (profile.perfil === 'admin') {
      return c.json({ permitido: true });
    }

    const result = await db.prepare(`
      SELECT p.permitido 
      FROM funcionalidades f
      JOIN permissoes p ON f.id = p.funcionalidade_id
      WHERE f.codigo = ? AND p.perfil = ? AND f.ativo = 1
    `).bind(codigo, profile.perfil).first();

    return c.json({ permitido: result ? result.permitido === 1 : false });
  } catch (error) {
    console.error('Erro ao verificar permissão:', error);
    return c.json({ error: 'Erro ao verificar permissão' }, 500);
  }
});

// Atualizar permissão de um perfil para uma funcionalidade
app.put('/:funcionalidadeId/:perfil', authMiddleware, async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Acesso negado' }, 401);
  }

  const db = c.env.DB;

  // Verificar se o usuário é gestor ou admin
  const profile = await db.prepare(
    'SELECT perfil FROM user_profiles WHERE user_id = ?'
  ).bind(user.id).first() as UserProfile | null;

  if (!profile || (profile.perfil !== 'admin' && profile.perfil !== 'gestor')) {
    return c.json({ error: 'Acesso negado - apenas gestores e admins podem gerenciar permissões' }, 403);
  }

  const funcionalidadeId = parseInt(c.req.param('funcionalidadeId'));
  const perfil = c.req.param('perfil');
  const { permitido } = await c.req.json();
  
  try {
    // Verificar se a permissão já existe
    const existing = await db.prepare(`
      SELECT id FROM permissoes 
      WHERE funcionalidade_id = ? AND perfil = ?
    `).bind(funcionalidadeId, perfil).first();

    if (existing) {
      // Atualizar
      await db.prepare(`
        UPDATE permissoes 
        SET permitido = ?, updated_at = CURRENT_TIMESTAMP
        WHERE funcionalidade_id = ? AND perfil = ?
      `).bind(permitido ? 1 : 0, funcionalidadeId, perfil).run();
    } else {
      // Criar
      await db.prepare(`
        INSERT INTO permissoes (funcionalidade_id, perfil, permitido)
        VALUES (?, ?, ?)
      `).bind(funcionalidadeId, perfil, permitido ? 1 : 0).run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar permissão:', error);
    return c.json({ error: 'Erro ao atualizar permissão' }, 500);
  }
});

export default app;
