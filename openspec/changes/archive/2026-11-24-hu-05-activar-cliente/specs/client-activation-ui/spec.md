## ADDED Requirements

### Requirement: Permission-gated Activar action in clients table
The clients management page (`ClientsPage`) SHALL display an `"Activar"` action only for `INACTIVE` clients when the authenticated user has the `clients:activate` permission. It SHALL NOT display `"Activar"` for `ACTIVE` or `DEACTIVATED` clients, nor when the user lacks `clients:activate`.

#### Scenario: Activar action visible only for inactive clients with permission
- **WHEN** a user with `clients:activate` views the clients table containing an `ACTIVE` client, an `INACTIVE` client, and a `DEACTIVATED` client
- **THEN** the `INACTIVE` row shows the `"Activar"` button
- **AND** the `ACTIVE` and `DEACTIVATED` rows do not show `"Activar"`

#### Scenario: Activar action hidden without permission
- **WHEN** a user without `clients:activate` views the clients table
- **THEN** no `"Activar"` button is rendered

#### Scenario: Deactivated client shows no status action
- **WHEN** a user with `clients:activate` and `clients:inactivate` views a `DEACTIVATED` client
- **THEN** the row shows neither `"Activar"` nor `"Inactivar"`

### Requirement: Confirmation dialog before activating a client
Before calling the backend to activate a client, `ClientsPage` SHALL open a confirmation dialog titled `"Activar cliente"` showing the client's name, email, and the `Inactivo → Activo` transition, with `"Confirmar"` and `"Cancelar"` actions.

#### Scenario: Confirming activation updates client status and shows confirmation
- **WHEN** the user clicks `"Activar"` on an `INACTIVE` client and clicks `"Confirmar"` in the dialog
- **THEN** the UI calls `PATCH /api/v1/clients/:clientId/activate`
- **AND** updates or reloads the client list so the client status reflects `"Activo"`
- **AND** displays `"Cliente activado correctamente"` in a success toast
- **AND** keeps the `"Ver mascotas"` action available to consult the client's pets

#### Scenario: Canceling activation keeps the client inactive
- **WHEN** the user clicks `"Activar"` on an `INACTIVE` client and clicks `"Cancelar"` in the dialog
- **THEN** the dialog closes without calling the API
- **AND** the client remains `"Inactivo"`

#### Scenario: Buttons disabled while activating
- **WHEN** the user confirms the activation and the request is still pending
- **THEN** `"Confirmar"` and `"Cancelar"` are disabled until the API responds

### Requirement: Display backend errors on client activation
When `PATCH /api/v1/clients/:clientId/activate` fails, `ClientsPage` SHALL close the dialog and display the backend error message in an error toast, consistent with the other client actions.

#### Scenario: Backend error shown when activation fails
- **WHEN** the user confirms activating a client and the API rejects the request (for example, with `"No se puede activar un cliente dado de baja"`)
- **THEN** the UI displays that error message in an error toast with `role="alert"`
- **AND** keeps the client's previous status unchanged
