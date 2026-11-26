## ADDED Requirements

### Requirement: Catalog actions for password recovery
The shared audit catalog SHALL include the actions "Solicitar recuperación" (`AUDIT_ACTIONS.requestPasswordReset`) and "Restablecer contraseña" (`AUDIT_ACTIONS.resetPassword`).

#### Scenario: Positive - recovery action names
- **WHEN** a user requests a recovery link and later resets the password
- **THEN** the audit records use the catalog actions "Solicitar recuperación" and "Restablecer contraseña" with the module "Usuarios"

### Requirement: Password recovery audited without secrets
Because these endpoints have no session, the actor of the audit record SHALL be the owner of the account. The system SHALL create, in the same transaction as the action:
- a record "Solicitar recuperación", module "Usuarios", when a link is created for an active account;
- a record "Restablecer contraseña", module "Usuarios", when the password is reset.

The affected record SHALL be the person's identification and full name. The records SHALL NOT store the token, the link, the password or its hash. Requests for unknown, inactive or deactivated accounts and requests discarded by the request limit SHALL NOT create audit records.

#### Scenario: Positive - link requested for an active account
- **WHEN** the Cashier "1105011850 - Camilo Cajero QA" requests a recovery link
- **THEN** an audit record is created with user Camilo Cajero QA, role "Cajero", action "Solicitar recuperación", module "Usuarios" and affected record containing "1105011850" and "Camilo Cajero QA"

#### Scenario: Positive - password reset
- **WHEN** the Cashier resets the password with a valid link
- **THEN** an audit record is created with action "Restablecer contraseña", module "Usuarios" and no previous or new value

#### Scenario: Negative - unknown email or limit reached
- **WHEN** a recovery is requested for an email that does not belong to an account, or the request limit was reached
- **THEN** no audit record is created

#### Scenario: Negative - rejected reset
- **WHEN** the reset is rejected because the link expired, is invalid or the password does not meet the rules
- **THEN** no audit record is created
