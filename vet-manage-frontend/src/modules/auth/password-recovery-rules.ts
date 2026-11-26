// Reglas y mensajes de la recuperación de contraseña (HU-58).
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Misma regla que la API (common/security/password-policy.ts).
export const PASSWORD_POLICY = /^(?=.*\p{Ll})(?=.*\p{Lu})(?=.*\d).{8,}$/u;

export const RECOVERY_MESSAGES = {
  invalidEmail: 'Ingrese un correo electrónico válido',
  requested: 'Si el correo está registrado, recibirá un enlace',
  expired: 'El enlace ha expirado. Solicite uno nuevo',
  invalidLink: 'El enlace no es válido. Solicite uno nuevo',
  missing: 'Complete los campos obligatorios',
  mismatch: 'Las contraseñas no coinciden',
  weak: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
  connection: 'No se pudo conectar con el servidor. Intente nuevamente.',
} as const;
