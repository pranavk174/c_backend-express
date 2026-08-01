/* eslint-disable no-undef */
import cron from "node-cron";

cron.schedule("*/1 * * * *", async () => {
  logger.debug("triggered cronjob");
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
