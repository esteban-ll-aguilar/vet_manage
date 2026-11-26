export class SupplierResponseDto {
  id!: string;
  businessName!: string;
  ruc!: string;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class SupplierListResponseDto {
  items!: SupplierResponseDto[];
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}
