
-- Tambahkan kolom yang mungkin belum tersedia
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS course TEXT;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS file_name TEXT;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS file_path TEXT;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Aktifkan RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Berikan akses
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT
ON public.tasks
TO anon, authenticated;

-- Perbaiki policy
DROP POLICY IF EXISTS "Public can view tasks"
ON public.tasks;

CREATE POLICY "Public can view tasks"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can upload tasks"
ON public.tasks;

CREATE POLICY "Public can upload tasks"
ON public.tasks
FOR INSERT
TO anon, authenticated
WITH CHECK (
    title IS NOT NULL
    AND course IS NOT NULL
    AND file_name IS NOT NULL
    AND file_path IS NOT NULL
);

-- Buat bucket jika belum ada
INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'task-files',
    'task-files',
    true,
    10485760,
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy membaca file
DROP POLICY IF EXISTS "Public can read task files"
ON storage.objects;

CREATE POLICY "Public can read task files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'task-files');

-- Policy upload file
DROP POLICY IF EXISTS "Public can upload task files"
ON storage.objects;

CREATE POLICY "Public can upload task files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'task-files');
