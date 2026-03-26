import { Router } from "express";
import { getPushMeta, subscribePush, testPush } from "../controllers/push.controller.js";

const pushRouter = Router();

pushRouter.get("/meta", getPushMeta);
pushRouter.post("/subscribe", subscribePush);
pushRouter.post("/test", testPush);

export default pushRouter;
