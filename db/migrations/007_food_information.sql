-- Mandatory food information for online sales (LMIV Art. 9 + 14), filled in by the owner
-- in the admin. lib/food-info.ts decides what counts as complete.
alter table products add column if not exists ingredients text;
alter table products add column if not exists ingredients_en text;
-- Single-ingredient products (rice, fresh fruit, ...) need no ingredient list.
alter table products add column if not exists ingredients_not_required boolean not null default false;
-- Keys from lib/food-info.ts ALLERGENS, e.g. {milk,sesame}.
alter table products add column if not exists allergens text[] not null default '{}';
-- True once someone has checked the allergens; an empty list then means "contains none".
alter table products add column if not exists allergens_confirmed boolean not null default false;
-- "Kann Spuren von ... enthalten" (voluntary).
alter table products add column if not exists traces text;
-- Per 100 g / 100 ml: {"energyKj":..,"energyKcal":..,"fat":..,"saturates":..,"carbs":..,"sugars":..,"protein":..,"salt":..}
alter table products add column if not exists nutrition jsonb;
-- Herbs, spices, tea, coffee, single-ingredient products (LMIV Annex V) need no nutrition table.
alter table products add column if not exists nutrition_not_required boolean not null default false;
alter table products add column if not exists storage text;
alter table products add column if not exists storage_en text;
-- Name and address of the manufacturer or importer.
alter table products add column if not exists manufacturer text;
-- Country of origin, where required (e.g. fresh meat, honey).
alter table products add column if not exists origin text;

-- Bottle/can deposit per size, shown separately from the price (PAngV § 7).
alter table product_variants add column if not exists deposit numeric(10,2) not null default 0;

-- Net quantity for the price per kg / litre: fill it from labels like "500 g" or "1,5 l"
-- where it is still empty. Labels like "1 Stück" are left for the owner to fill in.
update product_variants
set size_value = replace((regexp_match(size_label, '(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)(?![a-zA-ZäöüÄÖÜ])', 'i'))[1], ',', '.')::numeric,
    size_unit = lower((regexp_match(size_label, '(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)(?![a-zA-ZäöüÄÖÜ])', 'i'))[2])::variant_size_unit
where size_value is null
  and size_label ~* '\d\s*(kg|g|ml|l)(?![a-zA-ZäöüÄÖÜ])';
