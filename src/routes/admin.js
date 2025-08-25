import { supabase } from "../config/supabase.js";
import { requireAdmin } from "../middleware/auth.js";

export default async function adminRoutes(fastify, options) {
  // Listar todos os usuários
  fastify.get(
    "/users",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { page = 1, limit = 10, role } = request.query;
        const offset = (page - 1) * limit;

        let query = supabase
          .from("profiles")
          .select(
            `
          id,
          email,
          full_name,
          role,
          created_at,
          updated_at
        `
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (role) {
          query = query.eq("role", role);
        }

        const { data: users, error } = await query;

        if (error) {
          console.error("Erro ao buscar usuários:", error);
          return reply.status(500).send({
            error: "Erro ao carregar usuários",
          });
        }

        // Contar total de usuários
        const { count, error: countError } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        return reply.send({
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || 0,
          },
        });
      } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Listar todas as threads de chat
  fastify.get(
    "/threads",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { page = 1, limit = 10, userId, status } = request.query;
        const offset = (page - 1) * limit;

        let query = supabase
          .from("chat_threads")
          .select(
            `
          id,
          title,
          status,
          created_at,
          updated_at,
          openai_thread_id,
          profiles (
            id,
            email,
            full_name,
            role
          )
        `
          )
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (userId) {
          query = query.eq("user_id", userId);
        }

        if (status) {
          query = query.eq("status", status);
        }

        const { data: threads, error } = await query;

        if (error) {
          console.error("Erro ao buscar threads:", error);
          return reply.status(500).send({
            error: "Erro ao carregar conversas",
          });
        }

        return reply.send({
          threads,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: threads.length,
          },
        });
      } catch (error) {
        console.error("Erro ao listar threads:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Visualizar thread específica com todas as mensagens
  fastify.get(
    "/threads/:threadId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { threadId } = request.params;

        const { data: thread, error: threadError } = await supabase
          .from("chat_threads")
          .select(
            `
          id,
          title,
          status,
          created_at,
          updated_at,
          openai_thread_id,
          profiles (
            id,
            email,
            full_name,
            role
          ),
          chat_messages (
            id,
            content,
            role,
            created_at,
            updated_at
          )
        `
          )
          .eq("id", threadId)
          .single();

        if (threadError || !thread) {
          return reply.status(404).send({
            error: "Thread não encontrada",
          });
        }

        return reply.send({
          thread,
        });
      } catch (error) {
        console.error("Erro ao buscar thread:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Estatísticas gerais
  fastify.get(
    "/stats",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        // Contar usuários por role
        const { data: userStats, error: userError } = await supabase
          .from("profiles")
          .select("role")
          .order("role");

        if (userError) {
          console.error("Erro ao buscar estatísticas de usuários:", userError);
          return reply.status(500).send({
            error: "Erro ao carregar estatísticas",
          });
        }

        const usersByRole = userStats.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {});

        // Contar threads ativas
        const { count: activeThreads, error: threadsError } = await supabase
          .from("chat_threads")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");

        if (threadsError) {
          console.error("Erro ao buscar threads ativas:", threadsError);
        }

        // Contar total de mensagens
        const { count: totalMessages, error: messagesError } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true });

        if (messagesError) {
          console.error("Erro ao buscar total de mensagens:", messagesError);
        }

        // Mensagens dos últimos 7 dias
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { count: weekMessages, error: weekError } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString());

        if (weekError) {
          console.error("Erro ao buscar mensagens da semana:", weekError);
        }

        return reply.send({
          users: {
            total: userStats.length,
            by_role: usersByRole,
          },
          threads: {
            active: activeThreads || 0,
          },
          messages: {
            total: totalMessages || 0,
            last_week: weekMessages || 0,
          },
        });
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Atualizar role de usuário
  fastify.patch(
    "/users/:userId/role",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const { role } = request.body;

        if (!role || !["user", "admin"].includes(role)) {
          return reply.status(400).send({
            error: 'Role deve ser "user" ou "admin"',
          });
        }

        const { data, error } = await supabase
          .from("profiles")
          .update({ role, updated_at: new Date().toISOString() })
          .eq("id", userId)
          .select()
          .single();

        if (error) {
          console.error("Erro ao atualizar role:", error);
          return reply.status(500).send({
            error: "Erro ao atualizar role do usuário",
          });
        }

        return reply.send({
          message: "Role atualizado com sucesso",
          user: data,
        });
      } catch (error) {
        console.error("Erro ao atualizar role:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Desativar/Ativar usuário
  fastify.patch(
    "/users/:userId/status",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const { active } = request.body;

        if (typeof active !== "boolean") {
          return reply.status(400).send({
            error: 'Status "active" deve ser true ou false',
          });
        }

        const { data, error } = await supabase
          .from("profiles")
          .update({
            active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select()
          .single();

        if (error) {
          console.error("Erro ao atualizar status:", error);
          return reply.status(500).send({
            error: "Erro ao atualizar status do usuário",
          });
        }

        return reply.send({
          message: `Usuário ${active ? "ativado" : "desativado"} com sucesso`,
          user: data,
        });
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Ver todas as conversas (para admin)
  fastify.get(
    "/conversations",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { page = 1, limit = 20 } = request.query;
        const offset = (page - 1) * limit;

        // Buscar todas as threads com nova estrutura
        const { data: threads, error } = await supabaseAdmin
          .from("chat_threads")
          .select(
            "id, client_id, client_fullname, openai_thread_id, created_at, updated_at"
          )
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error("Erro ao buscar conversas:", error);
          return reply.status(500).send({
            error: "Erro ao carregar conversas",
          });
        }

        // Formatar resposta para o admin
        const formattedThreads = threads.map((thread) => ({
          id: thread.id,
          clientId: thread.client_id,
          clientFullname: thread.client_fullname,
          threadId: thread.openai_thread_id,
          createdAt: thread.created_at,
          updatedAt: thread.updated_at,
        }));

        return reply.send({
          conversations: formattedThreads,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: threads.length,
          },
        });
      } catch (error) {
        console.error("Erro ao listar conversas:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Ver mensagens de uma conversa específica (para admin)
  fastify.get(
    "/conversations/:threadId/messages",
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { threadId } = request.params;

        // Verificar se a thread existe e buscar informações do cliente
        const { data: thread, error: threadError } = await supabaseAdmin
          .from("chat_threads")
          .select(
            "id, client_id, client_fullname, openai_thread_id, created_at"
          )
          .eq("openai_thread_id", threadId)
          .single();

        if (threadError || !thread) {
          return reply.status(404).send({
            error: "Thread não encontrada",
          });
        }

        // Buscar mensagens do OpenAI
        const messages = await OpenAIService.getThreadMessages(threadId);

        return reply.send({
          threadInfo: {
            id: thread.id,
            clientId: thread.client_id,
            clientFullname: thread.client_fullname,
            threadId: thread.openai_thread_id,
            createdAt: thread.created_at,
          },
          messages: messages,
        });
      } catch (error) {
        console.error("Erro ao buscar mensagens da conversa:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );
}
