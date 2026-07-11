import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing");
}

const connectionString = databaseUrl.split("?")[0];
// console.log(connectionString , "connection string.")
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool, { schema: "chat_app" });
const prisma = new PrismaClient({ adapter });

export default prisma;
