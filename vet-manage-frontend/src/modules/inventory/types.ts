export type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unitPrice: string;
  stock: number;
  category: CatalogItem;
  brand: CatalogItem;
  createdAt: string;
};

export type ProductDraft = {
  code: string;
  name: string;
  description: string;
  unitPrice: string;
  category: { id?: string; name?: string };
  brand: { id?: string; name?: string };
};

// HU-02: datos que se envían para registrar la entrada de un lote.
export type BatchEntryDraft = {
  productId: string;
  code: string;
  expirationDate: string;
  initialQuantity: number;
};

export type BatchEntryResult = {
  batch: {
    id: string;
    productId: string;
    code: string;
    expirationDate: string;
    initialQuantity: number;
    availableQuantity: number;
  };
  product: { id: string; code: string; name: string; stock: number };
};

export type ExpirationAlert = {
  lotId: string;
  productName: string;
  lotCode: string;
  expirationDate: string;
  availableQuantity: number;
  status: 'UPCOMING' | 'EXPIRED';
  label: 'Próximo a caducar' | 'Caducado';
};
