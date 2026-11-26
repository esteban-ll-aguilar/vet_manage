## ADDED Requirements

### Requirement: Forgot password screen
The frontend SHALL offer the public route `/forgot-password` with an email field and a button «Enviar enlace». It SHALL not call the API when the email is empty or malformed, showing «Ingrese un correo electrónico válido». After the request it SHALL always show «Si el correo está registrado, recibirá un enlace» and a link back to the login screen.

#### Scenario: Positive - request sent
- **WHEN** the user enters "ana@correo.com" and presses «Enviar enlace»
- **THEN** the screen shows «Si el correo está registrado, recibirá un enlace» and disables the button to avoid repeated requests

#### Scenario: Negative - invalid email
- **WHEN** the user enters "ana@correo" and presses «Enviar enlace»
- **THEN** no request is sent and «Ingrese un correo electrónico válido» is shown under the field

### Requirement: Reset password screen
The frontend SHALL offer the public route `/reset-password?token=…`. When it opens, it SHALL validate the link with the API: if it is expired it SHALL show «El enlace ha expirado. Solicite uno nuevo»; if it is not valid it SHALL show «El enlace no es válido. Solicite uno nuevo»; in both cases it SHALL offer a link to `/forgot-password` and hide the form. If it is valid it SHALL show the fields «Nueva contraseña» and «Confirmar contraseña» and the button «Guardar».

#### Scenario: Positive - valid link
- **WHEN** the user opens a valid link
- **THEN** the form with the two password fields and «Guardar» is shown

#### Scenario: Negative - expired link
- **WHEN** the user opens a link older than 30 minutes
- **THEN** the form is not shown and «El enlace ha expirado. Solicite uno nuevo» is shown with the option to request a new one

#### Scenario: Negative - used or replaced link
- **WHEN** the user opens a link that was used or replaced
- **THEN** the form is not shown and «El enlace no es válido. Solicite uno nuevo» is shown

### Requirement: Client-side validation of the new password
The reset screen SHALL apply the same rules as the API before sending: both fields required, confirmation equal to the new password, and the password policy. It SHALL show the API message when the server rejects the change.

#### Scenario: Negative - weak password
- **WHEN** the user enters "abc123" and presses «Guardar»
- **THEN** no request is sent and «La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número» is shown

#### Scenario: Boundary - password of 7 and 8 characters
- **WHEN** the user types "Clave12" and then "Clave123" in «Nueva contraseña»
- **THEN** the first value shows the password policy message and the second one is accepted by the client-side validation

#### Scenario: Negative - different confirmation
- **WHEN** the confirmation differs from the new password
- **THEN** no request is sent and «Las contraseñas no coinciden» is shown

### Requirement: Successful reset returns to login
After a successful reset the frontend SHALL show «Contraseña actualizada. Inicie sesión con su nueva contraseña» on the login screen, without opening a session automatically.

#### Scenario: Positive - password updated
- **WHEN** the API confirms the reset
- **THEN** the user is taken to `/login` and the message «Contraseña actualizada. Inicie sesión con su nueva contraseña» is shown
