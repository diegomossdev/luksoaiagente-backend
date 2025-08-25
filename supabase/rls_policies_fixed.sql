-- PRIMEIRO: Remova todas as políticas existentes se houver alguma
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can create own threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can update own threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can delete own threads" ON chat_threads;
DROP POLICY IF EXISTS "Admins can view all threads" ON chat_threads;
DROP POLICY IF EXISTS "Admins can update all threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can view messages from own threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages in own threads" ON chat_messages;
DROP POLICY IF EXISTS "Service role can insert AI messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete messages from own threads" ON chat_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can delete all messages" ON chat_messages;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES POLICIES (SEM RECURSÃO) =====

-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Usuários podem atualizar apenas seu próprio perfil (exceto role)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (
        auth.uid() = id 
        AND (
            OLD.role = NEW.role OR -- não pode alterar a própria role
            auth.uid() IN (
                SELECT id FROM auth.users 
                WHERE raw_user_meta_data->>'role' = 'admin'
            )
        )
    );

-- Service role pode fazer qualquer operação (para criação automática)
CREATE POLICY "Service role full access" ON profiles
    FOR ALL USING (
        current_setting('role') = 'service_role'
    );

-- ===== CHAT THREADS POLICIES =====

-- Usuários podem ver apenas suas próprias threads
CREATE POLICY "Users can view own threads" ON chat_threads
    FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem criar threads para si mesmos
CREATE POLICY "Users can create own threads" ON chat_threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias threads
CREATE POLICY "Users can update own threads" ON chat_threads
    FOR UPDATE USING (auth.uid() = user_id);

-- Usuários podem deletar suas próprias threads
CREATE POLICY "Users can delete own threads" ON chat_threads
    FOR DELETE USING (auth.uid() = user_id);

-- ===== CHAT MESSAGES POLICIES =====

-- Usuários podem ver mensagens de suas próprias threads
CREATE POLICY "Users can view messages from own threads" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_threads 
            WHERE id = thread_id AND user_id = auth.uid()
        )
    );

-- Usuários podem criar mensagens em suas próprias threads
CREATE POLICY "Users can create messages in own threads" ON chat_messages
    FOR INSERT WITH CHECK (
        (role = 'user' AND user_id = auth.uid()) OR
        (role = 'assistant' AND user_id IS NULL) OR
        current_setting('role') = 'service_role'
    );

-- Usuários podem atualizar suas próprias mensagens
CREATE POLICY "Users can update own messages" ON chat_messages
    FOR UPDATE USING (
        user_id = auth.uid() OR
        current_setting('role') = 'service_role'
    );

-- Usuários podem deletar mensagens de suas próprias threads
CREATE POLICY "Users can delete messages from own threads" ON chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_threads 
            WHERE id = thread_id AND user_id = auth.uid()
        ) OR
        current_setting('role') = 'service_role'
    );

-- ===== FUNÇÕES AUXILIARES PARA VERIFICAR ADMIN (SEM RLS) =====

-- Função para verificar se usuário é admin (usa auth.users diretamente)
CREATE OR REPLACE FUNCTION is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = user_id AND role = 'admin'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter role do usuário
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = user_id;
    RETURN COALESCE(user_role, 'user');
EXCEPTION WHEN OTHERS THEN
    RETURN 'user';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
