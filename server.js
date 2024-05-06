const express = require("express");
const mongodb = require("mongodb");
require("dotenv").config();
const bodyParser = require("body-parser");
const request = require("request");

// Check if a port is provided as an argument or environment variable.
let port = process.argv[2];
if (!port) {
  port = process.env.PORT || 3000;
}

// Load environment variables from .env file.
let {
  MONGO_DB_USERNAME,
  MONGO_DB_PASSWORD,
  MONGO_DB_NAME,
  MONGO_COLLECTION,
  OMDB_API_KEY,
} = process.env;

// Check if required environment variables are set.
if (!MONGO_DB_USERNAME || !MONGO_DB_PASSWORD || !MONGO_DB_NAME) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Set up MongoDB and OMDB URIs.
let mongoURI = `mongodb+srv://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@cmsc335.bj3jw0t.mongodb.net/${MONGO_DB_NAME}`;
let omdbURI = `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&`;

// Connect to MongoDB.
let mongoClient = new mongodb.MongoClient(mongoURI);
mongoClient.connect((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

// Set up MongoDB collection.
let db = mongoClient.db(MONGO_DB_NAME);
let collection = db.collection(MONGO_COLLECTION);

// Set up Express app.
const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());

// GET home page.
app.get("/", async (req, res) => {
  const docs = await collection.find({}).toArray();

  // Calculate total tally.
  let total = docs.reduce((acc, doc) => acc + doc.tally, 0);

  // Render home page with total.
  res.render("home", { total });
});

// GET search page.
app.get("/search", (req, res) => {
  res.render("search");
});

// GET search query results.
app.get("/searchQuery", (req, res) => {
  let title = req.query.title;
  let url = `${omdbURI}s=${title}`;

  request(url, (err, response, body) => {
    if (err) {
      res.status(500).send("Error fetching data from OMDB API");
      return;
    }

    // Fetch movie details from OMDB API.
    let data = JSON.parse(body);
    if (data.Response === "False") {
      res.status(404).json({ error: "No results found", Search: [] });
      return;
    }

    res.json(data);
  });
});

// GET movie details.
app.get("/movie/:id", (req, res) => {
  let id = req.params.id;
  let url = `${omdbURI}i=${id}`;

  // Fetch movie details from OMDB API.
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

    // Update database with search tally.
    collection.updateOne(
      { imdbID: data.imdbID, info: data },
      { $inc: { tally: 1 } },
      { upsert: true }
    );

    res.render("results", { movie: data });
  });
});

// GET top searches page.
app.get("/topSearches", async (req, res) => {
  // Get top searches from database.
  const docs = await collection.find({}).toArray();
  docs.sort((a, b) => b.tally - a.tally);

  // Create table with top searches.
  let topSearchesTable = `<table>
      <tr>
        <th>Rank</th>
        <th>Title</th>
        <th>Year</th>
        <th>Poster</th>
        <th>Tally</th>
      </tr>
  `;

  // For each, add a row to the table.
  docs.forEach((doc) => {
    topSearchesTable += `
      <tr>
        <td>${docs.indexOf(doc) + 1}</td>
        <td><a href="/movie/${doc.imdbID}">${doc.info.Title}</a></td>
        <td>${doc.info.Year}</td>
        <td><img src="${doc.info.Poster}" alt="${doc.info.Title}"></td>
        <td>${doc.tally}</td>
      </tr>
    `;
  });

  topSearchesTable += "</table>";

  res.render("topSearches", { topSearches: topSearchesTable });
});

// GET admin clear page.
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

// DISABLED BECAUSE OF HOSTING ON HEROKU - UNCOMMENT TO ENABLE

// process.stdin.resume();
// process.stdin.setEncoding("utf8");
// process.stdin.write("Stop to shutdown the server: ");

// process.stdin.on("data", (text) => {
//   if (text === "stop\n") {
//     process.stdin.write("Shutting down the server");
//     process.exit(0);
//   } else {
//     process.stdin.write(`Invalid command: ${text}`);
//   }

//   process.stdin.write("Stop to shutdown the server: ");
// });
