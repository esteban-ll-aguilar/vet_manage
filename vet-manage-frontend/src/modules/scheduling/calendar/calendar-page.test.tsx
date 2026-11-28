import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CalendarPage } from "./calendar-page";
import { calendarApi } from "./calendar-api";
import {
  localDate,
  navigateDate,
  periodDays,
  timeLabel,
} from "./calendar-dates";
import type { CalendarData, CalendarView } from "./types";
import { SCHEDULING_SECTIONS } from "../navigation";

vi.mock("./calendar-api", () => ({
  calendarApi: { branches: vi.fn(), read: vi.fn(), detail: vi.fn() },
}));
const confirmed = {
  id: "c1",
  numero: 101,
  inicio: "2026-11-02T15:00:00Z",
  fin: "2026-11-02T15:30:00Z",
  paciente: "Luna",
  veterinario: "Ana Vega",
  estado: "CONFIRMADA" as const,
};
const fixture = (): CalendarData => ({
  sucursal: { id: "loja", nombre: "Loja", estado: true },
  desde: "2026-11-02",
  hastaExclusiva: "2026-11-03",
  zonaHoraria: "America/Guayaquil",
  citas: [
    confirmed,
    {
      ...confirmed,
      id: "c2",
      numero: 102,
      paciente: "Sol",
      estado: "CANCELADA",
    },
  ],
  franjas: [
    {
      fecha: "2026-11-02",
      hora: "09:00",
      inicio: "2026-11-02T14:00:00Z",
      fin: "2026-11-02T14:30:00Z",
      estado: "Disponible",
    },
    {
      fecha: "2026-11-02",
      hora: "11:00",
      inicio: "2026-11-02T16:00:00Z",
      fin: "2026-11-02T16:30:00Z",
      estado: "Bloqueado",
    },
    {
      fecha: "2026-11-02",
      hora: "13:00",
      inicio: "2026-11-02T18:00:00Z",
      fin: "2026-11-02T18:30:00Z",
      estado: "Fuera de atención",
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(calendarApi.branches).mockResolvedValue([
    { id: "loja", nombre: "Loja", estado: true },
    { id: "vilcabamba", nombre: "Vilcabamba", estado: true },
  ]);
  vi.mocked(calendarApi.read).mockResolvedValue(fixture());
  vi.mocked(calendarApi.detail).mockResolvedValue({
    ...confirmed,
    cliente: "Luis Paz",
    cedula: "1100000000",
    consultorio: "Consultorio 1",
    sucursal: "Loja",
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

describe("HU-001 calendario", () => {
  it("CP-001-01 muestra cita con horas Ecuador y detalle completo", async () => {
    render(<CalendarPage />);
    const appointment = await screen.findByRole("button", {
      name: /Cita #101/,
    });
    expect(appointment).toHaveTextContent("10:00–10:30");
    expect(appointment).toHaveTextContent("Luna");
    expect(appointment).toHaveTextContent("Ana Vega");
    expect(within(appointment).getByText("Confirmada")).toHaveClass(
      "calendar-status--CONFIRMADA",
    );
    fireEvent.click(appointment);
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Luis Paz")).toBeVisible();
    for (const value of ["1100000000", "Consultorio 1", "Loja"])
      expect(within(dialog).getByText(value)).toBeVisible();
    expect(calendarApi.detail).toHaveBeenCalledWith("c1", "loja");
    fireEvent.click(within(dialog).getByText("Cerrar detalle"));
    expect(dialog).not.toBeVisible();
  });
  it("CP-001-04 filtro oculta cancelada sin consultar ni cambiar franjas", async () => {
    render(<CalendarPage />);
    await screen.findByRole("button", { name: /Cita #102/ });
    const calls = vi.mocked(calendarApi.read).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "CONFIRMADA" },
    });
    expect(
      screen.queryByRole("button", { name: /Cita #102/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cita #101/ })).toBeVisible();
    expect(
      screen.getByText("Disponibilidad: 1 disponible de 3 franjas"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "09:00 · Disponible" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "11:00 · Bloqueado" }),
    ).toBeDisabled();
    expect(calendarApi.read).toHaveBeenCalledTimes(calls);
  });
  it("CP-001-03 solo Disponible permite selección y avisa reserva pendiente", async () => {
    render(<CalendarPage />);
    const available = await screen.findByRole("button", {
      name: "09:00 · Disponible",
    });
    expect(
      screen.getByRole("button", { name: "11:00 · Bloqueado" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "13:00 · Fuera de atención" }),
    ).not.toBeVisible();
    fireEvent.click(screen.getByText("Ver horarios fuera de atención (1)"));
    expect(
      screen.getByRole("button", { name: "13:00 · Fuera de atención" }),
    ).toBeDisabled();
    fireEvent.click(available);
    expect(
      screen.getByText(/Esta selección no crea ni reserva una cita/),
    ).toBeVisible();
  });
  it("CP-001-02 navega semana y mes desde fecha seleccionada", async () => {
    render(<CalendarPage />);
    await screen.findByRole("button", { name: /Cita #101/ });
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-11-02" },
    });
    fireEvent.change(screen.getByLabelText("Vista"), {
      target: { value: "semana" },
    });
    await waitFor(() =>
      expect(calendarApi.read).toHaveBeenLastCalledWith(
        "loja",
        "2026-11-02",
        "semana",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(calendarApi.read).toHaveBeenLastCalledWith(
        "loja",
        "2026-11-09",
        "semana",
      ),
    );
    fireEvent.change(screen.getByLabelText("Vista"), {
      target: { value: "mes" },
    });
    await waitFor(() =>
      expect(calendarApi.read).toHaveBeenLastCalledWith(
        "loja",
        "2026-11-09",
        "mes",
      ),
    );
  });
  it("cambio de sucursal descarta respuesta anterior y detalle previo", async () => {
    render(<CalendarPage />);
    await screen.findByRole("button", { name: /Cita #101/ });
    vi.mocked(calendarApi.read).mockResolvedValue({
      ...fixture(),
      citas: [],
      sucursal: { id: "vilcabamba", nombre: "Vilcabamba", estado: true },
    });
    fireEvent.change(screen.getByLabelText("Sucursal"), {
      target: { value: "vilcabamba" },
    });
    expect(await screen.findByText("No hay citas para este día")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Cita #101/ }),
    ).not.toBeInTheDocument();
    expect(calendarApi.read).toHaveBeenLastCalledWith(
      "vilcabamba",
      expect.any(String),
      "dia",
    );
  });
  it("vacío conserva franjas y leyenda accesible con todos los nombres", async () => {
    vi.mocked(calendarApi.read).mockResolvedValue({ ...fixture(), citas: [] });
    render(<CalendarPage />);
    expect(await screen.findByText("No hay citas para este día")).toBeVisible();
    const legend = screen.getByLabelText("Leyenda de estados");
    for (const label of [
      "Programada",
      "Confirmada",
      "En curso",
      "Finalizada",
      "Cancelada",
      "No asistió",
    ])
      expect(within(legend).getByText(label)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "09:00 · Disponible" }),
    ).toBeEnabled();
    expect(
      SCHEDULING_SECTIONS.find((s) => s.path === "calendar")?.permission,
    ).toBe("calendar:read");
  });
  it("citas que cruzan día, semana y mes aparecen en cada día intersectado", async () => {
    vi.mocked(calendarApi.read).mockResolvedValue({
      ...fixture(),
      desde: "2026-11-01",
      hastaExclusiva: "2026-11-03",
      citas: [
        {
          ...confirmed,
          inicio: "2026-11-01T04:30:00Z",
          fin: "2026-11-03T05:00:00Z",
        },
      ],
    });
    render(<CalendarPage />);
    expect(
      await screen.findAllByRole("button", { name: /Cita #101/ }),
    ).toHaveLength(2);
    expect(screen.getAllByText(/31 de octubre de 2026/)).toHaveLength(2);
  });
  it("muestra error recuperable sin datos obsoletos", async () => {
    vi.mocked(calendarApi.read).mockRejectedValueOnce(
      new Error("Sin conexión"),
    );
    render(<CalendarPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("button", { name: /Cita #101/ }),
    ).toBeVisible();
  });
  it("Hoy en el mismo día vuelve a cargar sin quedar bloqueado", async () => {
    render(<CalendarPage />);
    await screen.findByRole("button", { name: /Cita #101/ });
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    await screen.findByRole("button", { name: /Cita #101/ });
    expect(screen.queryByText("Cargando calendario…")).not.toBeInTheDocument();
  });
});
describe("fechas independientes de zona del navegador", () => {
  it.each([
    ["2026-11-02", "semana", 1, "2026-11-09"],
    ["2026-12-31", "dia", 1, "2027-01-01"],
    ["2026-12-31", "mes", 1, "2027-01-31"],
    ["2026-01-31", "mes", 1, "2026-02-28"],
    ["2028-01-31", "mes", 1, "2028-02-29"],
    ["2026-01-01", "mes", -1, "2025-12-01"],
  ])("navega %s %s %s", (date, view, direction, expected) =>
    expect(
      navigateDate(date as string, view as CalendarView, direction as number),
    ).toBe(expected),
  );
  it("medianoche Ecuador y mes completo", () => {
    expect(localDate(new Date("2026-11-02T04:59:59Z"))).toBe("2026-11-01");
    expect(localDate(new Date("2026-11-02T05:00:00Z"))).toBe("2026-11-02");
    expect(timeLabel("2026-11-02T15:00:00Z")).toBe("10:00");
    expect(periodDays("2026-11-01", "2026-12-01")).toHaveLength(30);
  });
});
