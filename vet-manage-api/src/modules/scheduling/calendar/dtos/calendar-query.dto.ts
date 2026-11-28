import { IsIn, IsUUID, Matches } from 'class-validator';

export class CalendarBranchDto {
  @IsUUID()
  sucursalId!: string;
}
export class CalendarQueryDto extends CalendarBranchDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  @IsIn(['dia', 'semana', 'mes'])
  vista!: 'dia' | 'semana' | 'mes';
}
