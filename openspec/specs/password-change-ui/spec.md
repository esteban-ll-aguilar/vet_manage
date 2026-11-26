# password-change-ui Specification

## Purpose

Pantalla `/change-password` (`ChangePasswordPage`), acceso desde el menú de usuario y guardia obligatoria en primer ingreso cuando `mustChangePassword` está activo (HU-59).

## Requirements

### Requirement: Change password form and client-side validations
The frontend SHALL provide a `/change-password` page (`ChangePasswordPage`) accessible from the user menu, allowing any authenticated user to enter their current password, new password, and confirmation, and submit with `"Guardar"`.

#### Scenario: Successful voluntary password change
- **WHEN** an authenticated user opens `/change-password`, enters valid current password, new password, and matching confirmation, and clicks `"Guardar"`
- **THEN** the UI calls `POST /api/v1/auth/change-password`
- **AND** displays `"Contraseña actualizada correctamente"`

#### Scenario: Client-side validation errors displayed
- **WHEN** the user submits a weak password (`"clave1"`), mismatched confirmation, or a new password equal to the current password
- **THEN** the UI blocks submission and displays the corresponding HU-59 error message

#### Scenario: Backend error displayed
- **WHEN** the backend rejects the request with `"La contraseña actual no es correcta"`
- **THEN** the UI displays `"La contraseña actual no es correcta"` in an alert banner

### Requirement: Enforce mandatory password change on first login
When `session.mustChangePassword` is `true`, the application SHALL redirect the user to `/change-password` immediately after login and SHALL redirect back to `/change-password` whenever the user attempts to navigate to any other protected route until the password change succeeds.

#### Scenario: First login with temporary password redirects to change password
- **WHEN** a user logs in and the session has `mustChangePassword: true`
- **THEN** the application redirects to `/change-password` before allowing access to other screens

#### Scenario: Attempting to bypass mandatory password change
- **WHEN** a user with `mustChangePassword: true` attempts to open another protected route (e.g., `/` or `/clients`)
- **THEN** `RequireAuth` redirects the user back to `/change-password`

#### Scenario: Completing mandatory password change unlocks navigation
- **WHEN** a user with `mustChangePassword: true` successfully updates their password
- **THEN** `session.mustChangePassword` becomes `false` and the user can access the rest of the application
