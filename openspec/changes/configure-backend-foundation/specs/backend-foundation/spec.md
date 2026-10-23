## ADDED Requirements

### Requirement: Backend structure
The backend SHALL expose a documented base structure with `config`, `common`, `domain`, `modules`, and `infrastructure` directories without creating business modules prematurely.

#### Scenario: New team member inspects the backend
- **WHEN** the team opens the `src` directory
- **THEN** the architectural boundaries and their purpose are discoverable from the directory structure and documentation

### Requirement: Environment validation
The backend SHALL validate required environment variables at startup and SHALL fail with a clear configuration error when a required value is missing or invalid.

#### Scenario: Required database configuration is missing
- **WHEN** the API starts without a valid `DATABASE_URL`
- **THEN** startup fails with a configuration validation error

### Requirement: Local infrastructure
Docker Compose SHALL provide PostgreSQL, Redis, RabbitMQ, and the API using non-default host ports and persistent database storage.

#### Scenario: Developer starts local infrastructure
- **WHEN** the developer runs `docker compose up -d`
- **THEN** the configured services start on the documented custom ports and PostgreSQL data is persisted in a named volume

### Requirement: Service connectivity
The API SHALL connect to Docker dependencies by Compose service name and SHALL expose a health endpoint that reports dependency readiness.

#### Scenario: Dependencies are ready
- **WHEN** PostgreSQL, Redis, and RabbitMQ are healthy
- **THEN** the API health endpoint reports an operational status

### Requirement: Module convention
Each future business module SHALL contain `repositories`, `dtos`, `services`, and `routes`, and SHALL NOT require a separate `use-cases` directory.

#### Scenario: Team adds a future module
- **WHEN** the team creates a module such as `pets`
- **THEN** its files follow the documented module convention and application operations are implemented as services
