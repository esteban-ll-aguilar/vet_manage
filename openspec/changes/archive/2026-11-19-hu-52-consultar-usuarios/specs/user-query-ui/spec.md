## ADDED Requirements

### Requirement: User list displays the registered accounts
The system SHALL replace the placeholder on `/users` with a table of users showing identification, first and last name, email, all roles and status, with controls to move between pages of 20 users.

#### Scenario: Initial view
- **WHEN** an administrator opens `/users`
- **THEN** the placeholder is gone and a table shows the first 20 users sorted by last name
- **AND** pagination controls show the total number of users

#### Scenario: Navigate to the next page
- **WHEN** the administrator selects the next page
- **THEN** the table shows the following users and the search and filters remain applied

### Requirement: Search and filters update the user list
The system SHALL provide a text search for identification or partial name and selectors for role and status; changing any of them SHALL request the list again with the combined criteria.

#### Scenario: Search by identification or partial name
- **WHEN** the administrator types an identification or a partial name and submits the search
- **THEN** the table shows only the matching users

#### Scenario: Filter by role
- **WHEN** the administrator selects the role "Veterinario"
- **THEN** the table shows only users with that role
- **AND** the roles column still shows every role of each user

#### Scenario: Filter by status
- **WHEN** the administrator selects the status "Inactivo"
- **THEN** the table shows only inactive users

#### Scenario: Combined filters
- **WHEN** the administrator searches a name and selects a role and an active status
- **THEN** the table shows only the users satisfying all criteria

### Requirement: Empty results and access denial are communicated
The system SHALL show "No se encontraron usuarios" when a query returns no results and SHALL deny the `/users` view to users without `users:read` with "No tiene permisos para realizar esta acción".

#### Scenario: No results
- **WHEN** a search returns an empty list
- **THEN** the screen shows the message "No se encontraron usuarios"
- **AND** no user rows are rendered

#### Scenario: User without permission
- **WHEN** a cashier navigates directly to `/users`
- **THEN** the application denies access with "No tiene permisos para realizar esta acción"
- **AND** the user list is not rendered
