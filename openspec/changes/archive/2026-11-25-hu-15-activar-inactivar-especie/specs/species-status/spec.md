## ADDED Requirements

### Requirement: Change the status of a species
The system SHALL allow an authenticated user with the `species:change-status` permission to inactivate an active species or activate an inactive species via `PATCH /api/v1/pets/species/:id/status` with body `{ isActive: boolean }`, without changing its name, description, breeds or patients.

#### Scenario: Successful species inactivation
- **WHEN** a Veterinarian sends `PATCH /api/v1/pets/species/:id/status` with `{ isActive: false }` for an active species
- **THEN** the system sets the species `isActive` to `false`
- **AND** returns HTTP `200` with the updated species and message `"Especie inactivada correctamente"`

#### Scenario: Successful species activation
- **WHEN** a Veterinarian sends `PATCH /api/v1/pets/species/:id/status` with `{ isActive: true }` for an inactive species
- **THEN** the system sets the species `isActive` to `true`
- **AND** returns HTTP `200` with the updated species and message `"Especie activada correctamente"`

#### Scenario: Species already in the requested status
- **WHEN** a Veterinarian requests the status the species already has
- **THEN** the system returns HTTP `200` with the species and the corresponding confirmation message
- **AND** does not write the species nor create an audit log

### Requirement: Reject invalid species status changes
The system SHALL reject the request when the species does not exist, the identifier is not a UUID, or `isActive` is missing or not a boolean.

#### Scenario: Species does not exist
- **WHEN** a Veterinarian sends `PATCH /api/v1/pets/species/:id/status` for a non-existent species UUID
- **THEN** the system returns HTTP `404` with `"Especie no encontrada"`

#### Scenario: Invalid status value
- **WHEN** a Veterinarian sends `{ isActive: "no" }` or an empty body
- **THEN** the system returns HTTP `400` with `"Estado de especie no válido"` without changing the species

#### Scenario: Invalid species identifier
- **WHEN** a Veterinarian sends `PATCH /api/v1/pets/species/not-a-uuid/status`
- **THEN** the system returns HTTP `400` without changing any species

### Requirement: Audit species status changes
The system SHALL record each effective status change in the audit log, in the same transaction, with the responsible user, the date, action `"Inactivar"` or `"Activar"`, module `"Especies"`, the species name as affected record, and the previous and new status (`"Activa"` / `"Inactiva"`).

#### Scenario: Audit log of an inactivation
- **WHEN** a Veterinarian inactivates the active species `"Canino"`
- **THEN** the audit log contains one record with the actor's id, action `"Inactivar"`, module `"Especies"`, affected record `"Canino"`, previous value `{ status: "Activa" }` and new value `{ status: "Inactiva" }`

#### Scenario: Audit log of an activation
- **WHEN** a Veterinarian activates the inactive species `"Canino"`
- **THEN** the audit log contains one record with action `"Activar"`, previous value `{ status: "Inactiva" }` and new value `{ status: "Activa" }`

### Requirement: Species availability follows its status
An inactive species SHALL NOT be offered for new breeds or patients, and an activated species SHALL be available again for selection. Existing breeds and patients of the species SHALL keep their data when it is inactivated.

#### Scenario: Inactive species leaves the active catalog
- **WHEN** a species is inactivated
- **THEN** `GET /api/v1/pets/species/active` no longer returns it
- **AND** registering a new breed for that species is rejected
- **AND** its existing breeds and patients keep their data and their link to the species

#### Scenario: Activated species is available again
- **WHEN** an inactive species is activated
- **THEN** `GET /api/v1/pets/species/active` returns it for Veterinarians, Veterinary Technicians and Receptionists
- **AND** a new breed can be registered for that species

### Requirement: Enforce permission on species status endpoint
The system SHALL require authentication and the `species:change-status` permission on `PATCH /api/v1/pets/species/:id/status`.

#### Scenario: Request without session
- **WHEN** a request without a valid access token is sent to `PATCH /api/v1/pets/species/:id/status`
- **THEN** the system returns HTTP `401`

#### Scenario: User without permission
- **WHEN** an authenticated Manager, Veterinary Technician or Receptionist sends `PATCH /api/v1/pets/species/:id/status`
- **THEN** the system returns HTTP `403` with `"No tiene permisos para realizar esta acción"`
- **AND** the species status does not change
