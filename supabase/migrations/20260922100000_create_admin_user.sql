-- Crear usuario admin inicial
-- NOTA: Este script debe ejecutarse manualmente en el SQL Editor de Supabase
-- Ya que Supabase Auth requiere creación a través de su API

-- El proceso para crear un admin es:
-- 1. Usar la página de login del sistema cuando no hay admin
-- 2. O usar el panel de Supabase para crear el usuario en Auth
-- 3. Luego insertar el registro en user_roles con role = 'admin'

-- Ejemplo para insertar el rol admin después de crear el usuario en Auth:
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('TU_USER_ID_DE_SUPABASE_AUTH', 'admin');

-- También necesitas crear el perfil:
-- INSERT INTO profiles (id, full_name, username, phone, id_card, address)
-- VALUES ('TU_USER_ID_DE_SUPABASE_AUTH', 'Nombre Completo', 'username', 'telefono', 'id_card', 'direccion');