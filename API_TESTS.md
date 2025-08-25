# Testes da API - LuksoAI Backend

## Teste do Health Check

```bash
curl -X GET http://localhost:3000/health
```

## Teste de Registro de Usuário

```bash
# Registrar usuário normal
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@teste.com",
    "password": "senha123",
    "fullName": "Usuário Teste"
  }'

# Registrar primeiro admin (só funciona se não houver admins)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@teste.com",
    "password": "senha123",
    "fullName": "Admin Teste",
    "role": "admin"
  }'
```

## Teste de Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@teste.com",
    "password": "senha123"
  }'
```

## Teste de Verificação de Token

```bash
# Substitua SEU_TOKEN pelo token recebido no login
curl -X GET http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer SEU_TOKEN"
```

## Teste de Chat

```bash
# Iniciar nova conversa
curl -X POST http://localhost:3000/api/chat/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "title": "Minha primeira conversa"
  }'

# Enviar mensagem (substitua THREAD_ID)
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "thread_id": "THREAD_ID",
    "content": "Olá! Como você pode me ajudar hoje?"
  }'

# Listar conversas do usuário
curl -X GET http://localhost:3000/api/chat/threads \
  -H "Authorization: Bearer SEU_TOKEN"

# Ver mensagens de uma conversa
curl -X GET http://localhost:3000/api/chat/threads/THREAD_ID/messages \
  -H "Authorization: Bearer SEU_TOKEN"
```

## Testes Administrativos (token de admin necessário)

```bash
# Listar todos os usuários
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer TOKEN_ADMIN"

# Ver estatísticas
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer TOKEN_ADMIN"

# Listar todas as conversas
curl -X GET http://localhost:3000/api/admin/threads \
  -H "Authorization: Bearer TOKEN_ADMIN"

# Ver conversa específica
curl -X GET http://localhost:3000/api/admin/threads/THREAD_ID \
  -H "Authorization: Bearer TOKEN_ADMIN"

# Alterar role de usuário
curl -X PATCH http://localhost:3000/api/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -d '{
    "role": "admin"
  }'
```

## Variáveis de Ambiente para Testes

Certifique-se de ter configurado no arquivo `.env`:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=sua_url_do_supabase
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
JWT_SECRET=seu_jwt_secret
OPENAI_API_KEY=sua_openai_api_key
CORS_ORIGIN=http://localhost:3001
```

## Testando com Postman/Insomnia

Importe as seguintes configurações:

### Headers padrão

- Content-Type: application/json
- Authorization: Bearer {{token}} (para rotas protegidas)

### Ambiente de desenvolvimento

- Base URL: http://localhost:3000
- Token: (salve o token do login aqui)

## Ordem recomendada de testes

1. Health check
2. Registrar primeiro admin
3. Registrar usuário normal
4. Login com admin
5. Login com usuário
6. Verificar tokens
7. Testar chat com usuário
8. Testar funcionalidades admin
9. Testar alteração de roles
10. Verificar estatísticas
