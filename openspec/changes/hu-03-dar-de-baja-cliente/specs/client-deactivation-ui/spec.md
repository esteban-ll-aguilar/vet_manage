## ADDED Requirements

### Requirement: Deactivate action visible by permission and status
`ClientsPage` SHALL show the action «Dar de baja» only when the user has the `clients:deactivate` permission and the client status is `Activo` or `Inactivo`.

#### Scenario: Positive - Manager sees the action
- **WHEN** a Manager opens the client list
- **THEN** each `Activo` or `Inactivo` client shows the «Dar de baja» action

#### Scenario: Negative - Receptionist does not see the action
- **WHEN** a Receptionist or Veterinary Technician opens the client list or a client's details
- **THEN** the «Dar de baja» action is not shown

#### Scenario: Negative - deactivated client
- **WHEN** a client has status `De baja`
- **THEN** no «Dar de baja», «Editar», «Inactivar» or «Activar» action is shown for it

### Requirement: Confirmation modal with mandatory reason
Selecting «Dar de baja» SHALL open a confirmation modal that shows the client, the transition `Activo/Inactivo → De baja`, a warning that the action is final, a mandatory reason field with a character counter (maximum 500) and the buttons «Cancelar» and «Confirmar baja».

#### Scenario: Negative - confirm without reason
- **WHEN** the user presses «Confirmar baja» with an empty or blank reason
- **THEN** the reason field is highlighted with «Ingrese el motivo de la baja» and no request is sent

#### Scenario: Boundary - reason at the limit
- **WHEN** the user types a reason of 500 characters
- **THEN** the counter shows 500/500 and no more characters can be typed

#### Scenario: Positive - successful deactivation
- **WHEN** the user enters a reason and presses «Confirmar baja»
- **THEN** the modal closes, the client row shows the badge `De baja` and the notice «Cliente dado de baja correctamente» is shown

#### Scenario: Negative - API error
- **WHEN** the API rejects the deactivation
- **THEN** the modal stays open, shows the API message and the client status does not change

### Requirement: Cancel keeps the client unchanged
Pressing «Cancelar», closing the modal or pressing Escape SHALL close the modal without sending any request.

#### Scenario: Positive - cancel the deactivation
- **WHEN** the user opens the modal for an `Inactivo` client and presses «Cancelar»
- **THEN** no request is sent and the client keeps the status `Inactivo`

### Requirement: Read-only view of a deactivated client
The client details of a `De baja` client SHALL show its data, the deactivation date, the user responsible, the reason and its patients, without any editing control.

#### Scenario: Positive - Manager consults a deactivated client
- **WHEN** a Manager opens the details of a `De baja` client
- **THEN** the page shows the reason, date and responsible user of the deactivation and the list of patients in read-only mode

### Requirement: Deactivated clients not selectable in new transactions
The client picker used to register patients SHALL not offer `De baja` clients; if one is selected through the API, the form SHALL show «El cliente está desactivado».

#### Scenario: Negative - searching a deactivated client in the patient form
- **WHEN** a Receptionist searches for a `De baja` client in the patient registration form
- **THEN** the client does not appear as an option
