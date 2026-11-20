import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { BreedController } from './routes/breed.controller.js';
import { PatientsController } from './routes/patients.controller.js';
import { SpeciesController } from './routes/species.controller.js';
import { BreedRepository } from './repositories/breed.repository.js';
import { PatientRepository } from './repositories/patient.repository.js';
import { SpeciesRepository } from './repositories/species.repository.js';
import { ListActiveBreedsService } from './services/breeds/list-active-breeds.service.js';
import { RegisterBreedService } from './services/breeds/register-breed.service.js';
import { RegisterPatientService } from './services/patients/register-patient.service.js';
import { ListActiveSpeciesService } from './services/species/list-active-species.service.js';
import { RegisterSpeciesService } from './services/species/register-species.service.js';

@Module({
  imports: [PrismaModule, AuditModule, IdentityModule, ClientsModule],
  controllers: [SpeciesController, BreedController, PatientsController],
  providers: [
    SpeciesRepository,
    BreedRepository,
    PatientRepository,
    RegisterSpeciesService,
    ListActiveSpeciesService,
    RegisterBreedService,
    ListActiveBreedsService,
    RegisterPatientService,
  ],
  exports: [SpeciesRepository, BreedRepository, RegisterSpeciesService, ListActiveSpeciesService, RegisterBreedService],
})
export class PetsModule {}
