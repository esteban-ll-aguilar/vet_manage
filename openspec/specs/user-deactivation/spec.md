# user-deactivation Specification

## Purpose

Baja definitiva de cuentas de usuario del personal (`PATCH /api/v1/users/:id/deactivate`), conservando historial clínico y registros de auditoría, revocando sesiones abiertas y protegiendo cuentas con rol de Cliente (HU-61, RF-65).

## Requirements

### Requirement: Permanently deactivate active or inactive staff accounts
The system SHALL allow an authenticated user with `users:deactivate` to permanently deactivate an `ACTIVE` or `INACTIVE` staff user account when a non-empty deactivation reason is provided, recording `deactivatedAt`, `deactivationReason`, revoking active sessions, preserving historical records, and recording an atomic audit log.

#### Scenario: Successful deactivation of active user
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/deactivate` with `{ "reason": "Renuncia" }` for an `ACTIVE` Veterinarian account
- **THEN** the account status becomes `DEACTIVATED` with `deactivatedAt` and `deactivationReason = "Renuncia"`
- **AND** open sessions are revoked so the user's next action returns HTTP `401`
- **AND** subsequent login attempts fail with `"Su cuenta se encuentra desactivada. Contacte al administrador"`
- **AND** the response message is `"Usuario dado de baja correctamente"`

#### Scenario: Successful deactivation of inactive user
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/deactivate` with a valid reason for an `INACTIVE` account
- **THEN** the account status becomes `DEACTIVATED`

#### Scenario: Historical records are preserved
- **WHEN** a user with clinical or audit records is deactivated
- **THEN** the user and person records remain intact so existing clinical attentions and audit logs continue displaying the user's name

### Requirement: Deactivation requires a reason and protects operational integrity
The system SHALL reject deactivation requests without a reason, targeting one's own account, targeting the last active Administrator, targeting an already deactivated account, or sent without `users:deactivate`.

#### Scenario: Missing reason
- **WHEN** the Administrator confirms deactivation without entering a reason
- **THEN** the system rejects the request with `"Ingrese el motivo de la baja"` and leaves the user unchanged

#### Scenario: Self-deactivation blocked
- **WHEN** an Administrator attempts to deactivate their own account
- **THEN** the system rejects the request with `"No puede dar de baja su propia cuenta"`

#### Scenario: Last active administrator protected
- **WHEN** only one active Administrator exists and an attempt is made to deactivate that account
- **THEN** the system rejects the request with `"Debe existir al menos un Administrador activo"`

#### Scenario: Unauthorized actor
- **WHEN** a user without `users:deactivate` calls `PATCH /api/v1/users/:id/deactivate`
- **THEN** the system responds with HTTP `403` and `"No tiene permisos para realizar esta acción"`

### Requirement: Staff accounts that are also Clients retain Client access
When a person holds both `STAFF` role(s) and an active `CLIENT` role, staff deactivation SHALL remove only the `STAFF` role assignments and preserve the `CLIENT` role and `ACTIVE` login access.

#### Scenario: Staff member who is also a Client
- **WHEN** "Ana Ruiz" holds `cashier` (`STAFF`) and `client` (`CLIENT`) and the Administrator deactivates her staff account
- **THEN** only the `cashier` role assignment is removed
- **AND** Ana can continue logging in as `Cliente`

### Requirement: Deactivated users cannot be activated, edited, or assigned roles in the UI
The users management UI SHALL show `"Dar de baja"` only to users with `users:deactivate` on `ACTIVE` and `INACTIVE` accounts, SHALL require a reason with confirmation (`"Cancelar"` leaves the account unchanged), and SHALL hide `"Activar"`, `"Editar"`, `"Gestionar roles"`, and `"Dar de baja"` for `DEACTIVATED` accounts while displaying deactivation date and reason in read-only detail view.

#### Scenario: Deactivated user actions hidden
- **WHEN** the Administrator views a `DEACTIVATED` user in `/users`
- **THEN** `"Activar"`, `"Editar"`, `"Gestionar roles"`, and `"Dar de baja"` are not offered
- **AND** `"Ver datos"` displays the read-only record including `Fecha de baja` and `Motivo de la baja`
