-- Agregar columna photo_url a la tabla profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT;
