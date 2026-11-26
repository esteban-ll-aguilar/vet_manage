## ADDED Requirements

### Requirement: Permission-gated edit action in BreedsPage
`BreedsPage` SHALL display registered breeds with their associated species and show an `"Editar"` icon button with tooltip only when the authenticated user has the `breeds:update` permission.

#### Scenario: Edit button visible with breeds:update permission
- **WHEN** a Veterinarian with `breeds:update` views `BreedsPage` with registered breeds
- **THEN** each breed row displays its name, associated species, status badge and an `"Editar"` button

#### Scenario: Edit button hidden without breeds:update permission
- **WHEN** a user with `breeds:read` but without `breeds:update` views `BreedsPage`
- **THEN** no `"Editar"` button is rendered

### Requirement: Edit breed modal with validation and cancel flow
Clicking `"Editar"` SHALL open the modal prefilled with the selected breed's name, associated species and description, validate required name and species, allow empty description, discard changes on `"Cancelar"`, and show a success toast on save.

#### Scenario: Successful breed update from UI
- **WHEN** the Veterinarian edits a breed's name, species or description and clicks `"Guardar cambios"`
- **THEN** the UI calls `PATCH /api/v1/pets/breeds/:id`, updates the breeds list, closes the modal, and displays a success toast `"Raza actualizada exitosamente"`

#### Scenario: Updating breed with empty description
- **WHEN** the Veterinarian clears the description field and saves
- **THEN** the UI submits the update without blocking and updates the breed

#### Scenario: Validating required name and species before saving
- **WHEN** the Veterinarian clears the name field or unselects the species and attempts to save
- **THEN** the UI blocks submission and displays the corresponding validation error message

#### Scenario: Canceling breed update discards changes
- **WHEN** the Veterinarian modifies fields in the edit modal and clicks `"Cancelar"`
- **THEN** the modal closes without calling the API and the breeds list retains the previous values
