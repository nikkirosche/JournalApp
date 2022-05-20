import express from "express";
import cookieParser from "cookie-parser";
import jsSHA from "jssha";
import pg from "pg";
//to connect to CSS
import path from "path";
import moment from "moment";
const __dirname = path.resolve();

const app = express();
const { Pool } = pg;

//static files
app.use(express.static("/public"));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
const port = 3004;

const users = [];

//to connect to postgres
const pgConnectionConfigs = {
  user: "nicolerosche",
  host: "localhost",
  database: "journal",
  port: 5432,
};

const pool = new Pool(pgConnectionConfigs);
//===============================================LOGIN & COOKIE BACKEND=========================================================//
//for new user
const newUser = (req, res) => {
  const shaObj = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
  shaObj.update(req.body.password);
  const hashedPassword = shaObj.getHash("HEX");

  //store hashed password in DB
  const values = [
    req.body.first_name,
    req.body.last_name,
    req.body.display_name,
    req.body.email,
    hashedPassword,
  ];
  //check if email exist
//   const emailAvail = pool.query(`SELECT email FROM users`, (req, res) => {
//     if (req.body.email === true) {
//       res.send(
//         alert("Email already exist, try another email!")
//       );
//       return;
//     }
//   });
  //make query to DB
  pool.query(
    `INSERT INTO users (first_name, last_name, display_name, email, password) VALUES ($1, $2, $3, $4, $5)`,
    values,
    (err, result) => {
      if (err) {
        console.log("Error detected", err);
        res.status(404).send(err);
        return;
      }
      res.redirect("/login");
    }
  );
};

//for login
const authUser = (req, res) => {
  const values = [req.body.email];
  pool.query(`SELECT * FROM users WHERE email = $1`, values, (err, result) => {
    if (err) {
      console.log("err executing query");
      console.log(err);
      res.status(404).send(err);
      return;
    }
    //did not find user with that email
    console.log(result.rows);
    if (result.rows.length === 0) {
      res.status(404).send("Login failed part1");
      return;
    }
    //get user record from results
    const user = result.rows[2];
    const shaObj = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
    //input password from the request to the SHA object
    shaObj.update(req.body.password);
    //get hashedPassword
    const hashedPassword = shaObj.getHash("HEX");

    // to tally the password in database with above hashed one
    console.log(hashedPassword);
    if (user.password !== hashedPassword) {
      res.status(404).send("Login failed");
      return;
    }
    // password hashmatches and we authenticate user
    // for cookie
    res.cookie("loggedIn", true);
    // redirect to home page
    res.redirect("/home");
  });
};

//===============================================JOURNAL ENTRY SECTION===========================================================//
//entry POST request
const journalLog = (req, res) => {

}

//===============================================CONNECT TO EJS FILE========================================================//
//connect to intro page
app.get("/intro", (req, res) => {
  res.render("intro");
});

//connect to login page
app.get("/login", (req, res) => {
  res.render("login");
});

//for login POST request
app.post("/login", authUser);

//connect to register page
app.get("/register", (req, res) => {
  res.render("register");
});

//for new users POST request
app.post("/register", newUser);

//connect to home page
app.get("/home", (req, res) => {
  res.render("home");
});

//link journal entry to home page for posting
app.post("/home", journalLog);

//connect to entry log page
app.get("/entries", (req, res) => {
  res.render("entries");
});

//===============================================LISTEN TO PORT=======================================//
app.listen(port);
