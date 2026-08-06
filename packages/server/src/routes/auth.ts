import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.js";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const COOKIE_NAME = "nexo_admin_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "email and password are required" });
    }

    const { email, password } = parsed.data;
    const user = await prisma.adminUser.findUnique({ where: { email } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "7d" });
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return { email: user.email };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return reply.status(401).send({ error: "Not authenticated" });

    try {
      const payload = app.jwt.verify<{ sub: string; email: string }>(token);
      return { email: payload.email };
    } catch {
      return reply.status(401).send({ error: "Not authenticated" });
    }
  });
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return reply.status(401).send({ error: "Not authenticated" });
  }
  try {
    req.server.jwt.verify(token);
  } catch {
    return reply.status(401).send({ error: "Not authenticated" });
  }
}
