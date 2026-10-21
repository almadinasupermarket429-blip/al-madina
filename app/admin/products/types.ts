export type Size = { id?: string; label: string; price: number | string; oldPrice?: number | string | null; stock?: number | string };
export type Spec = { label: string; labelEn?: string; value: string; valueEn?: string };

export type AdminProduct = {
  id: string;
  name: string;
  nameEn: string | null;
  category: string;
  description: string | null;
  descriptionEn: string | null;
  brand: string | null;
  highlights: string[] | null;
  highlightsEn: string[] | null;
  specs: Spec[] | null;
  gallery: string[] | null;
  image: string;
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  active: boolean;
  sizes: Size[];
};

export type EditableProduct = Omit<AdminProduct, "id"> & { id?: string };

export const EMPTY_PRODUCT: EditableProduct = {
  name: "",
  nameEn: "",
  category: "",
  description: "",
  descriptionEn: "",
  brand: "",
  highlights: [],
  highlightsEn: [],
  specs: [],
  gallery: [],
  image: "",
  badge: "",
  unitNote: "",
  tags: [],
  active: true,
  sizes: [{ label: "", price: "" }],
};
