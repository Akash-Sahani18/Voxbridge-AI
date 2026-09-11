import { pool } from "./connection";

async function testDatabaseConnection() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    console.log("PostgreSQL connection successful.");
    console.log("Database:", result.rows[0].database);
    console.log("Server time:", result.rows[0].server_time);
  } catch (error) {
    console.error("PostgreSQL connection failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();