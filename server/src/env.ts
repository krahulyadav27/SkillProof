import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// All workspaces read the same root-level .env, independent of process.cwd().
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(moduleDirectory, "../../.env") });
