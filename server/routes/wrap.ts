import type { NextFunction, Request, Response } from "express";
import { runInProject, type Project } from "../projects/context.ts";

export interface ProjectRequest extends Request {
  project?: Project;
}

/** Runs an async route handler inside its project's context and forwards errors */
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
    const project = (req as ProjectRequest).project;
    if (!project) return next(new Error("Route used outside of a project"));
    runInProject(project, () => fn(req, res)).catch(next);
  };
