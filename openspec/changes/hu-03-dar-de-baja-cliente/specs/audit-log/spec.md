## ADDED Requirements

### Requirement: Catalog action for deactivation
The shared audit catalog SHALL include the action "Dar de baja" (`AUDIT_ACTIONS.deactivate`), used by every module that performs a permanent deactivation.

#### Scenario: Positive - deactivation action name
- **WHEN** any client is deactivated
- **THEN** the audit record uses the catalog action "Dar de baja"

### Requirement: Client deactivation audited
The system SHALL create an audit record, in the same transaction as the deactivation and with the authenticated user as the actor, when a client is deactivated. The record SHALL have the action "Dar de baja", the module "Clientes", the client's identification and full name as affected record, `previousValue` `{ "status": "Activo" | "Inactivo" }` and `newValue` `{ "status": "De baja", "reason": <reason> }`. A rejected deactivation SHALL NOT leave an audit record.

#### Scenario: Positive - active client deactivated
- **WHEN** the Veterinarian deactivates the active client "1105017030 - Pedro Castillo" with reason "Se mudó de ciudad"
- **THEN** an audit record is created with action "Dar de baja", module "Clientes", affected record containing "1105017030" and "Pedro Castillo", previous value `{ "status": "Activo" }` and new value `{ "status": "De baja", "reason": "Se mudó de ciudad" }`

#### Scenario: Negative - rejected deactivation
- **WHEN** the deactivation is rejected because the reason is missing, the client does not exist or is already deactivated
- **THEN** no audit record is created

#### Scenario: Negative - audit write fails
- **WHEN** writing the audit record fails during a deactivation
- **THEN** the client keeps its previous status and the request fails
