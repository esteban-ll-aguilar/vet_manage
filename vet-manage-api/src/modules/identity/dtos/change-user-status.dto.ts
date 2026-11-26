import { IsIn } from 'class-validator';

export const CHANGEABLE_USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ChangeableUserStatus = (typeof CHANGEABLE_USER_STATUSES)[number];

export class ChangeUserStatusDto {
  @IsIn(CHANGEABLE_USER_STATUSES, { message: 'Estado de usuario no válido' })
  status!: ChangeableUserStatus;
}
