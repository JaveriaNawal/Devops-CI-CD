import { Router, Response, NextFunction } from "express";
import Joi from "joi";
import { getPool } from "../db/connection";
import { AuthRequest, authenticate } from "../middleware/auth";
import logger from "../utils/logger";

export const tasksRouter = Router();

// ── Validation schemas ───────────────────────────────────────
const taskSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow("", null),
  status: Joi.string().valid("pending", "in_progress", "completed").default("pending"),
  priority: Joi.string().valid("low", "medium", "high").default("medium"),
  due_date: Joi.date().iso().allow(null),
});

// All routes here are protected
tasksRouter.use(authenticate);

// ── GET /api/tasks ──────────────────────────────────────────
tasksRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input("user_id", req.user?.id)
      .query("SELECT * FROM tasks WHERE user_id = @user_id ORDER BY created_at DESC");

    return res.json(result.recordset);
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/tasks ─────────────────────────────────────────
tasksRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = taskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const pool = getPool();
    const result = await pool.request()
      .input("user_id", req.user?.id)
      .input("title", value.title)
      .input("description", value.description)
      .input("status", value.status)
      .input("priority", value.priority)
      .input("due_date", value.due_date)
      .query(`
        INSERT INTO tasks (user_id, title, description, status, priority, due_date, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES (@user_id, @title, @description, @status, @priority, @due_date, GETUTCDATE(), GETUTCDATE())
      `);

    logger.info(`Task created by user ${req.user?.id}: ${value.title}`);
    return res.status(201).json(result.recordset[0]);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/tasks/:id ────────────────────────────────────
tasksRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = taskSchema.validate(req.body, { allowUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const pool = getPool();
    
    // First check ownership
    const check = await pool.request()
      .input("id", id)
      .input("user_id", req.user?.id)
      .query("SELECT id FROM tasks WHERE id = @id AND user_id = @user_id");

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const result = await pool.request()
      .input("id", id)
      .input("title", value.title)
      .input("description", value.description)
      .input("status", value.status)
      .input("priority", value.priority)
      .input("due_date", value.due_date)
      .query(`
        UPDATE tasks 
        SET title = @title, description = @description, status = @status, 
            priority = @priority, due_date = @due_date, updated_at = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    return res.json(result.recordset[0]);
  } catch (err) {
    return next(err);
  }
});

// ── DELETE /api/tasks/:id ───────────────────────────────────
tasksRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.request()
      .input("id", id)
      .input("user_id", req.user?.id)
      .query("DELETE FROM tasks OUTPUT DELETED.id WHERE id = @id AND user_id = @user_id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
