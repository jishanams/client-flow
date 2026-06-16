
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  pay_period TEXT,
  pay_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'unpaid',
  method TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salaries TO authenticated;
GRANT ALL ON public.salaries TO service_role;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salaries select" ON public.salaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own salaries insert" ON public.salaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own salaries update" ON public.salaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own salaries delete" ON public.salaries FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_salaries_updated BEFORE UPDATE ON public.salaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.letter_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_templates TO authenticated;
GRANT ALL ON public.letter_templates TO service_role;
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates select" ON public.letter_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own templates insert" ON public.letter_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own templates update" ON public.letter_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own templates delete" ON public.letter_templates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_letter_templates_updated BEFORE UPDATE ON public.letter_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
