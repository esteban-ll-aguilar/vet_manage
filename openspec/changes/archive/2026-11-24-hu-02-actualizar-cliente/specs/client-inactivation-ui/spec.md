## MODIFIED Requirements

### Requirement: Confirmation dialog before inactivating a client
Before calling the backend to inactivate a client, `ClientsPage` SHALL open a confirmation dialog showing the client's name, email, and `Activo → Inactivo` transition with `"Confirmar"` and `"Cancelar"` actions.

#### Scenario: Confirming inactivation updates client status and shows confirmation
- **WHEN** the user clicks `"Inactivar"` on an `ACTIVE` client and clicks `"Confirmar"` in the dialog
- **THEN** the UI calls `PATCH /api/v1/clients/:clientId/inactivate`
- **AND** updates or reloads the client list so the client status reflects `"Inactivo"`
- **AND** displays `"Cliente inactivado correctamente"` in a success toast, not in a banner above the list
- **AND** keeps the `"Ver mascotas"` action available to consult the client's pets

#### Scenario: Canceling inactivation preserves active status
- **WHEN** the user clicks `"Inactivar"` on an `ACTIVE` client and clicks `"Cancelar"` in the dialog
- **THEN** the dialog closes without calling the API
- **AND** the client remains `"Activo"`

### Requirement: Display backend validation errors on client inactivation
When `PATCH /api/v1/clients/:clientId/inactivate` fails, `ClientsPage` SHALL close the dialog and display the backend error message in an error toast, consistent with the other client actions.

#### Scenario: Backend error shown when inactivation fails
- **WHEN** the user confirms inactivating a client and the API rejects the request with an error message
- **THEN** the UI displays that error message in an error toast with `role="alert"`
- **AND** keeps the client's previous status unchanged
