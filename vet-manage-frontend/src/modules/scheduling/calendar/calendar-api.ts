import { getJson } from "../../../infrastructure/api/http-client";
import type {
  AppointmentDetail,
  CalendarBranch,
  CalendarData,
  CalendarView,
} from "./types";
export const calendarApi = {
  branches: () => getJson<CalendarBranch[]>("/scheduling/calendar/branches"),
  read: (sucursalId: string, fecha: string, vista: CalendarView) =>
    getJson<CalendarData>(
      `/scheduling/calendar?${new URLSearchParams({ sucursalId, fecha, vista })}`,
    ),
  detail: (id: string, sucursalId: string) =>
    getJson<AppointmentDetail>(
      `/scheduling/calendar/appointments/${encodeURIComponent(id)}?${new URLSearchParams({ sucursalId })}`,
    ),
};
