## MODIFIED Requirements

### Requirement: Confirmation dialog before changing account status
Before calling the backend to inactivate or activate a user account, the UI SHALL display a confirmation dialog with `"Confirmar"` and `"Cancelar"` actions.

#### Scenario: Confirming inactivation updates the list and shows feedback
- **WHEN** the Administrator clicks `"Inactivar"` on an active user and clicks `"Confirmar"` in the confirmation dialog
- **THEN** the UI calls `PATCH /api/v1/users/:id/status` with `{ status: "INACTIVE" }`
- **AND** updates or reloads the users list so the user badge displays `"Inactivo"`
- **AND** displays `"Cuenta inactivada correctamente"` in a success toast, not in a banner above the list

#### Scenario: Canceling inactivation keeps account active
- **WHEN** the Administrator clicks `"Inactivar"` on an active user and clicks `"Cancelar"` in the confirmation dialog
- **THEN** the dialog closes without calling the API
- **AND** the user remains `"Activo"`

#### Scenario: Confirming activation updates the list and shows feedback
- **WHEN** the Administrator clicks `"Activar"` on an inactive user and clicks `"Confirmar"` in the confirmation dialog
- **THEN** the UI calls `PATCH /api/v1/users/:id/status` with `{ status: "ACTIVE" }`
- **AND** updates or reloads the users list so the user badge displays `"Activo"`
- **AND** displays `"Cuenta activada correctamente"` in a success toast, not in a banner above the list

### Requirement: Display backend validation errors on status change
When `PATCH /api/v1/users/:id/status` fails (for example, attempting to inactivate one's own account or the last active Administrator), the UI SHALL close or update the dialog and display the error message returned by the backend in an error toast, consistent with the other user actions.

#### Scenario: Self-inactivation error displayed
- **WHEN** the Administrator confirms inactivating their own account and the API returns `"No puede inactivar su propia cuenta"`
- **THEN** the UI displays `"No puede inactivar su propia cuenta"` in an error toast with `role="alert"`
- **AND** keeps the user status unchanged
