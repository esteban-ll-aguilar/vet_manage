## ADDED Requirements

### Requirement: Request a recovery link
The system SHALL expose the public endpoint `POST /api/v1/auth/password-reset/request` with the body `{ "email": string }`. It SHALL always answer HTTP `200` with the message `"Si el correo está registrado, recibirá un enlace"`, whether or not the email belongs to an account. The email SHALL be compared without case and without surrounding spaces.

#### Scenario: Positive - active account requests a link
- **WHEN** the Cashier with the active account "ana@correo.com" requests recovery with that email
- **THEN** the system creates a recovery link valid for 30 minutes, sends it to "ana@correo.com" and answers `200` with `"Si el correo está registrado, recibirá un enlace"`

#### Scenario: Positive - email with other case and spaces
- **WHEN** the request uses " ANA@Correo.com "
- **THEN** the link is sent to the account "ana@correo.com"

#### Scenario: Negative - unknown email
- **WHEN** someone requests recovery with "otro@correo.com", which does not belong to any account
- **THEN** no link is created or sent and the answer is the same `200` with `"Si el correo está registrado, recibirá un enlace"`

#### Scenario: Negative - inactive or deactivated account
- **WHEN** someone requests recovery with the email of an `INACTIVE` or `DEACTIVATED` account
- **THEN** no link is created or sent and the answer is the same `200` message

#### Scenario: Negative - empty or malformed email
- **WHEN** the email is empty or does not have a valid format
- **THEN** the system answers HTTP `400` with `"Ingrese un correo electrónico válido"` and sends nothing

#### Scenario: Negative - mail server fails
- **WHEN** sending the email fails for an active account
- **THEN** the answer is still the same `200` message and the failure is written to the server log

### Requirement: Single-use link valid for 30 minutes
Each link SHALL contain a random token of at least 32 bytes. The system SHALL store only a hash of the token, its expiration (`PASSWORD_RESET_TTL_MINUTES`, 30 by default) and when it was used or replaced. A new request for the same account SHALL invalidate every previous unused link of that account.

#### Scenario: Positive - token not stored in plain text
- **WHEN** a link is created
- **THEN** the database stores only the hash of the token, never the token itself

#### Scenario: Negative - new request replaces the previous link
- **WHEN** the user requests a second link before using the first one
- **THEN** the first link is marked as replaced and only the second one can be used

### Requirement: Validate a link when it is opened
The system SHALL expose `GET /api/v1/auth/password-reset/validate?token=…` so that the reset screen can report the state of the link when it is opened. A link is valid while the current time is earlier than its expiration.

#### Scenario: Positive - valid link
- **WHEN** the link was created 10 minutes ago and was not used or replaced
- **THEN** the system answers HTTP `200` with `{ "valid": true }`

#### Scenario: Boundary - link at 29 minutes 59 seconds
- **WHEN** the link is opened 29 minutes and 59 seconds after it was created
- **THEN** the link is still valid

#### Scenario: Boundary - link at exactly 30 minutes
- **WHEN** the link is opened exactly 30 minutes after it was created
- **THEN** the system answers HTTP `410` with `"El enlace ha expirado. Solicite uno nuevo"`

#### Scenario: Negative - expired link
- **WHEN** the link was created more than 30 minutes ago and was not used or replaced
- **THEN** the system answers HTTP `410` with `"El enlace ha expirado. Solicite uno nuevo"`

#### Scenario: Negative - used, replaced or unknown link
- **WHEN** the link was already used, was replaced by a newer one, or the token does not exist
- **THEN** the system answers HTTP `400` with `"El enlace no es válido. Solicite uno nuevo"`

### Requirement: Reset the password with a valid link
The system SHALL expose the public endpoint `POST /api/v1/auth/password-reset/confirm` with `{ "token", "newPassword", "confirmPassword" }`. Validation order: link state (expired `410`, invalid `400`), empty fields (`400` `"Complete los campos obligatorios"`), confirmation (`400` `"Las contraseñas no coinciden"`), password policy (`400` `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"`). On success, in a single transaction, the system SHALL store the new password hash, set `mustChangePassword = false`, reset the failed login counter and the temporary lock, mark the link as used and close every open session of the account.

#### Scenario: Positive - successful reset
- **WHEN** the Cashier opens a link created 10 minutes ago, enters "NuevaClave2026" twice and saves
- **THEN** the password is updated and the system answers `200` with `"Contraseña actualizada. Inicie sesión con su nueva contraseña"`
- **AND** the Cashier can log in with "NuevaClave2026" and not with the old password

#### Scenario: Boundary - password of exactly 8 characters
- **WHEN** the new password is "Clave123" (8 characters with upper case, lower case and a number)
- **THEN** the password is accepted

#### Scenario: Boundary - password of 7 characters
- **WHEN** the new password is "Clave12" (7 characters)
- **THEN** the system answers `400` with `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"`

#### Scenario: Negative - password does not meet the rules
- **WHEN** the new password is "abc123"
- **THEN** the system answers `400` with `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"` and the link remains usable

#### Scenario: Negative - password without upper case or without a number
- **WHEN** the new password is "clave2026" or "ClaveSegura"
- **THEN** the system answers `400` with the password policy message

#### Scenario: Negative - confirmation does not match
- **WHEN** the confirmation is different from the new password
- **THEN** the system answers `400` with `"Las contraseñas no coinciden"` and the link remains usable

#### Scenario: Negative - empty fields
- **WHEN** the new password or the confirmation is empty
- **THEN** the system answers `400` with `"Complete los campos obligatorios"`

#### Scenario: Negative - expired link on confirm
- **WHEN** the link is 30 minutes old or more
- **THEN** the system answers `410` with `"El enlace ha expirado. Solicite uno nuevo"` and the password does not change

#### Scenario: Negative - link already used
- **WHEN** the user tries to use the same link a second time
- **THEN** the system answers `400` with `"El enlace no es válido. Solicite uno nuevo"`

#### Scenario: Positive - open sessions are closed
- **WHEN** the password is reset while the user has an open session in another browser
- **THEN** that session can no longer be renewed and the user must log in again

#### Scenario: Positive - locked account recovers access
- **WHEN** the account was temporarily locked by failed attempts and the password is reset
- **THEN** the lock and the failed attempts counter are cleared

### Requirement: Limit recovery requests
The system SHALL accept at most 3 recovery requests for the same email in a window of 15 minutes that starts with the first request (HU-58 Esc. 8). Extra requests SHALL get the same `200` message without creating or sending a new link.

#### Scenario: Boundary - third request in 15 minutes
- **WHEN** the same email requests recovery for the third time within 15 minutes
- **THEN** a new link is created and sent, replacing the previous one

#### Scenario: Boundary - fourth request in 15 minutes
- **WHEN** the same email requests recovery for the fourth time within 15 minutes
- **THEN** the answer is the same `200` message and no new link is created or sent

#### Scenario: Positive - request after the window
- **WHEN** 15 minutes have passed since the first request of the window
- **THEN** the email can request a new link again
