## MODIFIED Requirements

### Requirement: Uniform actions and modules
The system SHALL take the action and module names from a shared catalog, so that the same action always has the same name in every module. The catalog SHALL include at least the actions "Registrar", "Asignar roles", "Inactivar", "Activar" and "Cambiar contraseña". It SHALL include at least the modules "Usuarios", "Clientes", "Pacientes", "Especies" and "Razas".

#### Scenario: Same action in different modules
- **WHEN** a client and a patient are registered
- **THEN** both records have the action "Registrar", one with the module "Clientes" and the other with the module "Pacientes"

#### Scenario: User status actions in shared catalog
- **WHEN** a user account is inactivated and later reactivated
- **THEN** the audit records use the catalog actions "Inactivar" and "Activar" with the module "Usuarios"

#### Scenario: Password change action in shared catalog
- **WHEN** a user changes their password
- **THEN** the audit record uses the catalog action "Cambiar contraseña" with the module "Usuarios"

### Requirement: Audited actions
The system SHALL create an audit record, with the authenticated user as the actor, when any of these actions finishes successfully:

| Action | Module | Affected record |
|---|---|---|
| Register a staff user | Usuarios | The person's identification and full name |
| Change a user's roles | Usuarios | The person's identification and full name |
| Inactivate a user account | Usuarios | The person's identification and full name |
| Reactivate a user account | Usuarios | The person's identification and full name |
| Change own password | Usuarios | The person's identification and full name |
| Register a client | Clientes | The person's identification and full name |
| Inactivate a client | Clientes | The person's identification and full name |
| Register a patient | Pacientes | The patient's name and code |
| Register a species | Especies | The species name |
| Register a breed | Razas | The breed name and its species |

For a staff user, the action is "Registrar", including when an existing person is reused. For a role change, the action is "Asignar roles". For inactivating a user account or a client, the action is "Inactivar" with `previousValue` and `newValue` recording the status transition. For reactivating a user account, the action is "Activar" with `previousValue` and `newValue` recording the status transition. For changing a password, the action is "Cambiar contraseña" and the audit record SHALL NOT store plaintext passwords or password hashes. The other actions are "Registrar".

#### Scenario: Staff user registered
- **WHEN** the Administrator registers the user with identification "1710000017" and name "Marcelo Paredes"
- **THEN** a record is created with the action "Registrar", the module "Usuarios" and an affected record that contains "1710000017" and "Marcelo Paredes"

#### Scenario: Roles changed
- **WHEN** the Administrator changes the roles of a user
- **THEN** a record is created with the action "Asignar roles" and the module "Usuarios"

#### Scenario: Roles unchanged
- **WHEN** the Administrator saves the role assignment of a user without any change
- **THEN** no audit record is created

#### Scenario: User account inactivated
- **WHEN** the Administrator inactivates the active user "Luis Torres"
- **THEN** an audit record is created in the same transaction with action "Inactivar", module "Usuarios", affected record containing Luis Torres's identification and full name, previous value "Activo" and new value "Inactivo"

#### Scenario: User account reactivated
- **WHEN** the Administrator reactivates the inactive user "Luis Torres"
- **THEN** an audit record is created in the same transaction with action "Activar", module "Usuarios", affected record containing Luis Torres's identification and full name, previous value "Inactivo" and new value "Activo"

#### Scenario: Password changed
- **WHEN** a user successfully changes their password
- **THEN** an audit record is created in the same transaction with action "Cambiar contraseña", module "Usuarios", affected record containing the user's identification and full name, and no password values stored

#### Scenario: Client inactivated
- **WHEN** a Receptionist or Manager inactivates the active client "Juan Pérez"
- **THEN** an audit record is created in the same transaction with action "Inactivar", module "Clientes", affected record containing Juan Pérez's identification and full name, previous value "Activo" and new value "Inactivo"

#### Scenario: Patient registered
- **WHEN** a Receptionist registers the patient "Firulais" for a client
- **THEN** a record is created with the action "Registrar", the module "Pacientes", the Receptionist as user and an affected record that contains "Firulais"

#### Scenario: Species and breed registered
- **WHEN** a Veterinarian registers the species "Canino" and then the breed "Labrador" for that species
- **THEN** two records are created, one with the module "Especies" and the other with the module "Razas", both with the Veterinarian as user

#### Scenario: Read operations are not audited
- **WHEN** a user lists users, clients, species or breeds
- **THEN** no audit record is created
