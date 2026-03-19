import express from "express";
import env from "dotenv";
import db from "./db.js";

env.config();
const PORT = process.env.PORT;
const app = express();
db.connect();


app.listen(PORT, () => {
  console.log(`ALIVE AND KICKING ON PORT ${PORT}`);
})
