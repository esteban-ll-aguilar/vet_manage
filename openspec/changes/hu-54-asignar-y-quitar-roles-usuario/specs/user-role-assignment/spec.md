## ADDED Requirements

### Requirement: Current and available roles can be queried for a user
The system SHALL expose an endpoint protected by `users:assign-roles` that returns, for a target user, their current effective roles and the staff roles available to assign. Current effective roles SHALL include only active, non-expired assignments to active roles. Available roles SHALL include active `STAFF` roles not present in the current effective roles.

#### Scenario: Roles currently assigned are excluded from available options
- **WHEN** an administrator with `users:assign-roles` queries role assignment for "Carlos Pérez" who has the role Recepcionista
- **THEN** the response includes Recepcionista in current roles
- **AND** the available roles do not include Recepcionista

#### Scenario: User not found
- **WHEN** an administrator queries role assignment for a user identifier that does not exist
- **THEN** the response is 404 with the standard error envelope

### Requirement: An administrator can assign an additional role to a user
The system SHALL allow an administrator with `users:assign-roles` to add an active staff role to a user while preserving the user's existing effective roles, persisting the assignment for subsequent access resolution.

#### Scenario: Assign an additional role
- **WHEN** "Carlos Pérez" has the role Recepcionista and the administrator saves the assignment including the role "Cajero"
- **THEN** the user's effective roles include Recepcionista and Cajero
- **AND** the Cajero permissions are available to that user on subsequent authenticated requests and next sign-in

### Requirement: An administrator can remove a role and change a user's function
The system SHALL allow an administrator with `users:assign-roles` to remove roles from a user and to replace the full effective role set in a single update, so the resulting effective roles match the saved selection.

#### Scenario: Remove one of several roles
- **WHEN** "Carlos Pérez" has the roles Recepcionista and Cajero and the administrator saves the assignment without "Cajero"
- **THEN** the user's effective roles include only Recepcionista
- **AND** Cajero permissions are not available on subsequent authenticated requests and next sign-in

#### Scenario: Change function by replacing roles
- **WHEN** "Carlos Pérez" has the role Recepcionista and the administrator saves the assignment removing Recepcionista and adding "Veterinario"
- **THEN** the user's effective roles include only Veterinario
- **AND** Veterinario permissions are available on subsequent authenticated requests and next sign-in

### Requirement: Role updates enforce business invariants
The system SHALL reject role updates that would leave a user without any effective role, that would remove the `administrator` role from the last active Administrator, or that target a deactivated user, and SHALL perform the update atomically.

#### Scenario: Removing the only role is rejected
- **WHEN** "Carlos Pérez" has only the role Recepcionista and the administrator attempts to save an empty effective role set
- **THEN** the response is 400 with message "El usuario debe tener al menos un rol"
- **AND** the user's roles remain unchanged

#### Scenario: Removing the last active Administrator is rejected
- **WHEN** only one active user has an effective `administrator` role and an administrator attempts to save that user's roles without `administrator`
- **THEN** the response is 400 with message "Debe existir al menos un Administrador activo"
- **AND** that user's roles remain unchanged

#### Scenario: Modifying roles of a deactivated user is rejected
- **WHEN** the user "Luis Ríos" has status DEACTIVATED and an administrator attempts to update their roles
- **THEN** the response is 400 with message "No se pueden modificar los roles de un usuario dado de baja"
- **AND** the user's roles remain unchanged

### Requirement: Role assignment requires authentication and permission
The system SHALL reject unauthenticated role-assignment requests with HTTP 401 and authenticated users without `users:assign-roles` with HTTP 403 and the message "No tiene permisos para realizar esta acción", using the standard error envelope.

#### Scenario: Request without a valid session
- **WHEN** an unauthenticated request attempts to query or update a user's roles
- **THEN** the response is 401 with the standard error envelope

#### Scenario: User without permission
- **WHEN** an authenticated Veterinario without `users:assign-roles` attempts to change another user's roles
- **THEN** the response is 403 with the message "No tiene permisos para realizar esta acción"
