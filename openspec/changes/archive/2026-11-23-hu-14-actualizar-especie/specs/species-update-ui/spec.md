## ADDED Requirements

### Requirement: Permission-gated edit action in SpeciesPage
`SpeciesPage` SHALL display registered species and show an `"Editar"` icon button with tooltip only when the authenticated user has the `species:update` permission.

#### Scenario: Edit button visible with species:update permission
- **WHEN** a Veterinarian with `species:update` views `SpeciesPage` with registered species
- **THEN** each species row displays an `"Editar"` button

#### Scenario: Edit button hidden without species:update permission
- **WHEN** a user with `species:read` but without `species:update` views `SpeciesPage`
- **THEN** no `"Editar"` button is rendered

### Requirement: Edit species modal with validation and cancel flow
Clicking `"Editar"` SHALL open the modal prefilled with the selected species's name and description, validate required name, allow empty description, discard changes on `"Cancelar"`, and show a success toast on save.

#### Scenario: Successful species update from UI
- **WHEN** the Veterinarian edits a species's name or description and clicks `"Guardar cambios"`
- **THEN** the UI calls `PATCH /api/v1/pets/species/:id`, updates the species list, closes the modal, and displays a success toast `"Especie actualizada exitosamente"`

#### Scenario: Updating species with empty description
- **WHEN** the Veterinarian clears the description field and saves
- **THEN** the UI submits the update without blocking and updates the species

#### Scenario: Validating required name before saving
- **WHEN** the Veterinarian clears the name field and attempts to save
- **THEN** the UI blocks submission and displays `"El nombre de la especie es obligatorio"`

#### Scenario: Canceling species update discards changes
- **WHEN** the Veterinarian modifies fields in the edit modal and clicks `"Cancelar"`
- **THEN** the modal closes without calling the API and the species list retains the previous values
