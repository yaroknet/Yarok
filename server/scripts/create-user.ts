/**
 * Creates a login user with a role, same as the "create-user" edge function does.
 *   npm run create-user -- --project ops|site --email admin@example.com --password secret123 --name "Admin" --role super_admin [--phone 0501234567] [--id <uuid>]
 */
import { parseArgs } from "node:util";
import "../config.ts";
import { createUser } from "../auth/users.ts";
import { closeDb, connectProject } from "../db.ts";
import { serviceContext } from "../policies.ts";
import { runInProject } from "../projects/context.ts";
import { projects } from "../projects/index.ts";
import { runInsert, runUpdate } from "../postgrest/engine.ts";
import { parseQuery } from "../postgrest/parse.ts";

const { values } = parseArgs({
  options: {
    project: { type: "string", default: "ops" },
    email: { type: "string" },
    phone: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "super_admin" },
    id: { type: "string" },
  },
});

const project = projects[values.project!];
if (!project || !values.password || (!values.email && !values.phone)) {
  console.error(
    `Usage: npm run create-user -- --project ${Object.keys(projects).join("|")} --email <email> --password <password> [--name <full name>] [--role <role>] [--phone <phone>] [--id <uuid>]`,
  );
  process.exit(1);
}

let phone = values.phone?.replace(/[\s\-()]/g, "") ?? null;
if (phone?.startsWith("0")) phone = "+972" + phone.slice(1);
if (phone && !phone.startsWith("+")) phone = "+" + phone;

await connectProject(project);
const service = serviceContext();
await runInProject(project, async () => {
  const user = await createUser({
    id: values.id,
    email: values.email,
    phone,
    password: values.password,
    user_metadata: { full_name: values.name || values.email || values.phone },
  });
  await runInsert("user_roles", [{ user_id: user._id, role: values.role }], parseQuery(new URLSearchParams()), service, {
    returning: false,
  });
  await runUpdate(
    "profiles",
    { full_name: values.name || values.email || values.phone, phone: values.phone ?? null, email: values.email ?? null },
    parseQuery(new URLSearchParams({ user_id: `eq.${user._id}` })),
    service,
    { returning: false },
  );
  console.log(`[${project.label}] created ${values.role} user ${values.email ?? values.phone} (id ${user._id})`);
});
await closeDb();
