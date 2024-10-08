import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/schema.ts",
    out: "./src/migrations",
    dbCredentials: {
        url: process.env.POSTGRES_URL!,
    }
});