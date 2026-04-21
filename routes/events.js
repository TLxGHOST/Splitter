import express from "express";
import { handleCreateEvent } from "../controller/eventController.js";
import { eventFiller } from "../middleware/eventLoader.js";

const router = express.Router();

router.get("/create", eventFiller, (req, res) => {
  res.render("create-event");
});

router.post("/create", handleCreateEvent);

export default router;