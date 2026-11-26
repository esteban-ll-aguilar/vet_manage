## ADDED Requirements

### Requirement: Forgot password link
The login screen SHALL show the link «¿Olvidó su contraseña?», which opens `/forgot-password`. It replaces the help text that told the user to contact the administrator.

#### Scenario: Positive - open password recovery
- **WHEN** the user presses «¿Olvidó su contraseña?» on the login screen
- **THEN** the screen `/forgot-password` is shown, keeping the email typed in the login form, if any

#### Scenario: Positive - message after a reset
- **WHEN** the user arrives at the login screen after resetting the password
- **THEN** the screen shows «Contraseña actualizada. Inicie sesión con su nueva contraseña» as a success notice
