## ADDED Requirements

### Requirement: Status actions in the species table according to status and permission
`SpeciesPage` SHALL display, for users with `species:change-status`, only an `"Inactivar"` action for active species and only an `"Activar"` action for inactive species. It SHALL NOT display either action without that permission.

#### Scenario: Actions shown according to the species status
- **WHEN** a Veterinarian views the species table containing an active species and an inactive species
- **THEN** the active row shows `"Inactivar"` and not `"Activar"`
- **AND** the inactive row shows `"Activar"` and not `"Inactivar"`

#### Scenario: Actions hidden without permission
- **WHEN** a user without `species:change-status` views the species table
- **THEN** no `"Activar"` or `"Inactivar"` action is rendered

#### Scenario: Actions column with only the status permission
- **WHEN** a user has `species:change-status` but not `species:update`
- **THEN** the `"Acciones"` column is shown with the status action and without `"Editar"`

### Requirement: Confirmation dialog before changing the species status
Before calling the backend, `SpeciesPage` SHALL open a confirmation dialog titled `"Inactivar especie"` or `"Activar especie"` that shows the species name and the `Activa → Inactiva` or `Inactiva → Activa` transition, with `"Confirmar"` and `"Cancelar"` actions.

#### Scenario: Confirming inactivation
- **WHEN** the Veterinarian clicks `"Inactivar"` on an active species and clicks `"Confirmar"`
- **THEN** the UI calls `PATCH /api/v1/pets/species/:id/status` with `{ isActive: false }`
- **AND** the row shows `"Inactiva"` and the `"Activar"` action
- **AND** displays `"Especie inactivada correctamente"` in a success toast

#### Scenario: Confirming activation
- **WHEN** the Veterinarian clicks `"Activar"` on an inactive species and clicks `"Confirmar"`
- **THEN** the UI calls `PATCH /api/v1/pets/species/:id/status` with `{ isActive: true }`
- **AND** the row shows `"Activa"` and the `"Inactivar"` action
- **AND** displays `"Especie activada correctamente"` in a success toast

#### Scenario: Canceling keeps the previous status
- **WHEN** the Veterinarian opens the confirmation for either action and clicks `"Cancelar"`
- **THEN** the dialog closes without calling the API
- **AND** the species keeps its previous status

#### Scenario: Buttons disabled while saving
- **WHEN** the Veterinarian confirms and the request is still pending
- **THEN** `"Confirmar"` and `"Cancelar"` are disabled until the API responds

### Requirement: Display backend errors on species status change
When `PATCH /api/v1/pets/species/:id/status` fails, `SpeciesPage` SHALL close the dialog and display the backend error message in an error toast, keeping the row unchanged.

#### Scenario: Backend error shown in a toast
- **WHEN** the Veterinarian confirms a status change and the API rejects it (for example, with `"Especie no encontrada"`)
- **THEN** the UI displays that message in an error toast with `role="alert"`
- **AND** the species keeps its previous status in the table
