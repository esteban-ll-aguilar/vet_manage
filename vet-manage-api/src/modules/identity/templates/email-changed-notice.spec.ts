import { describe, expect, it } from 'vitest';
import { renderEmailChangedNotice } from './email-changed-notice.js';

describe('renderEmailChangedNotice', () => {
  it('informa el correo anterior y el nuevo', () => {
    const email = renderEmailChangedNotice({ firstName: 'Carlos', previousEmail: 'cperez@correo.com', newEmail: 'carlos.perez@correo.com' });

    expect(email.subject).toBe('Su correo de acceso a VetManage cambió');
    expect(email.text).toContain('Correo anterior: cperez@correo.com');
    expect(email.text).toContain('Correo nuevo: carlos.perez@correo.com');
    expect(email.html).toContain('carlos.perez@correo.com');
  });

  it('escapa los datos en el HTML', () => {
    const email = renderEmailChangedNotice({ firstName: '<b>Carlos</b>', previousEmail: 'a@x.com', newEmail: 'b@x.com' });

    expect(email.html).toContain('&lt;b&gt;Carlos&lt;/b&gt;');
    expect(email.html).not.toContain('<b>Carlos</b>');
  });
});
