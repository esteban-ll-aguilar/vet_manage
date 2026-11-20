# user-query Specification

## Purpose

Consulta paginada y filtrable de usuarios desde la API, con control de acceso por `users:read`.

## Requirements

### Requirement: Users are listed with pagination and sorted by last name
The system SHALL expose `GET /api/v1/users` that returns users ordered by `lastName` ascending (then `firstName`) in pages of 20, where every item includes identification, first name, last name, email, all assigned roles and status. The response data SHALL contain `items`, `total`, `page` and `pageSize`.

#### Scenario: Initial page
- **WHEN** an administrator with `users:read` requests the user list without filters
- **THEN** the response contains at most 20 users sorted by last name
- **AND** each item includes identification, email, roles and status

#### Scenario: Second page
- **WHEN** the administrator requests `page=2`
- **THEN** the response contains the next 20 users in the same order
- **AND** `total` reports the number of users matching the filters

#### Scenario: Page without results
- **WHEN** the requested page is beyond the last page
- **THEN** the response returns an empty `items` array with HTTP 200
- **AND** `total` still reports the number of users matching the filters

### Requirement: Users can be searched by identification or partial name
The system SHALL filter the user list by an exact `identification` value or by a case-insensitive partial match against first and last names.

#### Scenario: Search by identification
- **WHEN** the administrator searches by the identification "1104567890" of an existing user
- **THEN** only that user is returned with email, roles and status

#### Scenario: Partial name search
- **WHEN** two users have "Pérez" in their first or last name and the administrator searches "Pérez"
- **THEN** both users are returned with case-insensitive matching

#### Scenario: No matches
- **WHEN** the search value matches no user
- **THEN** the response returns an empty `items` array and `total` equal to zero

### Requirement: Users can be filtered by role and status
The system SHALL filter by role name and by status (`ACTIVE`, `INACTIVE`, `DEACTIVATED`), and SHALL combine them with the search criteria. A user matching a role filter SHALL be returned with every assigned role, not only the filtered one.

#### Scenario: Filter by role
- **WHEN** the administrator filters by the role "veterinarian"
- **THEN** only users with that role are returned
- **AND** users with additional roles display all of their roles

#### Scenario: Filter by status
- **WHEN** the administrator filters by status "INACTIVE"
- **THEN** only inactive users are returned
- **AND** users in status "DEACTIVATED" are excluded

#### Scenario: Combined filters
- **WHEN** the administrator filters by role "veterinarian", status "ACTIVE" and a partial name
- **THEN** only users satisfying all three criteria are returned

### Requirement: User query requires authentication and read permission
The system SHALL reject unauthenticated queries with HTTP 401 and authenticated users without `users:read` with HTTP 403 and the message "No tiene permisos para realizar esta acción", using the standard error envelope.

#### Scenario: No token
- **WHEN** an unauthenticated request reaches `GET /api/v1/users`
- **THEN** the response is 401 with the standard error envelope

#### Scenario: User without permission
- **WHEN** a cashier with a valid token requests the user list
- **THEN** the response is 403 with the message "No tiene permisos para realizar esta acción"

#### Scenario: Invalid query parameters
- **WHEN** the administrator requests a page lower than 1 or a page size not allowed by the endpoint
- **THEN** the response is 400 with the standard error envelope
