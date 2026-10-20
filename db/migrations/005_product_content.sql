-- Bilingual product content and Amazon-style product details.
-- German stays in the existing name/description columns (the store's main
-- language); the *_en columns hold the English version and fall back to German
-- when empty.
alter table products add column if not exists name_en text;
alter table products add column if not exists description_en text;
alter table products add column if not exists brand text;
-- Short "key features" bullet points, one list per language.
alter table products add column if not exists highlights text[] not null default '{}';
alter table products add column if not exists highlights_en text[] not null default '{}';
-- Details table rows: [{"label": "Marke", "labelEn": "Brand", "value": "Durra", "valueEn": "Durra"}]
alter table products add column if not exists specs jsonb not null default '[]';
-- Extra photos shown after image_url in the product gallery.
alter table products add column if not exists gallery text[] not null default '{}';

alter table categories add column if not exists name_en text;
