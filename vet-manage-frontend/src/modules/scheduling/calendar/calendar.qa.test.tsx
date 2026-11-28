/// <reference types="node" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { CalendarPage } from "./calendar-page";
import { calendarApi } from "./calendar-api";
import { readFileSync } from "node:fs";
const css = readFileSync(
  `${process.cwd()}/src/modules/scheduling/calendar/calendar.css`,
  "utf8",
);
import type { CalendarData, AppointmentStatus } from "./types";
vi.mock("./calendar-api", () => ({
  calendarApi: { branches: vi.fn(), read: vi.fn(), detail: vi.fn() },
}));
const states: [AppointmentStatus, string, string][] = [
  ["PROGRAMADA", "Programada", "#eaecf0"],
  ["CONFIRMADA", "Confirmada", "#dbeafe"],
  ["EN_CURSO", "En curso", "#ffedd5"],
  ["FINALIZADA", "Finalizada", "#dcfce7"],
  ["CANCELADA", "Cancelada", "#fee2e2"],
  ["NO_ASISTIO", "No asistió", "#f3e8ff"],
];
const data: CalendarData = {
  sucursal: { id: "loja", nombre: "Loja", estado: true },
  desde: "2026-11-02",
  hastaExclusiva: "2026-11-03",
  zonaHoraria: "America/Guayaquil",
  citas: states.map(([estado], i) => ({
    id: `c${i}`,
    numero: 201 + i,
    inicio: "2026-11-02T15:00:00Z",
    fin: "2026-11-02T15:30:00Z",
    paciente: "Luna",
    veterinario: "Ana Vega",
    estado,
  })),
  franjas: [
    {
      fecha: "2026-11-02",
      hora: "09:00",
      inicio: "2026-11-02T14:00:00Z",
      fin: "2026-11-02T14:30:00Z",
      estado: "Disponible",
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(calendarApi.branches).mockResolvedValue([data.sucursal]);
  vi.mocked(calendarApi.read).mockResolvedValue(structuredClone(data));
});
describe("QA adicional de componentes HU-001", () => {
  it.each(states)(
    "CP-001-05/06 cita %s usa color contractual y nombre visible",
    async (status, label, color) => {
      render(<CalendarPage />);
      const i = states.findIndex(([s]) => s === status);
      const card = await screen.findByRole("button", {
        name: new RegExp(`Cita #${201 + i}`),
      });
      expect(card).toHaveClass(`calendar-status--${status}`);
      expect(within(card).getByText(label)).toBeVisible();
      const rule = css.split(`.calendar-status--${status} {`)[1]?.split("}")[0];
      expect(rule).toContain(`--status-bg: ${color}`);
    },
  );
  it("CP-001-03 reserva: franja disponible permite abrir o continuar al registro", async () => {
    render(<CalendarPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "09:00 · Disponible" }),
    );
    const action = screen.getByRole("link", { name: "Registrar cita" });
    const destination = new URL(
      action.getAttribute("href")!,
      "http://localhost",
    );
    expect(destination.pathname).toBe("/appointments/appointments/new");
    expect(Object.fromEntries(destination.searchParams)).toEqual({
      sucursalId: "loja",
      fecha: "2026-11-02",
      horaInicio: "09:00",
    });
  });
});
