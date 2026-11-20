// Texto del registro afectado cuando la acción es sobre una persona: cédula y nombre completo.
export const describePerson = (person: { identification: string; firstName: string; lastName: string }) =>
  `${person.identification} - ${person.firstName} ${person.lastName}`;
