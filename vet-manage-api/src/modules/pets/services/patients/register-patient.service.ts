import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { AuditService } from '../../../audit/services/audit.service.js';
import { ClientsService } from '../../../clients/services/clients.service.js';
import type { RegisterPatientDto } from '../../dtos/patients/register-patient.dto.js';
import { BreedRepository } from '../../repositories/breed.repository.js';
import { PatientRepository, type CreatedPatient, type NewPatient } from '../../repositories/patient.repository.js';
import { SpeciesRepository } from '../../repositories/species.repository.js';
import { formatBirthDate, parseBirthDate } from './birth-date.js';

export const PATIENT_MESSAGES = {
  registered: 'Paciente registrado exitosamente',
  missing: 'Por favor, complete todos los campos obligatorios',
  clientRequired: 'Debe seleccionar un cliente registrado',
  clientUnavailable: 'El cliente seleccionado no está disponible',
  clientDeactivated: 'El cliente está desactivado',
  invalidBirthDate: 'Fecha de nacimiento inválida',
  invalidMeasures: 'El peso y la talla deben ser valores numéricos mayores que cero',
  invalidGender: 'El sexo debe ser Macho o Hembra',
  invalidReproductiveStatus: 'El estado reproductivo debe ser Esterilizado, No esterilizado o Desconocido',
  nameTooLong: 'El nombre no puede exceder los 100 caracteres',
  colorTooLong: 'El color no puede exceder los 50 caracteres',
  measureTooLarge: 'El peso y la talla no pueden superar 9999.99',
  invalidId: 'Identificador inválido',
  speciesNotFound: 'La especie seleccionada no existe',
  speciesInactive: 'La especie seleccionada no está disponible',
  breedNotFound: 'La raza seleccionada no existe',
  breedInactive: 'La raza seleccionada no está disponible',
  breedMismatch: 'La raza no corresponde a la especie seleccionada',
} as const;

const GENDERS: readonly string[] = ['MALE', 'FEMALE'];
const REPRODUCTIVE_STATUSES: readonly string[] = ['STERILIZED', 'NOT_STERILIZED', 'UNKNOWN'];
const REQUIRED = ['name', 'speciesId', 'breedId', 'gender', 'birthDate', 'weightKg', 'heightCm', 'reproductiveStatus'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEASURE_MAX = 9999.99;

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : String(value));

// Acepta números o textos numéricos ("12.5"); cualquier otra cosa es NaN.
const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return Number.NaN;
};

const fail = (message: string, status: number, fields: string[], code: string) =>
  new ApiException(message, status, fields, code);

const fieldsWhere = (checks: [string, boolean][]) => checks.filter(([, invalid]) => invalid).map(([field]) => field);

export type RegisteredPatient = {
  id: string;
  code: string;
  name: string;
  gender: string;
  birthDate: string;
  weightKg: number;
  heightCm: number;
  reproductiveStatus: string;
  color: string | null;
  status: string;
  clientId: string;
  species: { id: string; name: string };
  breed: { id: string; name: string };
  createdAt: string;
};

@Injectable()
export class RegisterPatientService {
  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly speciesRepository: SpeciesRepository,
    private readonly breedRepository: BreedRepository,
    private readonly clientsService: ClientsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async execute(dto: RegisterPatientDto, actorId: string): Promise<RegisteredPatient> {
    const data = this.validate(dto);

    // El dueño se valida con el servicio de clientes, no con su tabla.
    const client = await this.clientsService.findById(data.clientId);
    if (!client) throw fail(PATIENT_MESSAGES.clientRequired, 404, ['clientId'], 'PATIENT_CLIENT_NOT_FOUND');
    // HU-03: un cliente dado de baja se identifica como desactivado; uno inactivo mantiene el mensaje de HU-07.
    if (client.status === 'DEACTIVATED') throw fail(PATIENT_MESSAGES.clientDeactivated, 409, ['clientId'], 'PATIENT_CLIENT_DEACTIVATED');
    if (client.status !== 'ACTIVE') throw fail(PATIENT_MESSAGES.clientUnavailable, 409, ['clientId'], 'PATIENT_CLIENT_UNAVAILABLE');

    const species = await this.speciesRepository.findById(data.speciesId);
    if (!species) throw fail(PATIENT_MESSAGES.speciesNotFound, 404, ['speciesId'], 'PATIENT_SPECIES_NOT_FOUND');
    if (!species.isActive) throw fail(PATIENT_MESSAGES.speciesInactive, 409, ['speciesId'], 'PATIENT_SPECIES_INACTIVE');

    const breed = await this.breedRepository.findById(data.breedId);
    if (!breed) throw fail(PATIENT_MESSAGES.breedNotFound, 404, ['breedId'], 'PATIENT_BREED_NOT_FOUND');
    if (breed.speciesId !== species.id) throw fail(PATIENT_MESSAGES.breedMismatch, 400, ['breedId'], 'PATIENT_BREED_MISMATCH');
    if (!breed.isActive) throw fail(PATIENT_MESSAGES.breedInactive, 409, ['breedId'], 'PATIENT_BREED_INACTIVE');

    const created = await this.prisma.$transaction(async (tx) => {
      const patient = await this.patientRepository.create(data, tx);
      await this.audit.record(tx, {
        actorId,
        action: AUDIT_ACTIONS.register,
        module: AUDIT_MODULES.patients,
        affectedRecord: `${patient.name} (${patient.code})`,
      });
      return patient;
    });

    return this.toResponse(created);
  }

  // Valida en el orden de los criterios de aceptación; dto.code se ignora a propósito.
  private validate(dto: RegisterPatientDto): NewPatient {
    if (isBlank(dto.clientId)) throw fail(PATIENT_MESSAGES.clientRequired, 400, ['clientId'], 'PATIENT_CLIENT_REQUIRED');

    const missing = REQUIRED.filter((field) => isBlank(dto[field]));
    if (missing.length > 0) throw fail(PATIENT_MESSAGES.missing, 400, [...missing], 'PATIENT_MISSING_FIELDS');

    const invalidIds = (['clientId', 'speciesId', 'breedId'] as const).filter((field) => !UUID_PATTERN.test(text(dto[field])));
    if (invalidIds.length > 0) throw fail(PATIENT_MESSAGES.invalidId, 400, invalidIds, 'PATIENT_INVALID_ID');

    const name = text(dto.name);
    if (name.length > 100) throw fail(PATIENT_MESSAGES.nameTooLong, 400, ['name'], 'PATIENT_INVALID_NAME');

    const gender = text(dto.gender);
    if (!GENDERS.includes(gender)) throw fail(PATIENT_MESSAGES.invalidGender, 400, ['gender'], 'PATIENT_INVALID_GENDER');

    const reproductiveStatus = text(dto.reproductiveStatus);
    if (!REPRODUCTIVE_STATUSES.includes(reproductiveStatus)) {
      throw fail(PATIENT_MESSAGES.invalidReproductiveStatus, 400, ['reproductiveStatus'], 'PATIENT_INVALID_REPRODUCTIVE_STATUS');
    }

    const birthDate = parseBirthDate(dto.birthDate);
    if (!birthDate) throw fail(PATIENT_MESSAGES.invalidBirthDate, 400, ['birthDate'], 'PATIENT_INVALID_BIRTH_DATE');

    const weightKg = toNumber(dto.weightKg);
    const heightCm = toNumber(dto.heightCm);
    // !(x > 0) también atrapa NaN.
    const invalidMeasures = fieldsWhere([['weightKg', !(weightKg > 0)], ['heightCm', !(heightCm > 0)]]);
    if (invalidMeasures.length > 0) throw fail(PATIENT_MESSAGES.invalidMeasures, 400, invalidMeasures, 'PATIENT_INVALID_MEASURES');

    const tooLarge = fieldsWhere([['weightKg', weightKg > MEASURE_MAX], ['heightCm', heightCm > MEASURE_MAX]]);
    if (tooLarge.length > 0) throw fail(PATIENT_MESSAGES.measureTooLarge, 400, tooLarge, 'PATIENT_INVALID_MEASURES');

    const color = isBlank(dto.color) ? null : text(dto.color);
    if (color && color.length > 50) throw fail(PATIENT_MESSAGES.colorTooLong, 400, ['color'], 'PATIENT_INVALID_COLOR');

    return {
      name,
      gender: gender as NewPatient['gender'],
      birthDate,
      weightKg: Math.round(weightKg * 100) / 100,
      heightCm: Math.round(heightCm * 100) / 100,
      reproductiveStatus: reproductiveStatus as NewPatient['reproductiveStatus'],
      color,
      clientId: text(dto.clientId),
      speciesId: text(dto.speciesId),
      breedId: text(dto.breedId),
    };
  }

  private toResponse(patient: CreatedPatient): RegisteredPatient {
    return {
      id: patient.id,
      code: patient.code,
      name: patient.name,
      gender: patient.gender,
      birthDate: formatBirthDate(patient.birthDate),
      weightKg: Number(patient.weightKg),
      heightCm: Number(patient.heightCm),
      reproductiveStatus: patient.reproductiveStatus,
      color: patient.color,
      status: patient.status,
      clientId: patient.clientId,
      species: patient.species,
      breed: patient.breed,
      createdAt: patient.createdAt.toISOString(),
    };
  }
}
