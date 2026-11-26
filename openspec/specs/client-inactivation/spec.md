# client-inactivation Specification

## Purpose

Inactivación temporal de clientes (`PATCH /api/v1/clients/:clientId/inactivate`), protegiendo el acceso mediante `clients:inactivate`, conservando datos y mascotas vinculadas, y restringiendo el uso de clientes inactivos en nuevas transacciones (HU-04, RF-04).

## Requirements

### Requirement: Inactivate an active client
The system SHALL allow an authenticated user with the `clients:inactivate` permission to change an `ACTIVE` client to `INACTIVE` via `PATCH /api/v1/clients/:clientId/inactivate`, preserving the client's personal data and all linked pets and clinical histories.

#### Scenario: Successful client inactivation
- **WHEN** an authorized Receptionist, Manager, or Veterinarian sends `PATCH /api/v1/clients/:clientId/inactivate` for an `ACTIVE` client
- **THEN** the system updates the client status to `INACTIVE`
- **AND** returns HTTP `200` with `{ id, status: "INACTIVE" }` and message `"Cliente inactivado correctamente"`
- **AND** preserves all personal information, pets, and clinical records linked to the client

#### Scenario: Idempotent inactivation of an already inactive client
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId/inactivate` for a client that is already `INACTIVE`
- **THEN** the system returns HTTP `200` with `{ id, status: "INACTIVE" }` without duplicating audit logs

### Requirement: Reject invalid client inactivation targets
The system SHALL reject inactivation when the client does not exist or has status `DEACTIVATED`.

#### Scenario: Client does not exist
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId/inactivate` for a non-existent client UUID
- **THEN** the system returns HTTP `404` with `"Cliente no encontrado"`

#### Scenario: Client is permanently deactivated
- **WHEN** an authorized user sends `PATCH /api/v1/clients/:clientId/inactivate` for a client with status `DEACTIVATED`
- **THEN** the system rejects the request with HTTP `400` and `"No se puede inactivar un cliente dado de baja"`
- **AND** the client remains `DEACTIVATED`

### Requirement: Preserve consultation of inactive clients and block new transactions
The system SHALL allow authorized users to consult an `INACTIVE` client and their linked pets, while rejecting the selection of an `INACTIVE` client in new clinic transactions (such as registering a new patient).

#### Scenario: Consulting an inactive client and their pets
- **WHEN** an authorized user queries `GET /api/v1/clients` or `GET /api/v1/clients/:clientId/pets` for an `INACTIVE` client
- **THEN** the system returns the client's stored information and linked pets without deleting or hiding historical data

#### Scenario: Blocking an inactive client in a new patient registration
- **WHEN** a user attempts to register a new patient associated with an `INACTIVE` client
- **THEN** the system rejects the transaction with HTTP `409` indicating the client is not available

### Requirement: Enforce permission on client inactivation endpoint
The system SHALL require authentication and the `clients:inactivate` permission on `PATCH /api/v1/clients/:clientId/inactivate`.

#### Scenario: User without permission attempts to inactivate a client
- **WHEN** an authenticated user without `clients:inactivate` (e.g., Veterinary Technician or Cashier) sends `PATCH /api/v1/clients/:clientId/inactivate`
- **THEN** the system rejects the request with HTTP `403` and `"No tiene permisos para realizar esta acción"`
