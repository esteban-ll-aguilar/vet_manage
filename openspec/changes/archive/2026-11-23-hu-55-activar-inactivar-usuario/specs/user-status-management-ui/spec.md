## ADDED Requirements

### Requirement: Permission-gated status actions in users table
The users management page (`UsersPage`) SHALL display an `"Inactivar"` action for `ACTIVE` users and an `"Activar"` action for `INACTIVE` users only when the authenticated user has the `users:change-status` permission. It SHALL NOT display either action for `DEACTIVATED` users.

#### Scenario: Actions visible for Administrator
- **WHEN** a user with `users:change-status` views the users table containing an `ACTIVE` user, an `INACTIVE` user, and a `DEACTIVATED` user
- **THEN** the `ACTIVE` row shows the `"Inactivar"` button
- **AND** the `INACTIVE` row shows the `"Activar"` button
- **AND** the `DEACTIVATED` row shows neither `"Inactivar"` nor `"Activar"`

#### Scenario: Actions hidden without permission
- **WHEN** a user without `users:change-status` views the users table
- **THEN** neither `"Inactivar"` nor `"Activar"` buttons are rendered

### Requirement: Confirmation dialog before changing account status
Before calling the backend to inactivate or activate a user account, the UI SHALL display a confirmation dialog with `"Confirmar"` and `"Cancelar"` actions.

#### Scenario: Confirming inactivation updates the list and shows feedback
- **WHEN** the Administrator clicks `"Inactivar"` on an active user and clicks `"Confirmar"` in the confirmation dialog
- **THEN** the UI calls `PATCH /api/v1/users/:id/status` with `{ status: "INACTIVE" }`
- **AND** updates or reloads the users list so the user badge displays `"Inactivo"`
- **AND** displays a confirmation message

#### Scenario: Canceling inactivation keeps account active
- **WHEN** the Administrator clicks `"Inactivar"` on an active user and clicks `"Cancelar"` in the confirmation dialog
- **THEN** the dialog closes without calling the API
- **AND** the user remains `"Activo"`

#### Scenario: Confirming activation updates the list and shows feedback
- **WHEN** the Administrator clicks `"Activar"` on an inactive user and clicks `"Confirmar"` in the confirmation dialog
- **THEN** the UI calls `PATCH /api/v1/users/:id/status` with `{ status: "ACTIVE" }`
- **AND** updates or reloads the users list so the user badge displays `"Activo"`
- **AND** displays a confirmation message

### Requirement: Display backend validation errors on status change
When `PATCH /api/v1/users/:id/status` fails (for example, attempting to inactivate one's own account or the last active Administrator), the UI SHALL close or update the dialog and display the error message returned by the backend.

#### Scenario: Self-inactivation error displayed
- **WHEN** the Administrator confirms inactivating their own account and the API returns `"No puede inactivar su propia cuenta"`
- **THEN** the UI displays `"No puede inactivar su propia cuenta"` in an alert banner
- **AND** keeps the user status unchanged
