import cron from "node-cron";
import axios from "axios";

cron.schedule("*/5 * * * *", async () => {
  try {
     try {
    const response = await fetch(process.env.HEALTH_URL);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    console.log("Health check successful");
  } catch (error) {
    console.error("Health check failed:", error.message);
  }

  
});
