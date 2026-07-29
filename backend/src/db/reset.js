import "dotenv/config";
import { Client } from "pg";

const client = new Client({
  user: process.env.DATABASE_USER || "postgres",
  password: process.env.DATABASE_PASSWORD || "Waltdisney142!",
  host: process.env.DATABASE_HOST || "localhost",
  port: process.env.DATABASE_PORT || 5432,
  database: "postgres",
});

async function reset() {
  try {
    await client.connect();
    console.log("Dropping bitlogic database…");
    await client.query("DROP DATABASE IF EXISTS bitlogic;");
    console.log("Creating bitlogic database…");
    await client.query("CREATE DATABASE bitlogic;");
    console.log("Database reset complete.");
    await client.end();
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

reset();
