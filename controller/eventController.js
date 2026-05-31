import db from "../db.js";
import createUniqueCode from "../utility/joincodes.js";

async function handleCreateEvent(req, res) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  try {
    const joinCode = await createUniqueCode();

    const newEvent = await db.query(
      "INSERT INTO events (name, join_code, created_by) VALUES ($1,$2,$3) RETURNING id",
      [req.body.name, joinCode, req.user.id]
    );

    const newEventID = newEvent.rows[0].id;

    await db.query(
      "INSERT INTO event_members (event_id, user_id) VALUES ($1,$2)",
      [newEventID, req.user.id]
    );

    res.redirect("/dashboard");

  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).send("Error creating event");
  }
}

async function handleDeleteEvent(req, res) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const eventID = req.params.id;

  try {
    await db.query(
      "DELETE FROM events WHERE id=$1",
      [eventID]
    );
  } catch (err) {
    console.error("Error deleting event:", err);
    return res.status(500).send("Error deleting event");
  }

  res.redirect("/dashboard");
}

async function handleJoinEvent(req, res) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  try {
    const joinCode = req.body.code;

    const eventResult = await db.query(
      "SELECT * FROM events WHERE join_code=$1",
      [joinCode]
    );

    if (!eventResult.rows.length) {
      return res.status(404).send("Event not found");
    }

    const memberResult = await db.query(
      "SELECT * FROM event_members WHERE event_id=$1 AND user_id=$2",
      [eventResult.rows[0].id, req.user.id]
    );

    if (memberResult.rows.length) {
      return res.status(400).send("You are already a member of this event");
    }

    await db.query(
      "INSERT INTO event_members (event_id, user_id) VALUES ($1,$2)",
      [eventResult.rows[0].id, req.user.id]
    );

    res.redirect("/dashboard");

  } catch (err) {
    console.error("Error joining event:", err);
    res.status(500).send("Error joining event");
  }
}

const handleViewEvent = async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

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

    const expensesResult = await db.query(
      `SELECT id, description, amount, paid_by
       FROM expenses
       WHERE event_id = $1
       ORDER BY created_at DESC`,
      [eventID]
    );

    const memberSpendingResult = await db.query(
      `SELECT paid_by, SUM(amount) AS total
       FROM expenses
       WHERE event_id = $1
       GROUP BY paid_by`,
      [eventID]
    );

    const spendingMap = {};
    memberSpendingResult.rows.forEach(row => {
      spendingMap[parseInt(row.paid_by)] = parseFloat(row.total) || 0;
    });

    const settlementsResult = await db.query(
      `SELECT payee_id, SUM(amount) AS total
       FROM settlements
       WHERE event_id = $1 AND payer_id = $2 AND status = 'paid'
       GROUP BY payee_id`,
      [eventID, req.user.id]
    );

    const settledMap = {};
    settlementsResult.rows.forEach(row => {
      settledMap[parseInt(row.payee_id)] = parseFloat(row.total) || 0;
    });

    const settlementsReceivedResult = await db.query(
      `SELECT payee_id, SUM(amount) AS total
       FROM settlements
       WHERE event_id = $1 AND status = 'paid'
       GROUP BY payee_id`,
      [eventID]
    );

    const settlementsReceivedMap = {};
    settlementsReceivedResult.rows.forEach(row => {
      settlementsReceivedMap[parseInt(row.payee_id)] = parseFloat(row.total) || 0;
    });

    const settlementsPaidResult = await db.query(
      `SELECT payer_id, SUM(amount) AS total
       FROM settlements
       WHERE event_id = $1 AND status = 'paid'
       GROUP BY payer_id`,
      [eventID]
    );

    const settlementsPaidMap = {};
    settlementsPaidResult.rows.forEach(row => {
      settlementsPaidMap[parseInt(row.payer_id)] = parseFloat(row.total) || 0;
    });

    const totalExpenses = expensesResult.rows
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const memberCount = membersResult.rows.length;
    const fairShare = memberCount > 0 ? totalExpenses / memberCount : 0;

    // what current user owes overall
    const myPaid = spendingMap[parseInt(req.user.id)] || 0;
    const myDebt = Math.max(0, fairShare - myPaid);

    const membersWithData = membersResult.rows.map(m => {
      const memberID = parseInt(m.id);
      const paid = spendingMap[memberID] || 0;
      const balance = paid - fairShare;
      const alreadySettled = settledMap[memberID] || 0;
      const settlementsReceived = settlementsReceivedMap[memberID] || 0;
      const settlementsPaid = settlementsPaidMap[memberID] || 0;
      const netContribution = paid + settlementsReceived - settlementsPaid;

      let owedByMe = 0;
      if (memberID !== parseInt(req.user.id) && balance > 0.01) {
        owedByMe = Math.max(0, Math.min(myDebt, balance) - alreadySettled);
      }

      const memberDebt = Math.max(0, fairShare - paid);
      const isSettled = memberDebt < 0.01 || settlementsPaid >= memberDebt;

      return {
        ...m,
        totalSpent: paid,
        settlementsReceived,
        settlementsPaid,
        netContribution,
        balance,
        owedByMe,
        alreadySettled,
        isSettled
      };
    });

    res.render("event", {
      event: eventResult.rows[0],
      members: membersWithData,
      expenses: expensesResult.rows,
      perHeadAmount: res.locals.perHeadAmount,
      currentUserID: req.user.id,
      fairShare
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading event");
  }
};

export { handleCreateEvent, handleJoinEvent, handleViewEvent, handleDeleteEvent };