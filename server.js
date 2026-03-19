import express from "express";
import dotenv from "dotenv";
import db from "./db.js";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
// import users from "./modal/users.js";

// Constants
dotenv.config();
const PORT = process.env.PORT || 3000;
const saltRound = Number(process.env.SALT_ROUND);



const app = express();

//connecting database
db.connect();

//ctreating session
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
}))

app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.locals.isAuth = req.isAuthenticated ? req.isAuthenticated() : false;
  next();
});

app.use(async (req, res, next) => {
  if (res.locals.isAuth) {
    //populate the events with users data
    const eventData = await db.query("SELECT * FROM events WHERE created_by = $1", [req.user.id]);
    res.locals.events = eventData.rows ? eventData.rows : [];
  }
  next();
})

app.get("/", (req, res) => {

  res.render("home.ejs");

});

app.get("/login", (req, res) => {
  res.render("login.ejs")
});
app.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login"
}));

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {

  try {

    const username = req.body.username;
    const password = req.body.password;

    const dbResult = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [username]
    );

    if (dbResult.rows.length === 0) {

      const hashedPass = await bcrypt.hash(password, saltRound);

      await db.query(
        "INSERT INTO users(email,password) VALUES($1,$2)",
        [username, hashedPass]
      );

      res.redirect("/login");

    }
    else {

      res.redirect("/login");

    }

  }
  catch (err) {

    console.log(err);
    res.send("Registration error");

  }

});

app.get("/dashboard", (req, res) => {
  // replace with DB later
  res.render("dashboard", { events });
});

app.get("/events/create", (req, res) => {

  res.render("create-event", { events });
})

app.get("/events/join", (req, res) => {
  res.render("join-event");
})

passport.use("local", new Strategy(async function verify(username, password, cb) {
  const result = await db.query("SELECT * FROM users WHERE email=$1", [username]);
  if (result.rows.length) {
    //data found part
    const userData = result.rows[0];
    bcrypt.compare(password, userData.password, (err, validLogin) => {
      if (err) {
        console.log(`Comparision erro ${err}`);
        return cb(err);
      }
      else {
        if (validLogin) {

          return cb(null, userData); //correct Password
        }

        else {
          return cb(null, false);// incorrect passowrd

        }
      }

    })

  }
  else {
    cb(null, false);//that is no person in database still login attempt made
  }

}))


//passport serialization
passport.serializeUser((userData, cb) => {
  cb(null, userData.id);
})

//passport desrialization
passport.deserializeUser(async (id, cb) => {
  const result = await db.query(
    "SELECT * FROM users WHERE id=$1",
    [id]
  )

  cb(null, result.rows[0])
})

app.listen(PORT, () => {
  console.log(`ALIVE AND KICKING ON PORT ${PORT}`);
});