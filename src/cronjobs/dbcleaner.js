
import cron from "node-cron";

import prisma from "../../prisma/prisma-client.js";
import { logger } from "../utils/logger.js";
cron.schedule("0 0 * * *", async () => {
  logger.debug("triggered cronjob");
  try {
    await prisma.$executeRaw`
  DELETE FROM register
  WHERE expires_at < NOW();
`;

    logger.debug("unwanted data deleted");
  } catch (error) {
    logger.error("error in db clean job:", error.message);
  }
});
