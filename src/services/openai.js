import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIService {
  static async createChatCompletion(messages, systemPrompt = null) {
    try {
      const messagesArray = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages]
        : messages;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messagesArray,
        temperature: 0.7,
        max_tokens: 1500,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("Erro na OpenAI:", error);
      throw new Error("Erro ao processar mensagem com OpenAI");
    }
  }

  static async createThread() {
    try {
      const thread = await openai.beta.threads.create();
      return thread.id;
    } catch (error) {
      console.error("Erro ao criar thread:", error);
      throw new Error("Erro ao criar thread OpenAI");
    }
  }

  static async addMessageToThread(threadId, content, role = "user") {
    try {
      if (!threadId || !content) {
        throw new Error("ThreadId e content são obrigatórios");
      }

      const message = await openai.beta.threads.messages.create(threadId, {
        role,
        content,
      });

      return message;
    } catch (error) {
      console.error("Erro ao adicionar mensagem à thread:", error);
      console.error("ThreadId:", threadId, "Content:", content);
      throw new Error("Erro ao adicionar mensagem à thread");
    }
  }

  static async threadsRuns(threadId, assistant_id) {
    try {
      if (!threadId || !assistant_id) {
        throw new Error("ThreadId e assistant_id são obrigatórios");
      }

      const response = await openai.beta.threads.runs.create(threadId, {
        assistant_id,
      });

      return response;
    } catch (error) {
      console.error("Erro na conexão com o assistente no thread:", error);
      console.error("ThreadId:", threadId, "AssistantId:", assistant_id);
      throw new Error("Erro na conexão com o assistente");
    }
  }

  // Método corrigido usando apenas o list que funciona
  static async getRunStatus(threadId, runId) {
    try {
      if (!threadId || !runId) {
        throw new Error("ThreadId e RunId são obrigatórios");
      }

      console.log(
        `🔍 Buscando status do run - threadId: ${threadId}, runId: ${runId}`
      );

      // Usar apenas o método list que está funcionando
      const response = await openai.beta.threads.runs.list(threadId, {
        limit: 10,
        order: "desc",
      });

      const run = response.data.find((r) => r.id === runId);

      if (!run) {
        throw new Error(`Run ${runId} não encontrado na thread ${threadId}`);
      }

      console.log(`✅ Status encontrado: ${run.status}`);
      return run;
    } catch (error) {
      console.error("❌ Erro ao buscar status do run:", error);
      console.error(`Parâmetros: threadId=${threadId}, runId=${runId}`);
      throw new Error("Erro ao buscar status do run");
    }
  }

  static async getThreadMessages(threadId) {
    try {
      if (!threadId) {
        throw new Error("ThreadId é obrigatório");
      }

      console.log(`🔍 Buscando mensagens da thread: ${threadId}`);

      const messages = await openai.beta.threads.messages.list(threadId);

      console.log(`✅ ${messages.data.length} mensagens encontradas`);
      return messages.data;
    } catch (error) {
      console.error("❌ Erro ao buscar mensagens da thread:", error);
      console.error("ThreadId:", threadId);
      throw new Error("Erro ao buscar mensagens da thread");
    }
  }

  // Método corrigido para aguardar conclusão do run
  static async waitForRunCompletion(threadId, runId, maxAttempts = 30) {
    try {
      console.log(`⏳ Aguardando conclusão do run ${runId}...`);

      let attempts = 0;
      while (attempts < maxAttempts) {
        // Usar o método corrigido
        const run = await this.getRunStatus(threadId, runId);

        console.log(
          `🔄 Tentativa ${attempts + 1}/${maxAttempts}: Status = ${run.status}`
        );

        if (run.status === "completed") {
          console.log("✅ Run completado com sucesso!");
          return run;
        }

        if (["failed", "cancelled", "expired"].includes(run.status)) {
          // Se o run falhou, vamos buscar mais detalhes
          console.error(`❌ Run falhou com status: ${run.status}`);

          // Vamos ver se há detalhes sobre o erro
          if (run.last_error) {
            console.error("Detalhes do erro:", run.last_error);
          }

          throw new Error(
            `Run falhou com status: ${run.status}${
              run.last_error ? ` - ${run.last_error.message}` : ""
            }`
          );
        }

        // Aguardar 1 segundo antes da próxima tentativa
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      throw new Error("Timeout: Run demorou muito para completar");
    } catch (error) {
      console.error("❌ Erro ao aguardar conclusão do run:", error);
      throw error;
    }
  }

  // Método para verificar detalhes do assistente
  static async getAssistantDetails(assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      console.log("📋 Detalhes do assistente:", {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        tools: assistant.tools,
      });
      return assistant;
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes do assistente:", error);
      throw error;
    }
  }
}

export default OpenAIService;
