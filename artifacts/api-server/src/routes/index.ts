import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import goalsRouter from "./goals";
import subscriptionsRouter from "./subscriptions";
import dashboardRouter from "./dashboard";
import plaidRouter from "./plaid";
import aiRouter from "./ai";
import gocardlessRouter from "./gocardless";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(categoriesRouter);
router.use(transactionsRouter);
router.use(budgetsRouter);
router.use(goalsRouter);
router.use(subscriptionsRouter);
router.use(dashboardRouter);
router.use(plaidRouter);
router.use(aiRouter);
router.use(gocardlessRouter);

export default router;
