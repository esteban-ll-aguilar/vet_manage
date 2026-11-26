## ADDED Requirements

### Requirement: Deactivate a client permanently
The system SHALL allow an authenticated user with the `clients:deactivate` permission to change an `ACTIVE` or `INACTIVE` client to `DEACTIVATED` via `PATCH /api/v1/clients/:clientId/deactivate` with the body `{ "reason": string }`. The client record, its person data and every linked patient SHALL be kept; nothing is deleted.

#### Scenario: Positive - deactivate an active client
- **WHEN** an authorized Manager sends `PATCH /api/v1/clients/:clientId/deactivate` with reason "Se mudó de ciudad" for an `ACTIVE` client
- **THEN** the system changes the client status to `DEACTIVATED`
- **AND** returns HTTP `200` with `{ id, status: "DEACTIVATED", deactivatedAt, deactivationReason }` and the message `"Cliente dado de baja correctamente"`
- **AND** the client, its person data and its patients still exist in the database

#### Scenario: Positive - deactivate an inactive client
- **WHEN** an authorized Veterinarian deactivates an `INACTIVE` client
- **THEN** the system changes the client status to `DEACTIVATED` with the same response and message

### Requirement: Store who, when and why
The system SHALL store, together with the client, the date and time of the deactivation (`deactivatedAt`), the user who performed it (`deactivatedById`) and the trimmed reason (`deactivationReason`). These values SHALL be returned when the client is consulted.

#### Scenario: Positive - deactivation data stored
- **WHEN** the Manager "Gabriel Gerente QA" deactivates a client with reason "  Solicitud del cliente  "
- **THEN** the client has `deactivatedAt` equal to the time of the action, `deactivatedById` equal to that Manager's user id and `deactivationReason` equal to "Solicitud del cliente"

### Requirement: Reason is mandatory
The system SHALL reject a deactivation without a reason. A reason made only of spaces SHALL be treated as missing. The reason SHALL have between 1 and 500 characters after trimming.

#### Scenario: Negative - missing reason
- **WHEN** an authorized user sends the deactivation without `reason` or with an empty `reason`
- **THEN** the system returns HTTP `400` with `"Ingrese el motivo de la baja"`
- **AND** the client status does not change and no audit record is created

#### Scenario: Negative - blank reason
- **WHEN** the reason contains only spaces
- **THEN** the system returns HTTP `400` with `"Ingrese el motivo de la baja"`

#### Scenario: Boundary - reason of 1 character
- **WHEN** the reason is "X"
- **THEN** the deactivation succeeds

#### Scenario: Boundary - reason of 500 characters
- **WHEN** the reason has exactly 500 characters
- **THEN** the deactivation succeeds and the full reason is stored

#### Scenario: Boundary - reason of 501 characters
- **WHEN** the reason has 501 characters
- **THEN** the system returns HTTP `400` with `"El motivo no puede superar 500 caracteres"` and the client does not change

### Requirement: Reject invalid deactivation targets
The system SHALL reject the deactivation when the client id is not a UUID, the client does not exist or is already `DEACTIVATED`.

#### Scenario: Negative - invalid id
- **WHEN** the client id is not a UUID
- **THEN** the system returns HTTP `400`

#### Scenario: Negative - client does not exist
- **WHEN** an authorized user deactivates a non-existent client UUID
- **THEN** the system returns HTTP `404` with `"Cliente no encontrado"`

#### Scenario: Negative - client already deactivated
- **WHEN** an authorized user deactivates a client that is already `DEACTIVATED`
- **THEN** the system returns HTTP `409` with `"El cliente está desactivado"`
- **AND** the stored deactivation data and audit records do not change

### Requirement: Deactivated client is read-only
The system SHALL keep a `DEACTIVATED` client and its patients available for consultation (`GET /api/v1/clients`, `GET /api/v1/clients/:clientId/pets`) and SHALL reject any change to it: update, inactivation and activation.

#### Scenario: Positive - consulting a deactivated client
- **WHEN** a Manager or Veterinarian consults a `DEACTIVATED` client
- **THEN** the system returns its data, its deactivation data and its patients

#### Scenario: Negative - editing a deactivated client
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId` for a `DEACTIVATED` client
- **THEN** the system keeps the existing HU-02 behavior: HTTP `409` with `"No se puede actualizar un cliente dado de baja"`

#### Scenario: Negative - inactivating or activating a deactivated client
- **WHEN** an authorized user sends the inactivate or activate request for a `DEACTIVATED` client
- **THEN** the system keeps the existing HU-04/HU-05 behavior and rejects it with HTTP `400`

### Requirement: Deactivated client blocked in new transactions
The system SHALL reject a `DEACTIVATED` client in new transactions of Module 1 with the message `"El cliente está desactivado"`. An `INACTIVE` client keeps the message accepted for HU-07.

#### Scenario: Negative - registering a patient for a deactivated client
- **WHEN** a Receptionist registers a patient for a `DEACTIVATED` client
- **THEN** the system returns HTTP `409` with `"El cliente está desactivado"` and the patient is not created

#### Scenario: Negative - registering a patient for an inactive client
- **WHEN** a Receptionist registers a patient for an `INACTIVE` client
- **THEN** the system keeps returning HTTP `409` with `"El cliente seleccionado no está disponible"`

### Requirement: Permission on the deactivation endpoint
The system SHALL require authentication and the `clients:deactivate` permission. According to the role matrix, only Manager and Veterinarian have it.

#### Scenario: Negative - Receptionist tries to deactivate
- **WHEN** an authenticated Receptionist or Veterinary Technician sends the deactivation request
- **THEN** the system returns HTTP `403` with `"No tiene permisos para realizar esta acción"`

#### Scenario: Negative - request without session
- **WHEN** the request has no valid token
- **THEN** the system returns HTTP `401`
