import app from "./app";
import { logger } from "./lib/logger";
import { startScrimsPolling } from "./routes/scrims";
import { startDailyEventsPoller } from "./lib/daily-events-poller";

const port = 3000;

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening");
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

