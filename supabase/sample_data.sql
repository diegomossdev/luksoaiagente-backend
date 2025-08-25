-- Este arquivo contém dados de exemplo para teste
-- Execute após configurar o schema e RLS

-- Inserir usuário admin de exemplo (ajuste o email)
-- Nota: O usuário deve ser criado primeiro via Auth, este INSERT é apenas para referência
/*
INSERT INTO profiles (id, email, full_name, role) 
VALUES (
    'uuid-do-usuario-admin-aqui',
    'admin@exemplo.com',
    'Administrador',
    'admin'
);
*/

-- Função para buscar estatísticas rápidas (útil para debug)
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE (
    total_users BIGINT,
    total_admins BIGINT,
    total_threads BIGINT,
    total_messages BIGINT,
    active_threads BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM profiles),
        (SELECT COUNT(*) FROM profiles WHERE role = 'admin'),
        (SELECT COUNT(*) FROM chat_threads),
        (SELECT COUNT(*) FROM chat_messages),
        (SELECT COUNT(*) FROM chat_threads WHERE status = 'active');
END;
$$ LANGUAGE plpgsql;

-- View para relatório de atividade dos usuários
CREATE OR REPLACE VIEW user_activity AS
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.active,
    p.created_at as user_created_at,
    COUNT(DISTINCT ct.id) as total_threads,
    COUNT(cm.id) as total_messages,
    MAX(cm.created_at) as last_message_at
FROM profiles p
LEFT JOIN chat_threads ct ON p.id = ct.user_id
LEFT JOIN chat_messages cm ON ct.id = cm.thread_id AND cm.role = 'user'
GROUP BY p.id, p.email, p.full_name, p.role, p.active, p.created_at
ORDER BY last_message_at DESC NULLS LAST;

-- View para threads mais ativas
CREATE OR REPLACE VIEW active_threads_summary AS
SELECT 
    ct.id,
    ct.title,
    ct.created_at,
    ct.updated_at,
    p.email as user_email,
    p.full_name as user_name,
    COUNT(cm.id) as message_count,
    MAX(cm.created_at) as last_message_at
FROM chat_threads ct
JOIN profiles p ON ct.user_id = p.id
LEFT JOIN chat_messages cm ON ct.id = cm.thread_id
WHERE ct.status = 'active'
GROUP BY ct.id, ct.title, ct.created_at, ct.updated_at, p.email, p.full_name
ORDER BY last_message_at DESC NULLS LAST;
