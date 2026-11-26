# client-activation Specification

## Purpose

Activación de un cliente inactivo en la API (`PATCH /api/v1/clients/:clientId/activate`, HU-05, RF-05): transición `INACTIVE → ACTIVE`, rechazo de clientes dados de baja (riesgo R-05), auditoría con fecha y usuario, permiso `clients:activate` y disponibilidad del cliente en nuevas transacciones.

## Requirements
### Requirement: Activate an inactive client
The system SHALL allow an authenticated user with the `clients:activate` permission to change an `INACTIVE` client to `ACTIVE` via `PATCH /api/v1/clients/:clientId/activate`, preserving the client's personal data and all linked pets and clinical histories.

#### Scenario: Successful client activation
- **WHEN** an authorized Receptionist, Manager, or Veterinarian sends `PATCH /api/v1/clients/:clientId/activate` for an `INACTIVE` client
- **THEN** the system updates the client status to `ACTIVE`
- **AND** returns HTTP `200` with `{ id, status: "ACTIVE" }` and message `"Cliente activado correctamente"`
- **AND** preserves all personal information, pets, and clinical records linked to the client

#### Scenario: Idempotent activation of an already active client
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId/activate` for a client that is already `ACTIVE`
- **THEN** the system returns HTTP `200` with `{ id, status: "ACTIVE" }` and message `"Cliente activado correctamente"`
- **AND** does not write the client nor create an audit log

### Requirement: Reject invalid client activation targets
The system SHALL reject activation when the client does not exist or has status `DEACTIVATED`, so that a permanently deactivated client cannot return to clinic operations.

#### Scenario: Client does not exist
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId/activate` for a non-existent client UUID
- **THEN** the system returns HTTP `404` with `"Cliente no encontrado"`

#### Scenario: Client is permanently deactivated
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId/activate` for a client with status `DEACTIVATED`
- **THEN** the system rejects the request with HTTP `400`, code `CLIENT_STATUS_DEACTIVATED` and `"No se puede activar un cliente dado de baja"`
- **AND** the client remains `DEACTIVATED`
- **AND** no audit log is created

#### Scenario: Invalid client identifier
- **WHEN** an authorized user sends `PATCH /api/v1/clients/not-a-uuid/activate`
- **THEN** the system rejects the request with HTTP `400` without changing any client

### Requirement: Audit client activation
The system SHALL record each effective activation in the audit log, in the same transaction as the status change, with the date, the responsible user, action `"Activar"`, module `"Clientes"`, the affected client, previous value `{ status: "Inactivo" }` and new value `{ status: "Activo" }`.

#### Scenario: Audit log of a successful activation
- **WHEN** an authorized user activates an `INACTIVE` client
- **THEN** the audit log contains one record with the actor's id, the occurrence date, action `"Activar"`, module `"Clientes"`, `{ status: "Inactivo" }` as previous value and `{ status: "Activo" }` as new value

### Requirement: Activated client is available for new transactions
An activated client SHALL be selectable again in new clinic transactions that require an active client, such as registering a new patient, and SHALL keep its stored information and linked pets available for consultation.

#### Scenario: Registering a patient for an activated client
- **WHEN** a client that was `INACTIVE` is activated and a user then registers a new patient for that client
- **THEN** the system accepts the client and does not return `"El cliente seleccionado no está disponible"`

#### Scenario: Consulting an activated client and their pets
- **WHEN** an authorized Receptionist, Manager, or Veterinarian queries `GET /api/v1/clients` or `GET /api/v1/clients/:clientId/pets` for an activated client
- **THEN** the system returns the same personal information and linked pets the client had before the activation

### Requirement: Enforce permission on client activation endpoint
The system SHALL require authentication and the `clients:activate` permission on `PATCH /api/v1/clients/:clientId/activate`.

#### Scenario: Request without session
- **WHEN** a request without a valid access token is sent to `PATCH /api/v1/clients/:clientId/activate`
- **THEN** the system returns HTTP `401`

#### Scenario: User without permission attempts to activate a client
- **WHEN** an authenticated user without `clients:activate` (e.g., Veterinary Technician or Cashier) sends `PATCH /api/v1/clients/:clientId/activate`
- **THEN** the system rejects the request with HTTP `403` and `"No tiene permisos para realizar esta acción"`
- **AND** the client status does not change

