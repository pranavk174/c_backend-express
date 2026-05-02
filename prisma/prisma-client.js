import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL.split("?")[0];
console.log(connectionString , "connection string.")
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool, { schema: "chat_app" });
const prisma = new PrismaClient({ adapter });

export default prisma;
