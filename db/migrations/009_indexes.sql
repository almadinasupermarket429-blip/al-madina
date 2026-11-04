-- Indexes for lookups the app does often, and removal of an unused table. Safe to run again.

-- "Frequently bought together" and the product delete check look up order lines by product.
create index if not exists idx_order_items_product on order_items(product_id);
-- Account deletion removes a customer's reviews; the admin lists them per customer.
create index if not exists idx_reviews_user on reviews(user_id);
-- Deleting or hiding a product touches every wishlist entry for it.
create index if not exists idx_wishlists_product on wishlists(product_id);
-- Deleting a saved address clears it from orders (on delete set null).
create index if not exists idx_orders_delivery_address on orders(delivery_address_id);

-- Delivery fees come from store_settings; this distance-based fee table was never used.
drop table if exists delivery_fee_rules;
