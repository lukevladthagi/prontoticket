import { Resend } from 'resend';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function enviarEmail(env: Env, params: EmailParams): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada');
    return false;
  }

  const resend = new Resend(env.RESEND_API_KEY);

  try {
    console.log('Enviando email para:', params.to);
    const result = await resend.emails.send({
      from: 'Central de Chamados TI <onboarding@resend.dev>',
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    
    console.log('Email enviado com sucesso:', result);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
    return false;
  }
}

export function formatarEmailNotificacao(
  titulo: string,
  mensagem: string,
  chamadoNumero?: string,
  chamadoUrl?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Central de Chamados TI</h1>
          </div>
          <div class="content">
            <h2 style="color: #1f2937; margin-top: 0;">${titulo}</h2>
            <p style="font-size: 16px; color: #4b5563;">${mensagem}</p>
            ${chamadoNumero ? `<p style="margin-top: 20px;"><strong>Chamado:</strong> ${chamadoNumero}</p>` : ''}
            ${chamadoUrl ? `<a href="${chamadoUrl}" class="button">Ver Chamado</a>` : ''}
          </div>
          <div class="footer">
            <p>Esta é uma notificação automática. Por favor, não responda este email.</p>
            <p>Central de Chamados TI - Hospital</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
