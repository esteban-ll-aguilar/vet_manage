## ADDED Requirements

### Requirement: Administrators can manage a user's roles from the user interface
The system SHALL provide a user interface, reachable from the users consultation by users with `users:assign-roles`, that displays the selected user's current effective roles and the roles available to assign, and SHALL allow saving an updated set of roles.

#### Scenario: Add an additional role and save
- **WHEN** an administrator opens role management for "Carlos Pérez" who has Recepcionista, selects "Cajero" as an additional role, and saves
- **THEN** the interface confirms the update and shows Recepcionista and Cajero as the user's current roles

#### Scenario: Remove a role and save
- **WHEN** an administrator opens role management for "Carlos Pérez" who has Recepcionista and Cajero, removes "Cajero", and saves
- **THEN** the interface confirms the update and shows only Recepcionista as the user's current roles

#### Scenario: Change function and save
- **WHEN** an administrator replaces Recepcionista with "Veterinario" for "Carlos Pérez" and saves
- **THEN** the interface confirms the update and shows only Veterinario as the user's current roles

### Requirement: The interface prevents invalid role selections
The system SHALL only offer roles that are not currently assigned to the user, SHALL prevent saving a selection with no roles, and SHALL display the business error messages returned by the system when an update is rejected.

#### Scenario: Already assigned roles are not offered
- **WHEN** "Carlos Pérez" already has the role Recepcionista and the administrator opens the list of roles to assign
- **THEN** Recepcionista is not shown as an assignable option

#### Scenario: Saving without any role is blocked
- **WHEN** a user has only Recepcionista and the administrator removes it without selecting another role and attempts to save
- **THEN** the interface prevents the change and shows "El usuario debe tener al menos un rol"

#### Scenario: Removing the last active Administrator is reported
- **WHEN** the administrator attempts to remove the `administrator` role from the only active Administrator and the system rejects the update
- **THEN** the interface shows "Debe existir al menos un Administrador activo" and keeps the previous role assignment visible

#### Scenario: Deactivated user cannot be modified
- **WHEN** the administrator attempts to change roles for "Luis Ríos" who is deactivated and the system rejects the update
- **THEN** the interface shows "No se pueden modificar los roles de un usuario dado de baja"

### Requirement: Access to role management is restricted
The system SHALL deny access to role management for users without `users:assign-roles` and SHALL display "No tiene permisos para realizar esta acción".

#### Scenario: User without permission
- **WHEN** an authenticated Veterinario without `users:assign-roles` navigates to role management for a user
- **THEN** the application denies access with "No tiene permisos para realizar esta acción"
- **AND** the role management controls are not rendered
