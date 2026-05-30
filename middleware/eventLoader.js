import db from "../db.js";

async function eventFiller(req, res, next) {
  try {
    // Initialize both variables to empty arrays to prevent undefined errors
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
    res.locals.events = [];
    res.locals.joinedEvents = [];

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

async function joinedEventFiller(req, res, next) {
  try {
    req.userID = req.user.id;
    if (req.isAuthenticated()) {
      const eventData = await db.query(
        `SELECT events.*
         FROM events
          JOIN event_members ON events.id = event_members.event_id
          WHERE event_members.user_id = $1`,
        [req.user.id]
      );

      res.locals.joinedEvents = eventData.rows || [];
    }
    next();
  } catch (err) {
    console.log(err);
    next();
  }
}


async function perHeadFiller(req, res, next) {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }

    const eventID = req.params.id;
    if (!eventID) {
      res.locals.perHeadAmount = 0;
      return next();
    }

    const userID = req.user?.id;
    if (!userID) {
      res.locals.perHeadAmount = 0;
      return next();
    }

    const totalPaidByMeRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE event_id = $1 AND paid_by = $2`,
      [eventID, userID]
    );
    const myTotalPaid = parseFloat(totalPaidByMeRes.rows[0].total) || 0;

    const totalPaidByOthersRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE event_id = $1 AND paid_by != $2`,
      [eventID, userID]
    );
    const othersTotalPaid = parseFloat(totalPaidByOthersRes.rows[0].total) || 0;

    const membersRes = await db.query(
      `SELECT COUNT(*) AS count FROM event_members WHERE event_id = $1`,
      [eventID]
    );
    const membersCount = (parseInt(membersRes.rows[0].count, 10) || 0);

    const totalEventCost = myTotalPaid + othersTotalPaid;
    const myFairShare = membersCount > 0 ? totalEventCost / membersCount : 0;

    res.locals.perHeadAmount = myTotalPaid - myFairShare;

    next();
  } catch (err) {
    console.error("Error in perHeadFiller middleware:", err);
    res.locals.perHeadAmount = 0;
    next(err);
  }
}

async function dashboardBalanceFiller(req, res, next) {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }

    const userID = req.user.id;
    // console.log(userID);
    // console.log("=== dashboardBalanceFiller ===");
    // console.log("userID:", userID);
    // Get all event IDs the user is part of (created or joined)

    const allEventsRes = await db.query(
      `SELECT id, name, join_code FROM events WHERE created_by = $1
       UNION
       SELECT events.id, events.name, events.join_code
       FROM events
       JOIN event_members ON events.id = event_members.event_id
       WHERE event_members.user_id = $1`,
      [userID]
    );

    // console.log("allEvents rows:", allEventsRes.rows);

    const allEvents = allEventsRes.rows;


    if (allEvents.length === 0) {
      // console.log("No events found, returning early");
      res.locals.eventBalances = [];
      res.locals.overallBalance = 0;
      return next();
    }

    const eventIDs = allEvents.map(e => e.id);

    // For each event: total paid by user, total paid by others, member count
    const balanceRes = await db.query(
      `SELECT
         e.id AS event_id,
         COALESCE(SUM(CASE WHEN ex.paid_by = $1 THEN ex.amount ELSE 0 END), 0) AS paid_by_me,
         COALESCE(SUM(ex.amount), 0) AS total,
         (SELECT COUNT(*) FROM event_members em WHERE em.event_id = e.id) AS member_count
       FROM events e
       LEFT JOIN expenses ex ON ex.event_id = e.id
       WHERE e.id = ANY($2)
       GROUP BY e.id`,
      [userID, eventIDs]
    );

    // Map balances back to events
    const balanceMap = {};
    balanceRes.rows.forEach(row => {
      const total = parseFloat(row.total) || 0;
      const paidByMe = parseFloat(row.paid_by_me) || 0;
      const memberCount = parseInt(row.member_count) || 1;
      const myFairShare = total / memberCount;
      balanceMap[row.event_id] = paidByMe - myFairShare;
    });

    res.locals.eventBalances = allEvents.map(event => ({
      ...event,
      balance: balanceMap[event.id] ?? 0
    }));

    res.locals.overallBalance = res.locals.eventBalances
      .reduce((sum, e) => sum + e.balance, 0);

    next();
  } catch (err) {
    console.error("dashboardBalanceFiller error:", err);
    res.locals.eventBalances = [];
    res.locals.overallBalance = 0;
    next();
  }
}

export { eventFiller, joinedEventFiller, perHeadFiller, dashboardBalanceFiller };

//blank comment added
