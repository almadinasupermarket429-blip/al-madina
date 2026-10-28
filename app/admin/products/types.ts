import type { Nutrition } from "@/lib/food-info";

export type Size = {
  id?: string;
  label: string;
  price: number | string;
  oldPrice?: number | string | null;
  stock?: number | string;
  /** Net quantity, e.g. 500 + "g" (for the price per kg / litre). */
  sizeValue?: number | string | null;
  sizeUnit?: string | null;
  /** Bottle/can deposit in €. */
  deposit?: number | string | null;
};
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
  // Mandatory food information (lib/food-info.ts).
  ingredients: string | null;
  ingredientsEn: string | null;
  ingredientsNotRequired: boolean;
  allergens: string[];
  allergensConfirmed: boolean;
  traces: string | null;
  nutrition: Nutrition | null;
  nutritionNotRequired: boolean;
  storage: string | null;
  storageEn: string | null;
  manufacturer: string | null;
  origin: string | null;
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
  ingredients: "",
  ingredientsEn: "",
  ingredientsNotRequired: false,
  allergens: [],
  allergensConfirmed: false,
  traces: "",
  nutrition: null,
  nutritionNotRequired: false,
  storage: "",
  storageEn: "",
  manufacturer: "",
  origin: "",
};
