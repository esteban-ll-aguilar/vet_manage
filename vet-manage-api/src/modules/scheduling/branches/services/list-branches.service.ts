import { Injectable } from '@nestjs/common';
import { BranchRepository } from '../repositories/branch.repository.js';

@Injectable()
export class ListBranchesService {
  constructor(private readonly branches: BranchRepository) {}

  listBranches() {
    return this.branches.findActiveBranchesWithRooms();
  }

  listServices() {
    return this.branches.findActiveServices();
  }
}
