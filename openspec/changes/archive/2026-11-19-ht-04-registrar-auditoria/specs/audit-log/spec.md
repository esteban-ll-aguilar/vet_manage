## ADDED Requirements

### Requirement: Audit record
The system SHALL store each audited action as an audit record with:
- the date and time of the action;
- the user who performed it;
- the role or roles of that user;
- the action;
- the module;
- a readable description of the affected record.

Each record SHALL reference an existing user.

#### Scenario: Record with all the data
- **WHEN** the Receptionist "María López" registers the client "Juan Pérez"
- **THEN** an audit record exists with the current date and time, the user "María López", the role "Recepcionista", the action "Registrar", the module "Clientes" and an affected record that identifies "Juan Pérez"

### Requirement: Role at the time of the action
The system SHALL store, as the role of the record, the display names of the roles that were active and in force for the user when the action happened. When there are several roles, it SHALL store them separated by commas and in alphabetical order. Later changes to the user's roles SHALL NOT change existing records.

#### Scenario: User with several roles
- **WHEN** a user with the roles Veterinario and Gerente performs an audited action
- **THEN** the record stores the role "Gerente, Veterinario"

#### Scenario: Roles change after the action
- **WHEN** a Receptionist registers a patient and the Receptionist role is later removed from that user
- **THEN** the existing record still shows the role "Recepcionista"

### Requirement: Atomic with the action
The system SHALL write the audit record in the same database transaction as the audited action. If the action fails or is rejected, no audit record SHALL remain. If the audit record cannot be written, the action SHALL NOT be saved.

#### Scenario: Rejected action
- **WHEN** the Administrator tries to register a user with an identification that is already registered
- **THEN** the request fails with its validation message and no audit record is created

#### Scenario: Audit write fails
- **WHEN** writing the audit record fails while registering a species
- **THEN** the species is not saved and the request fails

### Requirement: Read-only records
Audit records SHALL be read-only: the application SHALL only offer a way to add them, and the database SHALL reject any update or deletion of an existing record.

#### Scenario: Attempt to modify a record
- **WHEN** any process runs an update on an existing audit record
- **THEN** the database rejects the operation and the record does not change

#### Scenario: Attempt to delete a record
- **WHEN** any process runs a deletion of an audit record
- **THEN** the database rejects the operation and the record is kept

### Requirement: Records survive the user's deactivation
The audit records of a user SHALL be kept when that user is inactivated or deactivated. A user that has audit records SHALL NOT be physically deleted.

#### Scenario: Deactivated user
- **WHEN** a Cashier who performed 5 audited actions is deactivated
- **THEN** the 5 audit records of that user are still stored

### Requirement: Uniform actions and modules
The system SHALL take the action and module names from a shared catalog, so that the same action always has the same name in every module. The catalog SHALL include at least the actions "Registrar" and "Asignar roles". It SHALL include at least the modules "Usuarios", "Clientes", "Pacientes", "Especies" and "Razas".

#### Scenario: Same action in different modules
- **WHEN** a client and a patient are registered
- **THEN** both records have the action "Registrar", one with the module "Clientes" and the other with the module "Pacientes"

### Requirement: Audited actions
The system SHALL create an audit record, with the authenticated user as the actor, when any of these actions finishes successfully:

| Action | Module | Affected record |
|---|---|---|
| Register a staff user | Usuarios | The person's identification and full name |
| Change a user's roles | Usuarios | The person's identification and full name |
| Register a client | Clientes | The person's identification and full name |
| Register a patient | Pacientes | The patient's name and code |
| Register a species | Especies | The species name |
| Register a breed | Razas | The breed name and its species |

For a staff user, the action is "Registrar", including when an existing person is reused. For a role change, the action is "Asignar roles". The other actions are "Registrar".

#### Scenario: Staff user registered
- **WHEN** the Administrator registers the user with identification "1710000017" and name "Marcelo Paredes"
- **THEN** a record is created with the action "Registrar", the module "Usuarios" and an affected record that contains "1710000017" and "Marcelo Paredes"

#### Scenario: Roles changed
- **WHEN** the Administrator changes the roles of a user
- **THEN** a record is created with the action "Asignar roles" and the module "Usuarios"

#### Scenario: Roles unchanged
- **WHEN** the Administrator saves the role assignment of a user without any change
- **THEN** no audit record is created

#### Scenario: Patient registered
- **WHEN** a Receptionist registers the patient "Firulais" for a client
- **THEN** a record is created with the action "Registrar", the module "Pacientes", the Receptionist as user and an affected record that contains "Firulais"

#### Scenario: Species and breed registered
- **WHEN** a Veterinarian registers the species "Canino" and then the breed "Labrador" for that species
- **THEN** two records are created, one with the module "Especies" and the other with the module "Razas", both with the Veterinarian as user

#### Scenario: Read operations are not audited
- **WHEN** a user lists users, clients, species or breeds
- **THEN** no audit record is created
