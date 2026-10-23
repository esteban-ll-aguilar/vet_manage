## ADDED Requirements

### Requirement: Identity and RBAC models
The backend SHALL persist users, profiles, sessions, roles, permissions, user-role assignments, and role-permission assignments with explicit Prisma relations.

#### Scenario: User permissions are resolved through roles
- **WHEN** a user has an active role with an active permission grant
- **THEN** the data model can resolve that permission through `UserRole` and `RolePermission`

### Requirement: Declarative permission synchronization
The backend SHALL synchronize permissions declared in the permissions catalog on startup without physically deleting historical records.

#### Scenario: A permission is added to the catalog
- **WHEN** startup finds a declared permission absent from the database
- **THEN** it creates an active permission with its catalog metadata

#### Scenario: A permission is removed from the catalog
- **WHEN** startup finds an active database permission absent from the catalog
- **THEN** it marks the permission inactive and preserves its record

### Requirement: Declarative role synchronization
The backend SHALL synchronize system roles and their permission grants from a versioned roles catalog.

#### Scenario: A role grant is removed from code
- **WHEN** startup compares an existing system role with its catalog definition
- **THEN** it revokes only the removed grant and leaves the role and permission records available for history

### Requirement: Global error contract
The backend SHALL return a consistent error envelope for domain, validation, authorization, not-found, conflict, and unexpected errors.

#### Scenario: A domain exception is thrown
- **WHEN** a controller throws an `ApiException`
- **THEN** the response uses its status code and includes `success: false`, `message`, and error metadata
