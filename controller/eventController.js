import db from "../db.js";

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

export {handleCreateEvent};