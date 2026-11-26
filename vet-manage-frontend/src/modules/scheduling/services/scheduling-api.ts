import { getJson, postJson, putJson, deleteJson } from '../../../infrastructure/api/http-client';
import type { AvailableResources, ConsultAvailableResourcesParams, Branch, ClinicService, GenerateSaturdayShiftsData, MyAvailability, SaturdayShift, SaveMyAvailabilityData, SubstituteSaturdayShiftData, WorkSchedule, WorkScheduleFormData, VeterinarianOption } from '../types';
import type { SaturdayShiftRecord, SaturdayShiftResponse } from '../types';

function mapSaturdayShift(record: SaturdayShiftResponse): SaturdayShift {
  const { horarioBase, sucursal } = record;
  return {
    id: record.id,
    // Son fecha de calendario y horas de jornada, sin conversión a zona local.
    fecha: record.fecha.slice(0, 10),
    justificacion: record.justificacion,
    sucursalId: record.sucursalId,
    sucursalNombre: sucursal.nombre,
    veterinarioId: horarioBase.veterinarioId,
    veterinarioNombre: `${horarioBase.veterinario.person.firstName} ${horarioBase.veterinario.person.lastName}`,
    horaInicio: horarioBase.horaInicio.slice(11, 16),
    horaFin: horarioBase.horaFin.slice(11, 16),
  };
}

export const schedulingApi = {
  consultAvailableResources(params: ConsultAvailableResourcesParams) {
    const query = new URLSearchParams({
      sucursalId: params.sucursalId,
      fecha: params.fecha,
      hora: params.hora,
      duracionMin: String(params.duracionMin),
    });
    return getJson<AvailableResources>(`/scheduling/resources/availability?${query.toString()}`);
  },
  listBranches() {
    return getJson<Branch[]>('/scheduling/branches');
  },
  listServices() {
    return getJson<ClinicService[]>('/scheduling/services');
  },
  listWorkSchedules(params?: { veterinarioId?: string; sucursalId?: string }) {
    const query = new URLSearchParams();
    if (params?.veterinarioId) query.set('veterinarioId', params.veterinarioId);
    if (params?.sucursalId) query.set('sucursalId', params.sucursalId);
    const qs = query.toString();
    return getJson<WorkSchedule[]>(`/scheduling/work-schedules${qs ? `?${qs}` : ''}`);
  },
  listVeterinarians() {
    return getJson<VeterinarianOption[]>('/scheduling/work-schedules/veterinarians');
  },
  createWorkSchedule(data: WorkScheduleFormData) {
    return postJson<WorkSchedule, WorkScheduleFormData>('/scheduling/work-schedules', data);
  },
  updateWorkSchedule(id: string, data: Partial<WorkScheduleFormData>) {
    return putJson<WorkSchedule, Partial<WorkScheduleFormData>>(`/scheduling/work-schedules/${id}`, data);
  },
  deleteWorkSchedule(id: string) {
    return deleteJson<void>(`/scheduling/work-schedules/${id}`);
  },
  listSaturdayShifts(params?: { sucursalId?: string; fechaDesde?: string; fechaHasta?: string }) {
    const query = new URLSearchParams();
    if (params?.sucursalId) query.set('sucursalId', params.sucursalId);
    if (params?.fechaDesde) query.set('fechaDesde', params.fechaDesde);
    if (params?.fechaHasta) query.set('fechaHasta', params.fechaHasta);
    const qs = query.toString();
    return getJson<SaturdayShiftResponse[]>(`/scheduling/saturday-shifts${qs ? `?${qs}` : ''}`)
      .then((records) => records.map(mapSaturdayShift));
  },
  generateSaturdayShifts(data: GenerateSaturdayShiftsData) {
    return postJson<SaturdayShiftRecord[], GenerateSaturdayShiftsData>('/scheduling/saturday-shifts/generate', data);
  },
  substituteSaturdayShift(id: string, data: SubstituteSaturdayShiftData) {
    return putJson<SaturdayShiftRecord, SubstituteSaturdayShiftData>(`/scheduling/saturday-shifts/${id}`, data);
  },
  getMyAvailability(fecha: string) {
    return getJson<MyAvailability>(`/scheduling/daily-availability/me?fecha=${encodeURIComponent(fecha)}`);
  },
  saveMyAvailability(data: SaveMyAvailabilityData) {
    return putJson<MyAvailability, SaveMyAvailabilityData>('/scheduling/daily-availability/me', data);
  },
  resetMyAvailability(fecha: string, horarioBaseId: string) {
    const query = new URLSearchParams({ fecha, horarioBaseId });
    return deleteJson<MyAvailability>(`/scheduling/daily-availability/me?${query.toString()}`);
  },
};
