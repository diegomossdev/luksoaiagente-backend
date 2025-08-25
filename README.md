# LuksoAI Backend API

Backend API desenvolvido com Fastify, Supabase e OpenAI para sistema de chat com IA.

## 🚀 Funcionalidades

- **Autenticação**: Sistema completo de login/registro via Supabase Auth
- **Autorização**: 2 roles (admin e user) com diferentes permissões
- **Chat com IA**: Integração com OpenAI GPT para conversas inteligentes
- **Histórico**: Salvamento de todas as conversas para análise administrativa
- **Gestão de Usuários**: Interface administrativa para gerenciar usuários

## 🛠️ Tecnologias

- **Node.js** - Runtime JavaScript
- **Fastify** - Framework web rápido e eficiente
- **Supabase** - Backend as a Service (auth, database)
- **OpenAI** - API para GPT
- **PostgreSQL** - Banco de dados (via Supabase)

## 📋 Pré-requisitos

- Node.js 18+
- Conta no Supabase
- API Key da OpenAI
- pnpm (gerenciador de pacotes)

## ⚙️ Configuração

### 1. Clone e instale dependências

```bash
cd backend
pnpm install
```

### 2. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em Settings > API para obter as keys
3. Execute os scripts SQL no SQL Editor do Supabase:

```sql
-- Execute primeiro: supabase/schema.sql
-- Execute depois: supabase/rls_policies.sql
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_key_aqui

# JWT Secret
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui

# OpenAI Configuration
OPENAI_API_KEY=sua_openai_key_aqui

# CORS Origin (Frontend URL)
CORS_ORIGIN=http://localhost:3001
```

### 4. Execute o servidor

```bash
# Desenvolvimento
pnpm dev

# Produção
pnpm start
```

## 📚 Endpoints da API

### 🔐 Autenticação (`/api/auth`)

- `POST /register` - Registrar novo usuário
- `POST /login` - Fazer login
- `POST /logout` - Fazer logout
- `POST /refresh` - Renovar token
- `GET /verify` - Verificar token

### 💬 Chat (`/api/chat`)

- `POST /start` - Iniciar nova conversa
- `POST /message` - Enviar mensagem
- `GET /threads` - Listar conversas do usuário
- `GET /threads/:id/messages` - Obter mensagens de uma conversa
- `DELETE /threads/:id` - Deletar conversa

### 👨‍💼 Administração (`/api/admin`)

- `GET /users` - Listar todos os usuários
- `GET /threads` - Listar todas as conversas
- `GET /threads/:id` - Ver conversa específica
- `GET /stats` - Estatísticas do sistema
- `PATCH /users/:id/role` - Alterar role do usuário
- `PATCH /users/:id/status` - Ativar/desativar usuário

## 📊 Estrutura do Banco

### Tabelas

- **profiles** - Perfis dos usuários (extensão do auth.users)
- **chat_threads** - Conversas/threads de chat
- **chat_messages** - Mensagens individuais

### Roles

- **user** - Usuário padrão (pode conversar com IA)
- **admin** - Administrador (pode ver todos os históricos + funcionalidades de user)

## 🔒 Segurança

- Row Level Security (RLS) habilitado
- Autenticação via JWT tokens
- Políticas de acesso baseadas em roles
- Validação de dados de entrada

## 🚦 Health Check

```bash
GET /health
```

Retorna status do servidor.

## 📝 Exemplos de Uso

### Registrar usuário

```javascript
POST /api/auth/register
{
  "email": "usuario@exemplo.com",
  "password": "senha123",
  "fullName": "Nome do Usuário",
  "role": "user" // opcional, padrão é "user"
}
```

### Fazer login

```javascript
POST /api/auth/login
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

### Iniciar conversa

```javascript
POST /api/chat/start
Headers: { "Authorization": "Bearer seu_token" }
{
  "title": "Minha conversa com IA"
}
```

### Enviar mensagem

```javascript
POST /api/chat/message
Headers: { "Authorization": "Bearer seu_token" }
{
  "thread_id": "uuid-da-thread",
  "content": "Olá, como você pode me ajudar?"
}
```

## 🔧 Desenvolvimento

### Scripts disponíveis

```bash
pnpm dev      # Servidor em modo desenvolvimento
pnpm start    # Servidor em modo produção
```

### Estrutura de pastas

```
src/
├── config/        # Configurações (Supabase)
├── middleware/    # Middlewares (autenticação)
├── routes/        # Rotas da API
├── services/      # Serviços (OpenAI)
└── server.js      # Servidor principal
```

## 🐛 Troubleshooting

### Erro de conexão com Supabase

- Verifique se as URLs e keys estão corretas
- Confirme que as tabelas foram criadas

### Erro de OpenAI

- Verifique se a API key está válida
- Confirme se há créditos na conta

### Erro de CORS

- Ajuste a variável `CORS_ORIGIN` no .env

## 📄 Licença

ISC License
