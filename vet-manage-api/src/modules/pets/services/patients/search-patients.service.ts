import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import type {
  PatientSearchItem,
  PatientSearchResponse,
} from '../../dtos/patients/patient-search-response.dto.js';
import {
  PATIENT_SEARCH_SHORT_MESSAGE,
  type SearchPatientsQueryDto,
} from '../../dtos/patients/search-patients-query.dto.js';
import { PatientRepository, type PatientSearchRecord } from '../../repositories/patient.repository.js';
import { formatBirthDate } from './birth-date.js';
import { normalizeSearch } from './normalize-search.js';

export const PATIENT_QUERY_MESSAGES = {
  shortSearch: PATIENT_SEARCH_SHORT_MESSAGE,
};

@Injectable()
export class SearchPatientsService {
  constructor(private readonly repository: PatientRepository) {}

  async search(query: SearchPatientsQueryDto): Promise<PatientSearchResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    if (search && normalizeSearch(search).length === 1) {
      throw ApiException.badRequest(PATIENT_QUERY_MESSAGES.shortSearch);
    }

    const { patients, total } = await this.repository.searchPatients({ search, page, pageSize });

    return {
      items: patients.map((patient) => this.toResponse(patient)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private toResponse(patient: PatientSearchRecord): PatientSearchItem {
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
      client: {
        firstName: patient.client.person.firstName,
        lastName: patient.client.person.lastName,
        identification: patient.client.person.identification,
      },
      species: patient.species,
      breed: patient.breed,
    };
  }
}
