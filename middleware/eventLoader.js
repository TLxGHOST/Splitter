import db from "../db.js";

async function eventFiller(req, res, next) {
  try {
    req.userID = req.user.id;
    if (req.isAuthenticated()) {

      const eventData = await db.query(
        "SELECT * FROM events WHERE created_by=$1",
        [req.user.id]
      );

      res.locals.events = eventData.rows || [];

    }

    next();

  } catch (err) {
    console.log(err);
    next();
  }
}
export {eventFiller}; 