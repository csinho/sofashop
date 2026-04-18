-- Opcional: dados de demonstração após criar uma loja e copiar o store_id.
-- Substitua <STORE_ID> e rode no SQL Editor autenticado como service_role ou pelo painel.

/*
INSERT INTO products (store_id, category_id, name, slug, model_type, short_description, description, sku, base_price, is_active, is_featured, delivery_days)
VALUES (
  '<STORE_ID>',
  (SELECT id FROM categories WHERE store_id = '<STORE_ID>' AND slug = 'sofas' LIMIT 1),
  'Sofá retrátil 3 lugares',
  'sofa-retratil-3-lugares-demo',
  'Sofá retrátil',
  'Conforto premium para sala de estar.',
  'Descrição completa do produto de demonstração.',
  'SKU-DEMO-001',
  4599.00,
  true,
  true,
  20
);
*/
