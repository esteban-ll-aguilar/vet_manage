import type { Gender, RegisterPatientDraft, ReproductiveStatus } from '../types';

export const PATIENT_FORM_MESSAGES = {
  missing: 'Por favor, complete todos los campos obligatorios',
  clientRequired: 'Debe seleccionar un cliente registrado',
  invalidBirthDate: 'Fecha de nacimiento inválida',
  invalidMeasures: 'El peso y la talla deben ser valores numéricos mayores que cero',
} as const;

export type PatientFormInput = {
  name: string;
  speciesId: string;
  breedId: string;
  gender: Gender | '';
  birthDate: string;
  weightKg: string;
  heightCm: string;
  reproductiveStatus: ReproductiveStatus | '';
  color: string;
  clientId: string;
};

export type PatientField = keyof PatientFormInput;
export type PatientFieldErrors = Partial<Record<PatientField, string>>;

type PatientValidation =
  | { valid: true; value: RegisterPatientDraft; errors: null; message: null }
  | { valid: false; value: null; errors: PatientFieldErrors; message: string };

export const emptyPatientForm: PatientFormInput = {
  name: '',
  speciesId: '',
  breedId: '',
  gender: '',
  birthDate: '',
  weightKg: '',
  heightCm: '',
  reproductiveStatus: '',
  color: '',
  clientId: '',
};

const REQUIRED: PatientField[] = ['name', 'speciesId', 'breedId', 'gender', 'birthDate', 'weightKg', 'heightCm', 'reproductiveStatus'];
const NUMBER_PATTERN = /^\d+([.,]\d+)?$/;

// Igual que el backend: DD-MM-YYYY, fecha existente y no futura.
export function isValidBirthDate(value: string, today: Date = new Date()): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() <= endOfToday.getTime();
}

// Acepta coma o punto como separador decimal; devuelve NaN si no es un número positivo válido.
export function parseMeasure(value: string): number {
  const trimmed = value.trim();
  return NUMBER_PATTERN.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

// Inserta los guiones mientras se escribe: "10052024" → "10-05-2024".
export function maskBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('-');
}

export function validatePatientDraft(input: PatientFormInput, today: Date = new Date()): PatientValidation {
  const errors: PatientFieldErrors = {};

  for (const field of REQUIRED) {
    if (!input[field].trim()) errors[field] = 'Campo obligatorio';
  }
  if (!input.clientId) errors.clientId = PATIENT_FORM_MESSAGES.clientRequired;

  const missingOthers = REQUIRED.some((field) => errors[field]);
  if (missingOthers) return { valid: false, value: null, errors, message: PATIENT_FORM_MESSAGES.missing };
  if (errors.clientId) return { valid: false, value: null, errors, message: PATIENT_FORM_MESSAGES.clientRequired };

  if (!isValidBirthDate(input.birthDate, today)) {
    return {
      valid: false,
      value: null,
      errors: { birthDate: PATIENT_FORM_MESSAGES.invalidBirthDate },
      message: PATIENT_FORM_MESSAGES.invalidBirthDate,
    };
  }

  const weightKg = parseMeasure(input.weightKg);
  const heightCm = parseMeasure(input.heightCm);
  if (!(weightKg > 0)) errors.weightKg = PATIENT_FORM_MESSAGES.invalidMeasures;
  if (!(heightCm > 0)) errors.heightCm = PATIENT_FORM_MESSAGES.invalidMeasures;
  if (errors.weightKg || errors.heightCm) {
    return { valid: false, value: null, errors, message: PATIENT_FORM_MESSAGES.invalidMeasures };
  }

  return {
    valid: true,
    value: {
      name: input.name.trim(),
      speciesId: input.speciesId,
      breedId: input.breedId,
      gender: input.gender as Gender,
      birthDate: input.birthDate.trim(),
      weightKg,
      heightCm,
      reproductiveStatus: input.reproductiveStatus as ReproductiveStatus,
      color: input.color.trim() || undefined,
      clientId: input.clientId,
    },
    errors: null,
    message: null,
  };
}
