// Nombres de acciones y módulos que se guardan en la auditoría; cada HU agrega los que necesite.
export const AUDIT_ACTIONS = {
  register: 'Registrar',
  assignRoles: 'Asignar roles',
  inactivate: 'Inactivar',
  activate: 'Activar',
  deactivate: 'Dar de baja',
  changePassword: 'Cambiar contraseña',
  requestPasswordReset: 'Solicitar recuperación',
  resetPassword: 'Restablecer contraseña',
  update: 'Actualizar',
  deactivate: 'Dar de baja',
  managePermissions: 'Actualizar permisos',
} as const;

export const AUDIT_MODULES = {
  users: 'Usuarios',
  clients: 'Clientes',
  patients: 'Pacientes',
  species: 'Especies',
  breeds: 'Razas',
  roles: 'Permisos por rol',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
export type AuditModule = (typeof AUDIT_MODULES)[keyof typeof AUDIT_MODULES];
