import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { getPool } from "../db/connection";
import logger from "../utils/logger";

export const authRouter = Router();

// ── Validation schemas ───────────────────────────────────────
const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const registerSchema = Joi.object({
  name:     Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

function generateToken(userId: number, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign({ sub: userId, email }, secret, {
    expiresIn: "24h",
    issuer:    "myapp-api",
  });
}

// ── POST /api/auth/login ─────────────────────────────────────
authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const pool = getPool();
    const result = await pool.request()
      .input("email", value.email)
      .query("SELECT id, name, email, password_hash FROM users WHERE email = @email AND active = 1");

    if (result.recordset.length === 0) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = result.recordset[0] as {
      id: number; name: string; email: string; password_hash: string;
    };
    const passwordMatch = await bcrypt.compare(value.password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(user.id, user.email);
    logger.info(`User ${user.email} logged in successfully`);

    return res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/auth/register ──────────────────────────────────
authRouter.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const pool = getPool();

    const existing = await pool.request()
      .input("email", value.email)
      .query("SELECT id FROM users WHERE email = @email");

    if (existing.recordset.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(value.password, 12);

    const insert = await pool.request()
      .input("name",          value.name)
      .input("email",         value.email)
      .input("password_hash", passwordHash)
      .query(`
        INSERT INTO users (name, email, password_hash, active, created_at)
        OUTPUT INSERTED.id
        VALUES (@name, @email, @password_hash, 1, GETUTCDATE())
      `);

    const userId = (insert.recordset[0] as { id: number }).id;
    const token  = generateToken(userId, value.email);

    logger.info(`New user registered: ${value.email}`);

    return res.status(201).json({ token, user: { id: userId, name: value.name, email: value.email } });
  } catch (err) {
    return next(err);
  }
});
