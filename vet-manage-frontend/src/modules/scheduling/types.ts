export type RoomType = 'CONSULTORIO' | 'QUIROFANO';

export type Room = {
  id: string;
  nombre: string;
  tipo: RoomType;
};

export type Branch = {
  id: string;
  nombre: string;
  salas: Room[];
};

export type ClinicService = {
  id: string;
  nombre: string;
  duracionMaximaMin: number;
};
