import type { RenderedEmail } from '../../../infrastructure/mail/templates/credentials-email.js';
import { escapeHtml, renderEmailLayout } from '../../../infrastructure/mail/templates/email-layout.js';

export type EmailChangedNoticeInput = {
  firstName: string;
  previousEmail: string;
  newEmail: string;
};

// Aviso al correo anterior de que el correo de acceso cambió (HU-53).
export function renderEmailChangedNotice(input: EmailChangedNoticeInput): RenderedEmail {
  const subject = 'Su correo de acceso a VetManage cambió';

  const text = [
    `Hola ${input.firstName},`,
    '',
    'El administrador de su clínica cambió el correo con el que inicia sesión en VetManage.',
    '',
    `Correo anterior: ${input.previousEmail}`,
    `Correo nuevo: ${input.newEmail}`,
    '',
    'Desde ahora inicie sesión con el correo nuevo y su contraseña actual.',
    'Si usted no solicitó este cambio, comuníquese con el administrador de su clínica.',
  ].join('\n');

  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e3eaff;font-size:12px;color:#7b88a3;width:38%;vertical-align:top;">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e3eaff;font-size:14px;color:#26323d;font-weight:600;vertical-align:top;">${value}</td>
        </tr>`;

  const body = `
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#17202a;">Hola, ${escapeHtml(input.firstName)}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#596674;">
        El administrador de su clínica cambió el correo con el que inicia sesión en VetManage.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8ff;border:1px solid #dce7ff;border-radius:12px;padding:6px 20px;margin-bottom:26px;">
        ${row('Correo anterior', escapeHtml(input.previousEmail))}
        ${row('Correo nuevo', escapeHtml(input.newEmail))}
      </table>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#596674;">Desde ahora inicie sesión con el correo nuevo y su contraseña actual.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ea;border:1px solid #f5dfb8;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#9a6420;">
        <strong>¿No reconoce este cambio?</strong> Comuníquese con el administrador de su clínica.
      </td></tr></table>`;

  return { subject, text, html: renderEmailLayout({ title: subject, preheader: 'Su correo de acceso cambió', body }) };
}
