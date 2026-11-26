## ADDED Requirements

### Requirement: Permission-gated Inactivar action in clients table
The clients management page (`ClientsPage`) SHALL display an `"Inactivar"` action only for `ACTIVE` clients when the authenticated user has the `clients:inactivate` permission. It SHALL NOT display `"Inactivar"` for `INACTIVE` or `DEACTIVATED` clients, nor when the user lacks `clients:inactivate`.

#### Scenario: Inactivar action visible only for active clients with permission
- **WHEN** a user with `clients:inactivate` views the clients table containing an `ACTIVE` client, an `INACTIVE` client, and a `DEACTIVATED` client
- **THEN** the `ACTIVE` row shows the `"Inactivar"` button
- **AND** the `INACTIVE` and `DEACTIVATED` rows do not show `"Inactivar"`

#### Scenario: Inactivar action hidden without permission
- **WHEN** a user without `clients:inactivate` views the clients table
- **THEN** no `"Inactivar"` button is rendered

### Requirement: Confirmation dialog before inactivating a client
Before calling the backend to inactivate a client, `ClientsPage` SHALL open a confirmation dialog showing the client's name, email, and `Activo → Inactivo` transition with `"Confirmar"` and `"Cancelar"` actions.

#### Scenario: Confirming inactivation updates client status and shows confirmation
- **WHEN** the user clicks `"Inactivar"` on an `ACTIVE` client and clicks `"Confirmar"` in the dialog
- **THEN** the UI calls `PATCH /api/v1/clients/:clientId/inactivate`
- **AND** updates the client row badge to `"Inactivo"`
- **AND** displays `"Cliente inactivado correctamente"`
- **AND** keeps the `"Ver mascotas"` action available to consult the client's pets

#### Scenario: Canceling inactivation preserves active status
- **WHEN** the user clicks `"Inactivar"` on an `ACTIVE` client and clicks `"Cancelar"` in the dialog
- **THEN** the dialog closes without calling the API
- **AND** the client remains `"Activo"`

### Requirement: Display backend validation errors on client inactivation
When `PATCH /api/v1/clients/:clientId/inactivate` fails, `ClientsPage` SHALL close the dialog and display the backend error message in an alert banner.

#### Scenario: Backend error shown when inactivation fails
- **WHEN** the user confirms inactivating a client and the API rejects the request with an error message
- **THEN** the UI displays that error message in a `role="alert"` banner
- **AND** keeps the client's previous status unchanged
