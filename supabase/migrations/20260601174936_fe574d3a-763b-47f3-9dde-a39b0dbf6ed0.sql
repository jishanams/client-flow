ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_deleted ON public.clients(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON public.invoices(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_deleted ON public.quotations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON public.payments(user_id) WHERE deleted_at IS NULL;