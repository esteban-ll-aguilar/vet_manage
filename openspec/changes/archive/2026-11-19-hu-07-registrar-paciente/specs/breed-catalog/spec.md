## ADDED Requirements

### Requirement: Consulta de razas activas por especie
El sistema SHALL permitir a un usuario autenticado con el permiso `breeds:read` consultar las razas activas de una especie, para poblar selectores como el del registro de pacientes.

#### Scenario: Razas activas de una especie
- **WHEN** el usuario con permiso `breeds:read` envía `GET /api/v1/pets/species/:speciesId/breeds` con el identificador de una especie existente
- **THEN** el sistema responde HTTP 200 con la lista `[{ id, name }]` de las razas activas de esa especie, ordenada por nombre, sin incluir razas inactivas ni de otras especies

#### Scenario: Especie sin razas activas
- **WHEN** la especie existe pero no tiene razas activas
- **THEN** el sistema responde HTTP 200 con una lista vacía

#### Scenario: Identificador de especie inválido
- **WHEN** el `speciesId` no tiene formato UUID
- **THEN** el sistema responde HTTP 400

#### Scenario: Usuario sin permiso
- **WHEN** un usuario autenticado sin el permiso `breeds:read` consulta el endpoint
- **THEN** el sistema responde HTTP 403
