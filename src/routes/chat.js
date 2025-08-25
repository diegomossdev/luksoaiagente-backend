import { supabase, supabaseAdmin } from "../config/supabase.js";
import { OpenAIService } from "../services/openai.js";
import { requireUser } from "../middleware/auth.js";

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

export default async function chatRoutes(fastify, options) {
  fastify.post(
    "/conversation",
    { preHandler: requireUser },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const userFullName =
          request.user.full_name || request.user.email || "Usuário";
        const { threadId: existingThreadId, message } = request.body;

        if (!message) {
          return reply.status(400).send({
            error: "Mensagem é obrigatória",
          });
        }

        let threadId = existingThreadId;

        // Se não há threadId, criar novo thread
        if (!threadId) {
          threadId = await OpenAIService.createThread();

          if (!threadId) {
            throw new Error("Falha ao criar thread no OpenAI");
          }

          // Salvar apenas a associação client_id -> threadID no banco
          const { error: threadError } = await supabaseAdmin
            .from("chat_threads")
            .insert({
              client_id: userId,
              client_fullname: userFullName,
              openai_thread_id: threadId,
            });

          if (threadError) {
            console.error("Erro ao criar thread no banco:", threadError);
            throw new Error("Erro ao salvar thread no banco de dados");
          }

          console.log(
            `✅ Nova thread criada - Client: ${userFullName} (${userId}), ThreadId: ${threadId}`
          );
        } else {
          // Verificar se a thread pertence ao usuário
          const { data: thread, error: threadError } = await supabaseAdmin
            .from("chat_threads")
            .select("id")
            .eq("openai_thread_id", threadId)
            .eq("client_id", userId)
            .single();

          if (threadError || !thread) {
            return reply.status(404).send({
              error: "Thread não encontrada ou não pertence ao usuário",
            });
          }

          console.log(
            `✅ Thread existente - Client: ${userFullName} (${userId}), ThreadId: ${threadId}`
          );
        }

        // Adicionar mensagem do usuário ao thread do OpenAI
        await OpenAIService.addMessageToThread(threadId, message, "user");

        // Verificar se o assistente está acessível
        try {
          await OpenAIService.getAssistantDetails(ASSISTANT_ID);
        } catch (error) {
          console.error("⚠️ Problema com o assistente:", error);
          return reply.status(500).send({
            success: false,
            error: "Assistente não está disponível. Verifique o ASSISTANT_ID.",
          });
        }

        // Executar o assistente
        const runResponse = await OpenAIService.threadsRuns(
          threadId,
          ASSISTANT_ID
        );

        console.log("🚀 Run iniciado:", runResponse.id);
        console.log("🔗 ThreadId usado:", threadId);

        // Aguardar conclusão do run usando método corrigido
        const completedRun = await OpenAIService.waitForRunCompletion(
          threadId,
          runResponse.id,
          30 // máximo 30 segundos
        );

        // Buscar mensagens do thread do OpenAI
        const messages = await OpenAIService.getThreadMessages(threadId);

        // Filtrar apenas respostas do assistente (mais recente)
        const assistantResponses = messages.filter(
          (msg) => msg.role === "assistant"
        );

        if (!assistantResponses || assistantResponses.length === 0) {
          throw new Error("Nenhuma resposta do assistente encontrada");
        }

        const latestResponse = assistantResponses[0];
        let responseText = "Erro ao processar a mensagem.";

        // Extrair texto da resposta
        if (latestResponse.content && latestResponse.content.length > 0) {
          const textContent = latestResponse.content.find(
            (content) => content.type === "text"
          );
          if (textContent && textContent.text && textContent.text.value) {
            responseText = textContent.text.value;
          }
        }

        // Atualizar última atividade da thread no banco
        await supabaseAdmin
          .from("chat_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("openai_thread_id", threadId);

        console.log("✅ Resposta do assistente:", responseText);
        console.log("🔗 ThreadId OpenAI:", threadId);

        return reply.send({
          success: true,
          data: {
            threadId: threadId,
            clientName: userFullName,
            role: "assistant",
            message: responseText,
          },
        });
      } catch (error) {
        console.error("❌ Erro na conversa:", error);
        return reply.status(500).send({
          success: false,
          error: error.message || "Erro ao processar a solicitação.",
        });
      }
    }
  );

  // Iniciar nova conversa
  fastify.post(
    "/start",
    { preHandler: requireUser },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const userFullName =
          request.user.full_name || request.user.email || "Usuário";

        // Criar thread no OpenAI
        const threadId = await OpenAIService.createThread();

        // Salvar thread no banco usando nova estrutura
        const { data: thread, error } = await supabaseAdmin
          .from("chat_threads")
          .insert({
            client_id: userId,
            client_fullname: userFullName,
            openai_thread_id: threadId,
          })
          .select()
          .single();

        if (error) {
          console.error("Erro ao criar thread:", error);
          return reply.status(500).send({
            error: "Erro ao criar nova conversa",
          });
        }

        return reply.send({
          message: "Conversa iniciada com sucesso",
          thread: {
            id: thread.id,
            client_id: thread.client_id,
            client_fullname: thread.client_fullname,
            openai_thread_id: thread.openai_thread_id,
            created_at: thread.created_at,
          },
        });
      } catch (error) {
        console.error("Erro ao iniciar conversa:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Listar threads do usuário (com paginação correta)
  fastify.get(
    "/threads",
    { preHandler: requireUser },
    async (request, reply) => {
      try {
        const userId = request.user.id;

        // query params chegam como string — normalize e faça saneamento
        const page = Math.max(1, parseInt(request.query.page ?? "1", 10));
        const limit = Math.min(
          100, // limite de segurança
          Math.max(1, parseInt(request.query.limit ?? "10", 10))
        );

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const {
          data: threads,
          count,
          error,
        } = await supabaseAdmin
          .from("chat_threads")
          .select(
            "id, client_id, client_fullname, openai_thread_id, created_at, updated_at",
            { count: "exact" } // <- pega o total ignorando o range
          )
          // .eq("client_id", userId)
          .order("updated_at", { ascending: false })
          .range(from, to);

        if (error) {
          request.log.error({ err: error }, "Erro ao buscar threads");
          return reply
            .status(500)
            .send({ error: "Erro ao carregar conversas" });
        }

        return reply.send({
          threads: (threads ?? []).map((t) => ({
            id: t.id,
            clientId: t.client_id,
            clientFullname: t.client_fullname,
            threadId: t.openai_thread_id,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          })),
          pagination: {
            page,
            limit,
            total: count ?? 0,
            totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
            hasNextPage: (count ?? 0) > to + 1,
            hasPrevPage: page > 1,
          },
        });
      } catch (err) {
        request.log.error({ err }, "Erro ao listar threads");
        return reply.status(500).send({ error: "Erro interno do servidor" });
      }
    }
  );

  // Obter mensagens de uma thread do OpenAI
  fastify.get(
    "/threads/:threadId/messages",
    { preHandler: requireUser },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { threadId } = request.params;

        // Verificar se a thread pertence ao usuário usando nova estrutura
        const { data: thread, error: threadError } = await supabaseAdmin
          .from("chat_threads")
          .select("openai_thread_id, client_fullname")
          .eq("openai_thread_id", threadId)
          .eq("client_id", userId)
          .single();

        if (threadError || !thread) {
          return reply.status(404).send({
            error: "Thread não encontrada ou não pertence ao usuário",
          });
        }

        // Buscar mensagens diretamente do OpenAI
        const messages = await OpenAIService.getThreadMessages(threadId);

        return reply.send({
          messages,
          threadId: threadId,
          clientFullname: thread.client_fullname,
        });
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  // Deletar thread
  fastify.delete(
    "/threads/:threadId",
    { preHandler: requireUser },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { threadId } = request.params;

        // Verificar se a thread pertence ao usuário usando nova estrutura
        const { data: thread, error: threadError } = await supabaseAdmin
          .from("chat_threads")
          .select("id, client_fullname")
          .eq("openai_thread_id", threadId)
          .eq("client_id", userId)
          .single();

        if (threadError || !thread) {
          return reply.status(404).send({
            error: "Thread não encontrada ou não pertence ao usuário",
          });
        }

        // Deletar apenas o registro da thread (não deletamos no OpenAI)
        const { error } = await supabaseAdmin
          .from("chat_threads")
          .delete()
          .eq("id", thread.id);

        if (error) {
          console.error("Erro ao deletar thread:", error);
          return reply.status(500).send({
            error: "Erro ao deletar conversa",
          });
        }

        return reply.send({
          message: `Conversa de ${thread.client_fullname} removida com sucesso`,
        });
      } catch (error) {
        console.error("Erro ao deletar thread:", error);
        return reply.status(500).send({
          error: "Erro interno do servidor",
        });
      }
    }
  );
}
