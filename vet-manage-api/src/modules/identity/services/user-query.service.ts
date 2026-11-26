import { Injectable } from '@nestjs/common';
import type { QueryUsersDto } from '../dtos/query-users.dto.js';
import {
  type UserQueryFilter,
  type UserQueryResult,
  UserQueryRepository,
} from '../repositories/user-query.repository.js';

@Injectable()
export class UserQueryService {
  constructor(private readonly repository: UserQueryRepository) {}

  async list(query: QueryUsersDto): Promise<UserQueryResult> {
    const filter: UserQueryFilter = {
      q: query.q?.trim() || undefined,
      role: query.role?.trim() || undefined,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };

    const [items, total] = await Promise.all([
      this.repository.findMany(filter),
      this.repository.count(filter),
    ]);

    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }
}
