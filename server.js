import express from "express";
import dotenv from "dotenv";
import db from "./db.js";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const saltRound = process.env.SALT_ROUND;

db.connect();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Helper to render pages inside the layout
function renderPage(res, view, data = {}) {
  res.render("layout", { view, data });
}

app.get("/", (req, res) => {
  renderPage(res, "home");
});

app.get("/login", (req, res) => {
  renderPage(res, "login");
});

app.get("/register", (req, res) => {
  renderPage(res, "register");
});

app.get("/dashboard", (req, res) => {
  const events = []; // replace with DB later
  renderPage(res, "dashboard", { events });
});

app.get("/events/create", (req, res) => {
  renderPage(res, "create-event");
})

app.get("/events/join", (req, res) => {
  renderPage(res, "join-event");
})

app.listen(PORT, () => {
  console.log(`ALIVE AND KICKING ON PORT ${PORT}`);
});