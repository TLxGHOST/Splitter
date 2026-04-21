import express from "express";
import dotenv from "dotenv";
import db from "./db.js";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import pgSession from "connect-pg-simple";
import createUniqueCode from "./utility/joincodes.js"
import eventsRouter from "./routes/events.js";
import staticRouter from "./routes/basePath.js";


dotenv.config();


const PORT = process.env.PORT || 3000;
const saltRound = Number(process.env.SALT_ROUND);

const app = express();

// db.connect();

const PgSession = pgSession(session);

const sessionStore = new PgSession({
  pool: db,
  tableName: "session"
});

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60,
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));


/* ---------- GLOBAL TEMPLATE VARIABLES ---------- */

app.use((req, res, next) => {
  res.locals.isAuth = req.isAuthenticated();
  res.locals.events = [];
  next();
});


/* ---------- EVENT LOADER MIDDLEWARE ---------- */




/* ---------- ROUTES ---------- */

app.use("/", staticRouter);

app.post("/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
  })
);


/* ---------- REGISTER USER ---------- */



/* ---------- DASHBOARD ---------- */

app.use("/events", eventsRouter);

// opening an event when event exists
app.get("/events/:id", eventFiller, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  // -----------------------------------
  const eventID = Number(req.params.id);

  if (!Number.isInteger(eventID)) {
    return res.status(400).send("Invalid event id");
  }

  try {
    const eventResult = await db.query(
      "SELECT * FROM events WHERE id=$1",
      [eventID]
    );

    if (!eventResult.rows.length) {
      return res.status(404).send("Event not found");
    }

    const membersResult = await db.query(
      `SELECT users.id, users.email
       FROM event_members
       JOIN users ON users.id = event_members.user_id
       WHERE event_members.event_id = $1`,
      [eventID]
    );
    // ---------------------------------
    const expensesResult = await db.query(
      `SELECT id, description, amount
       FROM expenses
       WHERE event_id = $1
       ORDER BY created_at DESC`,
      [eventID]
    );

    res.render("event", {
      event: eventResult.rows[0],
      members: membersResult.rows,
      expenses: expensesResult.rows
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading event");
  }
});

/* ---------- PASSPORT LOCAL STRATEGY ---------- */

passport.use("local", new Strategy(async (username, password, cb) => {

  try {

    const result = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [username]
    );

    if (!result.rows.length) {
      return cb(null, false);
    }

    const userData = result.rows[0];

    const validLogin = await bcrypt.compare(
      password,
      userData.password
    );

    if (validLogin) {
      return cb(null, userData);
    }

    return cb(null, false);

  } catch (err) {

    return cb(err);

  }

}));


/* ---------- SESSION SERIALIZATION ---------- */

passport.serializeUser((user, cb) => {

  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {

  try {

    const result = await db.query(
      "SELECT * FROM users WHERE id=$1",
      [id]
    );

    cb(null, result.rows[0]);

  } catch (err) {

    cb(err);

  }

});


app.listen(PORT, () => {
  console.log(`ALIVE AND KICKING ON PORT ${PORT}`);
});