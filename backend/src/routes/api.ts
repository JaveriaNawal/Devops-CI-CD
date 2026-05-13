import { Router, Request, Response } from "express";
import { tasksRouter } from "./tasks";

export const apiRouter = Router();

// Mount tasks routes
apiRouter.use("/tasks", tasksRouter);

// Example protected resource route
apiRouter.get("/items", (_req: Request, res: Response) => {
  res.json({ items: [], message: "API operational" });
});
