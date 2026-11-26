## ADDED Requirements

### Requirement: Inactivate an active user account
The system SHALL allow an authenticated user with the `users:change-status` permission to change an `ACTIVE` user account to `INACTIVE` via `PATCH /api/v1/users/:id/status` with `{ "status": "INACTIVE" }`, preserving all historical records and roles associated with that user.

#### Scenario: Successful inactivation
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/status` with `{ "status": "INACTIVE" }` for an `ACTIVE` Veterinarian account
- **THEN** the system updates the user status to `INACTIVE`
- **AND** returns HTTP `200` with the updated user status and a confirmation message
- **AND** preserves all clinical records, audit logs, and role assignments of that user

### Requirement: Reactivate an inactive user account
The system SHALL allow an authenticated user with the `users:change-status` permission to change an `INACTIVE` user account back to `ACTIVE` via `PATCH /api/v1/users/:id/status` with `{ "status": "ACTIVE" }`, allowing the user to log in again with their existing credentials and roles.

#### Scenario: Successful reactivation
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/status` with `{ "status": "ACTIVE" }` for an `INACTIVE` user account
- **THEN** the system updates the user status to `ACTIVE`
- **AND** returns HTTP `200` with the updated user status and a confirmation message
- **AND** the user can log in again with the same credentials and previously assigned roles

### Requirement: Terminate active sessions upon inactivation
When a user account is changed to `INACTIVE`, the system SHALL revoke all non-revoked `UserSession` records of that user within the same transaction, and any subsequent authenticated request made with an existing access token SHALL be rejected with HTTP `401`.

#### Scenario: User with an open session is inactivated
- **WHEN** a user has an active session and an Administrator inactivates their account
- **THEN** all active refresh sessions of that user are marked as revoked
- **AND** the user's next request to any protected endpoint is rejected with HTTP `401`
- **AND** attempting to refresh the session fails with HTTP `401`

#### Scenario: Inactive user attempts to log in
- **WHEN** an `INACTIVE` user submits valid credentials to login
- **THEN** the system denies access
- **AND** returns the message `"Su cuenta se encuentra desactivada. Contacte al administrador"`

### Requirement: Prevent self-inactivation
The system SHALL reject any attempt by an authenticated user to inactivate their own account.

#### Scenario: Administrator tries to inactivate their own account
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/status` with `{ "status": "INACTIVE" }` using their own user ID
- **THEN** the system rejects the request with HTTP `400`
- **AND** returns the message `"No puede inactivar su propia cuenta"`
- **AND** the account remains `ACTIVE`

### Requirement: Protect the last active administrator
The system SHALL reject inactivating a user account if that user holds an active, non-expired `administrator` role and no other `ACTIVE` user holds an active, non-expired `administrator` role.

#### Scenario: Attempt to inactivate the last active administrator
- **WHEN** only one `ACTIVE` user has the `administrator` role and an authorized actor attempts to inactivate that user
- **THEN** the system rejects the request with HTTP `400`
- **AND** returns the message `"Debe existir al menos un Administrador activo"`
- **AND** the account remains `ACTIVE`

### Requirement: Protect permanently deactivated accounts and invalid inputs
The system SHALL reject status changes on `DEACTIVATED` accounts, non-existent users, or invalid target statuses.

#### Scenario: Attempt to change status of a deactivated user
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/status` for a user whose status is `DEACTIVATED`
- **THEN** the system rejects the request with HTTP `400`
- **AND** the user remains `DEACTIVATED`

#### Scenario: Target user does not exist
- **WHEN** an Administrator sends `PATCH /api/v1/users/:id/status` for a non-existent user ID
- **THEN** the system rejects the request with HTTP `404` with `"Usuario no encontrado"`

### Requirement: Enforce permission on user status endpoint
The system SHALL require authentication and the `users:change-status` permission on `PATCH /api/v1/users/:id/status`.

#### Scenario: User without permission attempts to change account status
- **WHEN** an authenticated Receptionist without `users:change-status` sends `PATCH /api/v1/users/:id/status`
- **THEN** the system rejects the request with HTTP `403`
- **AND** returns the message `"No tiene permisos para realizar esta acción"`
