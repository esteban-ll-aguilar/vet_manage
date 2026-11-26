import { describe, expect, it } from 'vitest';
import { renderPasswordResetEmail } from './password-reset-email.js';

const input = {
  firstName: 'Ana',
  resetUrl: 'http://localhost:5174/reset-password?token=abc_DEF-123',
  ttlMinutes: 30,
};

describe('renderPasswordResetEmail (HU-58)', () => {
  it('incluye el enlace y la vigencia de 30 minutos en el texto y en el HTML', () => {
    const { subject, text, html } = renderPasswordResetEmail(input);

    expect(subject).toBe('Restablezca su contraseña de VetManage');
    for (const part of [input.resetUrl, '30 minutos', 'solo se puede usar una vez']) {
      expect(text).toContain(part);
      expect(html).toContain(part);
    }
    expect(html).toContain('Restablecer contraseña');
  });

  it('usa el singular cuando la vigencia es de 1 minuto', () => {
    expect(renderPasswordResetEmail({ ...input, ttlMinutes: 1 }).text).toContain('1 minuto ');
  });

  it('escapa los valores dinámicos en el HTML', () => {
    const { html } = renderPasswordResetEmail({ ...input, firstName: '<b>Ana</b>', resetUrl: 'http://x/?a="1"&b=2' });

    expect(html).not.toContain('<b>Ana</b>');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(html).toContain('&quot;1&quot;&amp;b=2');
  });

  it('no depende de imágenes externas', () => {
    expect(renderPasswordResetEmail(input).html).not.toMatch(/<img/i);
  });
});
