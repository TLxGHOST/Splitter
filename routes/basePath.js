import express from "express";
import { eventFiller } from "../middleware/eventLoader.js";
import { handleRegister } from "../controller/authController.js";
const router=express.Router();

router.get("/", eventFiller, (req, res) => {
  if (req.session.view) {
    req.session.view += 1;
  }
  else {
    req.session.view = 1;
  }
  console.log(req.session.view);
  res.render("home");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.get("/register", (req, res) => {
  res.render("register");
});

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

router.get("/dashboard", eventFiller, (req, res) => {
  res.render("dashboard");
});

router.post("/register", handleRegister);


export default router;