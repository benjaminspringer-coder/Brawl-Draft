import app, { setupFrontend } from "./server/app";
import { logger } from "./server/lib/logger";
import { startScrimsPolling } from "./server/routes/scrims";
import { startDailyEventsPoller } from "./server/lib/daily-events-poller";

async function main() {
  await setupFrontend(app);
  const port = 3000;

  app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, `Server listening on http://0.0.0.0:${port}`);
    try {
      startScrimsPolling();
    } catch (e) {
      logger.warn({ err: e }, "Failed to start scrims polling");
    }
    try {
      startDailyEventsPoller();
    } catch (e) {
      logger.warn({ err: e }, "Failed to start daily events poller");
    }
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});

