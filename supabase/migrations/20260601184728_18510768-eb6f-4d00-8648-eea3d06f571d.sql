CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  service_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_status text NOT NULL DEFAULT 'pending',
  invoice_status text NOT NULL DEFAULT 'none',
  invoice_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ledger entries"
  ON public.ledger_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ledger_client ON public.ledger_entries(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ledger_user_date ON public.ledger_entries(user_id, entry_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER ledger_entries_set_updated_at
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
