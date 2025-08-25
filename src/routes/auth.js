import { supabase, supabaseAdmin } from "../config/supabase.js";

export default async function authRoutes(fastify, options) {
  // Registro de usuário
  fastify.post("/register", async (request, reply) => {
    try {
      const { email, password, fullName, role = "user" } = request.body;

      if (!email || !password || !fullName) {
        return reply.status(400).send({
          error: "Email, senha e nome completo são obrigatórios",
        });
      }

      // Verificar se é um registro de admin (apenas admins podem criar outros admins)
      if (role === "admin") {
        // Verificar se já existe algum admin (primeiro admin pode ser criado livremente)
        const { data: existingAdmins } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("role", "admin");

        if (existingAdmins && existingAdmins.length > 0) {
          return reply.status(403).send({
            error: "Apenas administradores podem criar outros administradores",
          });
        }
      }

      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        console.error("Erro no registro:", authError);
        return reply.status(400).send({
          error: authError.message,
        });
      }

      // Criar perfil do usuário usando cliente admin
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          role: role,
        });

      if (profileError) {
        console.error("Erro ao criar perfil:", profileError);
        // Tentar deletar o usuário criado se o perfil falhar
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return reply.status(400).send({
          error: "Erro ao criar perfil do usuário",
        });
      }

      return reply.send({
        message: "Usuário registrado com sucesso",
        user: {
          id: authData.user.id,
          email,
          full_name: fullName,
          role,
        },
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      return reply.status(500).send({
        error: "Erro interno do servidor",
      });
    }
  });

  // Login de usuário
  fastify.post("/login", async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          error: "Email e senha são obrigatórios",
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Erro no login:", error);
        return reply.status(401).send({
          error: "Credenciais inválidas",
        });
      }

      // Buscar dados do perfil usando cliente admin para evitar RLS
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Erro ao buscar perfil:", profileError);
        return reply.status(500).send({
          error: "Erro ao carregar dados do usuário",
        });
      }

      return reply.send({
        message: "Login realizado com sucesso",
        user: {
          id: data.user.id,
          email: data.user.email,
          ...profile,
        },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch (error) {
      console.error("Erro no login:", error);
      return reply.status(500).send({
        error: "Erro interno do servidor",
      });
    }
  });

  // Logout
  fastify.post("/logout", async (request, reply) => {
    try {
      const authorization = request.headers.authorization;

      if (authorization) {
        const token = authorization.replace("Bearer ", "");
        await supabase.auth.signOut(token);
      }

      return reply.send({
        message: "Logout realizado com sucesso",
      });
    } catch (error) {
      console.error("Erro no logout:", error);
      return reply.status(500).send({
        error: "Erro interno do servidor",
      });
    }
  });

  // Refresh Token
  fastify.post("/refresh", async (request, reply) => {
    try {
      const { refresh_token } = request.body;

      if (!refresh_token) {
        return reply.status(400).send({
          error: "Refresh token é obrigatório",
        });
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });

      if (error) {
        console.error("Erro no refresh:", error);
        return reply.status(401).send({
          error: "Refresh token inválido",
        });
      }

      return reply.send({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch (error) {
      console.error("Erro no refresh:", error);
      return reply.status(500).send({
        error: "Erro interno do servidor",
      });
    }
  });

  // Verificar token
  fastify.get("/verify", async (request, reply) => {
    try {
      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.status(401).send({
          error: "Token não fornecido",
        });
      }

      const token = authorization.replace("Bearer ", "");

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return reply.status(401).send({
          error: "Token inválido",
        });
      }

      // Buscar dados do perfil usando cliente admin
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Erro ao buscar perfil:", profileError);
        return reply.status(500).send({
          error: "Erro ao carregar dados do usuário",
        });
      }

      return reply.send({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          ...profile,
        },
      });
    } catch (error) {
      console.error("Erro na verificação:", error);
      return reply.status(500).send({
        error: "Erro interno do servidor",
      });
    }
  });
}
