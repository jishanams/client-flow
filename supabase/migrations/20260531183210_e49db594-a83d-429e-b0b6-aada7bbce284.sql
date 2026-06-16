
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "logos auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "logos auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "logos auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
