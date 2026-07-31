import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tournamentsRouter from "./tournaments";
import matchesRouter from "./matches";
import statsRouter from "./stats";
import proTeamsRouter from "./pro-teams";
import scrimsRouter from "./scrims";
import brawlerStatsRouter from "./brawler-stats";
import metaRouter from "./meta";
import teamsRouter from "./teams";
import corestatsScannerRouter from "./corestats-scanner";
const router: IRouter = Router();

router.use(healthRouter);
router.use(tournamentsRouter);
router.use(matchesRouter);
router.use(statsRouter);
router.use(proTeamsRouter);
router.use(scrimsRouter);
router.use(brawlerStatsRouter);
router.use(metaRouter);
router.use(teamsRouter);
router.use(corestatsScannerRouter);

export default router;
