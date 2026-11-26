export type Supplier = {
  id: string;
  businessName: string;
  ruc: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInput = {
  businessName: string;
  ruc: string;
};

export type SupplierStatusFilter = 'ACTIVE' | 'INACTIVE';

export type SupplierListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: SupplierStatusFilter;
};

export type SupplierListResponse = {
  items: Supplier[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
