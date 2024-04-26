const express = require("express");
const fs = require("fs");
const mongodb = require("mongodb");
require("dotenv").config();
const bodyParser = require("body-parser");

const app = express();

let port = process.argv[2];
if (!port) {
  console.error("Usage: node summerCampServer.js PORT_NUMBER_HERE");
  process.exit(1);
}

let { MONGO_DB_USERNAME, MONGO_DB_PASSWORD, MONGO_DB_NAME, MONGO_COLLECTION } =
  process.env;

if (!MONGO_DB_USERNAME || !MONGO_DB_PASSWORD || !MONGO_DB_NAME) {
  console.error("Missing required environment variables");
  process.exit(1);
}

let mongoURI = `mongodb+srv://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@cmsc335.bj3jw0t.mongodb.net/${MONGO_DB_NAME}`;

let mongoClient = new mongodb.MongoClient(mongoURI);

mongoClient.connect((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

let db = mongoClient.db(MONGO_DB_NAME);
let collection = db.collection(MONGO_COLLECTION);

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.render("home.ejs");
});

// TODO: Implement rest of server

app.listen(port);
console.log(`Web server started and running at http://localhost:${port}`);

process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.write("Stop to shutdown the server: ");

process.stdin.on("data", (text) => {
  if (text === "stop\n") {
    process.stdin.write("Shutting down the server");
    process.exit(0);
  } else {
    process.stdin.write(`Invalid command: ${text}`);
  }

  process.stdin.write("Stop to shutdown the server: ");
});
