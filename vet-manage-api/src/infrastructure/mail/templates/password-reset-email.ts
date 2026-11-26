import type { RenderedEmail } from './credentials-email.js';
import { escapeHtml, renderEmailLayout } from './email-layout.js';

export type PasswordResetEmailInput = {
  firstName: string;
  resetUrl: string;
  ttlMinutes: number;
};

// Correo con el enlace de un solo uso para restablecer la contraseña (HU-58).
export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const subject = 'Restablezca su contraseña de VetManage';
  const validity = `${input.ttlMinutes} ${input.ttlMinutes === 1 ? 'minuto' : 'minutos'}`;

  const text = [
    `Hola ${input.firstName},`,
    '',
    'Recibimos una solicitud para restablecer la contraseña de su cuenta en VetManage.',
    '',
    `Abra este enlace para crear una nueva contraseña: ${input.resetUrl}`,
    '',
    `El enlace es válido durante ${validity} y solo se puede usar una vez.`,
    'Si usted no lo solicitó, ignore este correo: su contraseña actual seguirá funcionando.',
  ].join('\n');

  const body = `
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#17202a;">Hola, ${escapeHtml(input.firstName)}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#596674;">
        Recibimos una solicitud para restablecer la contraseña de su cuenta en VetManage. Use el botón para crear una nueva.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="background:#4c7dff;border-radius:10px;">
        <a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Restablecer contraseña</a>
      </td></tr></table>
      <p style="margin:0 0 26px;font-size:12px;line-height:1.6;color:#7b88a3;word-break:break-all;">
        Si el botón no funciona, copie este enlace en su navegador:<br />${escapeHtml(input.resetUrl)}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ea;border:1px solid #f5dfb8;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#9a6420;">
        <strong>Importante:</strong> el enlace es válido durante ${escapeHtml(validity)} y solo se puede usar una vez. Si usted no lo solicitó, ignore este correo.
      </td></tr></table>`;

  return { subject, text, html: renderEmailLayout({ title: subject, preheader: 'Enlace para restablecer su contraseña', body }) };
}
