# CORREÇÃO URGENTE - Erro de Recursão Infinita RLS

## O Problema

O erro `infinite recursion detected in policy for relation "profiles"` acontece porque as políticas RLS estavam verificando roles consultando a própria tabela `profiles`, criando um loop infinito.

## Solução Aplicada

### 1. Código Backend Corrigido ✅

- Alterado middleware `authenticate` para usar `supabaseAdmin`
- Corrigidas todas as rotas de auth para usar cliente administrativo
- Isso evita as políticas RLS nas operações de autenticação

### 2. Políticas RLS Corrigidas

Execute o seguinte SQL no **SQL Editor** do seu Supabase:

```sql
-- EXECUTE ESTE ARQUIVO: supabase/rls_policies_fixed.sql
```

Ou copie e execute este script diretamente:

```sql
-- PRIMEIRO: Remova todas as políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
-- (continue com todas as outras políticas...)

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ===== POLÍTICAS CORRIGIDAS (SEM RECURSÃO) =====

-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Service role pode fazer qualquer operação (para o backend)
CREATE POLICY "Service role full access" ON profiles
    FOR ALL USING (
        current_setting('role') = 'service_role'
    );

-- Resto das políticas simplificadas...
```

## ⚠️ IMPORTANTE

1. **Execute primeiro**: `supabase/rls_policies_fixed.sql` no SQL Editor
2. **Reinicie o servidor**: `pnpm dev`
3. **Teste novamente**: a rota de login deve funcionar

## Como Testar

```bash
# Teste o login novamente
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu_email@teste.com",
    "password": "sua_senha"
  }'
```

## O Que Foi Alterado

### Backend

- `src/middleware/auth.js` → Usa `supabaseAdmin` para buscar perfis
- `src/routes/auth.js` → Todas as consultas à `profiles` usam cliente admin

### Database

- Políticas RLS simplificadas sem recursão
- Service role tem acesso total (necessário para o backend)
- Usuários ainda protegidos por RLS, mas sem loops

## Status: ✅ PRONTO PARA TESTE

Após executar o SQL corrigido, o erro deve desaparecer completamente.
