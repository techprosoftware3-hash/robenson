-- Crear bucket de almacenamiento para fotos de clientes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('foto-kliyan', 'foto-kliyan', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en el bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Política para permitir a usuarios autenticados subir fotos
CREATE POLICY "Usuarios autenticados pueden subir fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'foto-kliyan'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir a usuarios autenticados ver sus propias fotos
CREATE POLICY "Usuarios autenticados pueden ver sus propias fotos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'foto-kliyan'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir a usuarios autenticados actualizar sus propias fotos
CREATE POLICY "Usuarios autenticados pueden actualizar sus propias fotos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'foto-kliyan'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'foto-kliyan'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir a administradores ver todas las fotos
CREATE POLICY "Administradores pueden ver todas las fotos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'foto-kliyan'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
