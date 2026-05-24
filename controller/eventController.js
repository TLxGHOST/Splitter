import db from "../db.js";
import createUniqueCode from "../utility/joincodes.js";

async function handleCreateEvent(req, res){

  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const joinCode = await createUniqueCode();

  await db.query(
    "INSERT INTO events (name, join_code, created_by) VALUES ($1,$2,$3)",
    [req.body.name, joinCode, req.user.id]
  );

  res.redirect("/dashboard");
}

async function handleJoinEvent(req, res) {

  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  const joinCode = req.body.code;

  const eventResult = await db.query(
    "SELECT * FROM events WHERE join_code=$1",
    [joinCode]
  );

  if (!eventResult.rows.length) {
    return res.status(404).send("Event not found");
  }

  // Check if user is already a member
  const memberResult = await db.query(
    "SELECT * FROM event_members WHERE event_id=$1 AND user_id=$2",
    [eventResult.rows[0].id, req.user.id]
  );

  if (memberResult.rows.length) {
    return res.status(400).send("You are already a member of this event");
  }

  // Add user to event
  await db.query(
    "INSERT INTO event_members (event_id, user_id) VALUES ($1,$2)",
    [eventResult.rows[0].id, req.user.id]
  );

  res.redirect("/dashboard");
}

export {handleCreateEvent, handleJoinEvent};