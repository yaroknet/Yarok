import type { Project } from "./context.ts";
import { opsProject } from "./ops/index.ts";
import { siteProject } from "./site/index.ts";

export const projects: Record<string, Project> = {
  site: siteProject,
  ops: opsProject,
};
