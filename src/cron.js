import cron from "node-cron";
import axios from "axios";

cron.schedule("*/5 * * * *", async () => {
  try {
    const res = await axios.post(
      "https://your-api.com/graphql",
      {
        query: `
          query {
            health
          }
        `,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    console.log(res.data);
  } catch (err) {
    console.error(err.message);
  }
});
