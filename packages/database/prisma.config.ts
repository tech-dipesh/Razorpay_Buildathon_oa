import { config } from "dotenv";
import {resolve} from "node:path"
import { defineConfig, env } from "prisma/config";
config({ path: resolve("../../.env") });
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL")
  },
});
