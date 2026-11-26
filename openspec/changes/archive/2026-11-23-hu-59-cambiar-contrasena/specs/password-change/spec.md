## ADDED Requirements

### Requirement: Change password for authenticated user
The system SHALL allow any authenticated user with an active account to change their password via `POST /api/v1/auth/change-password` by providing `currentPassword`, `newPassword`, and `confirmPassword`, updating the stored password hash and setting `mustChangePassword` to `false`.

#### Scenario: Successful password change
- **WHEN** an authenticated user submits their correct `currentPassword`, a valid `newPassword` different from the current one, and a matching `confirmPassword`
- **THEN** the system hashes and stores the new password, sets `mustChangePassword` to `false`
- **AND** returns HTTP `200` with message `"Contraseña actualizada correctamente"`

### Requirement: Validate current password
The system SHALL verify `currentPassword` against the stored hash before applying any change.

#### Scenario: Incorrect current password
- **WHEN** an authenticated user submits an incorrect `currentPassword`
- **THEN** the system rejects the request with HTTP `400`
- **AND** returns `"La contraseña actual no es correcta"`
- **AND** does not modify the stored password

### Requirement: Enforce password strength policy
The system SHALL require `newPassword` to have at least 8 characters, at least one uppercase letter, at least one lowercase letter, and at least one digit.

#### Scenario: New password does not meet policy rules
- **WHEN** an authenticated user submits `"clave1"` as `newPassword`
- **THEN** the system rejects the request with HTTP `400`
- **AND** returns `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"`

### Requirement: Validate password confirmation and non-reuse
The system SHALL require `confirmPassword` to match `newPassword`, and SHALL reject a `newPassword` equal to the current password.

#### Scenario: Confirmation does not match new password
- **WHEN** an authenticated user submits a `confirmPassword` different from `newPassword`
- **THEN** the system rejects the request with HTTP `400`
- **AND** returns `"Las contraseñas no coinciden"`

#### Scenario: New password equals current password
- **WHEN** an authenticated user submits the same password as both `currentPassword` and `newPassword`
- **THEN** the system rejects the request with HTTP `400`
- **AND** returns `"La nueva contraseña debe ser diferente a la actual"`

### Requirement: Require authentication without role restriction
The system SHALL require a valid active session (`@Authenticated()`) on `POST /api/v1/auth/change-password` without restricting by specific role or permission.

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated caller sends `POST /api/v1/auth/change-password`
- **THEN** the system rejects the request with HTTP `401`
