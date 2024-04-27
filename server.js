const express = require("express");
const fs = require("fs");
const mongodb = require("mongodb");
require("dotenv").config();
const bodyParser = require("body-parser");
const request = require("request");

const app = express();

let port = process.argv[2];
if (!port) {
  port = 3000 || process.env.PORT;
}

let {
  MONGO_DB_USERNAME,
  MONGO_DB_PASSWORD,
  MONGO_DB_NAME,
  MONGO_COLLECTION,
  OMDB_API_KEY,
} = process.env;

if (!MONGO_DB_USERNAME || !MONGO_DB_PASSWORD || !MONGO_DB_NAME) {
  console.error("Missing required environment variables");
  process.exit(1);
}

let mongoURI = `mongodb+srv://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@cmsc335.bj3jw0t.mongodb.net/${MONGO_DB_NAME}`;
let omdbURI = `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&`;

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
app.use(express.static("public"));
app.use(express.json());

app.get("/", async (req, res) => {
  const docs = await collection.find({}).toArray();

  let total = docs.reduce((acc, doc) => acc + doc.tally, 0);

  res.render("home", { total });
});

app.get("/search", (req, res) => {
  res.render("search");
});

app.get("/searchQuery", (req, res) => {
  let title = req.query.title;
  let url = `${omdbURI}s=${title}`;

  request(url, (err, response, body) => {
    if (err) {
      res.status(500).send("Error fetching data from OMDB API");
      return;
    }

    let data = JSON.parse(body);
    if (data.Response === "False") {
      res.status(404).send("No results found");
      return;
    }

    res.json(data);
  });
});

app.get("/movie/:id", (req, res) => {
  let id = req.params.id;
  let url = `${omdbURI}i=${id}`;

  request(url, (err, response, body) => {
    if (err) {
      res.status(500).send("Error fetching data from OMDB API");
      return;
    }

    let data = JSON.parse(body);
    if (data.Response === "False") {
      res.status(404).send("No results found");
      return;
    }

    collection.updateOne(
      { imdbID: data.imdbID, info: data },
      { $inc: { tally: 1 } },
      { upsert: true }
    );

    res.render("results", { movie: data });
  });
});

app.get("/topSearches", async (req, res) => {
  // ping the collection
  const docs = await collection.find({}).limit(10).toArray();

  // sort the documents by the tally field
  docs.sort((a, b) => b.tally - a.tally);

  let topSearchesTable = `<table>
      <tr>
        <th>Rank</th>
        <th>Title</th>
        <th>Year</th>
        <th>Poster</th>
        <th>Tally</th>
      </tr>
  `;

  docs.forEach((doc) => {
    topSearchesTable += `
      <tr>
        <td>${docs.indexOf(doc) + 1}</td>
        <td>${doc.info.Title}</td>
        <td>${doc.info.Year}</td>
        <td><img src="${doc.info.Poster}" alt="${doc.info.Title}"></td>
        <td>${doc.tally}</td>
      </tr>
    `;
  });

  topSearchesTable += "</table>";

  res.render("topSearches", { topSearches: topSearchesTable });
});

app.get("/admin/clear", (req, res) => {
  collection.deleteMany({}, (err, result) => {
    if (err) {
      res.status(500).send("Error clearing database");
      return;
    }

    res.status(200).send("Database cleared successfully");
  });
});

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
