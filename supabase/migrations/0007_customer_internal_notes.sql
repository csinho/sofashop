ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.customers.internal_notes IS 'Observações internas da loja sobre o cliente (não visíveis no catálogo).';
