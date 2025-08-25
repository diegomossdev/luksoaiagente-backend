import { supabase, supabaseAdmin } from "../config/supabase.js";

export async function authenticate(request, reply) {
  try {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.status(401).send({
        error: "Token de autenticação necessário",
        code: "MISSING_TOKEN",
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
        code: "INVALID_TOKEN",
      });
    }

    // Buscar dados adicionais do usuário na tabela profiles usando cliente admin
    // para evitar problemas com RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Erro ao buscar perfil:", profileError);
      return reply.status(500).send({
        error: "Erro interno do servidor",
        code: "PROFILE_ERROR",
      });
    }

    // Adicionar usuário e perfil à request
    request.user = {
      ...user,
      profile,
    };
  } catch (error) {
    console.error("Erro na autenticação:", error);
    return reply.status(401).send({
      error: "Erro de autenticação",
      code: "AUTH_ERROR",
    });
  }
}

export async function requireAdmin(request, reply) {
  await authenticate(request, reply);

  if (!request.user?.profile?.role || request.user.profile.role !== "admin") {
    return reply.status(403).send({
      error: "Acesso negado - Privilégios de administrador necessários",
      code: "ADMIN_REQUIRED",
    });
  }
}

export async function requireUser(request, reply) {
  await authenticate(request, reply);

  const allowedRoles = ["user", "admin"];
  if (
    !request.user?.profile?.role ||
    !allowedRoles.includes(request.user.profile.role)
  ) {
    return reply.status(403).send({
      error: "Acesso negado",
      code: "USER_REQUIRED",
    });
  }
}
