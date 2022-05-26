import express from "express";
import cookieParser from "cookie-parser";
import jsSHA from "jssha";
import pg from "pg";
import axios from "axios";
import bodyParser from "body-parser";
//to connect to CSS
import path from "path";
import moment from "moment";
const __dirname = path.resolve();

const app = express();

var urlencodedParser = bodyParser.urlencoded({
  extended: false,
});
const { Pool } = pg;

//static files
app.use(express.static("/public"));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(
  express.urlencoded({
    extended: false,
  })
);
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
//===============================================DATE FUNCTION=========================================================//
//get the date
const getDate = () => {
  const dayDate = new Date();
  let day = dayDate.getDate();
  const monthName = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthDate = new Date();
  let month = monthName[monthDate.getMonth()];
  const yearDate = new Date();
  let year = yearDate.getFullYear();
  return {
    day,
    month,
    year,
  };
};

//===============================================LOGIN & COOKIE BACKEND=========================================================//
//==============================================================================================================================//

//for new user
const newUser = (req, res) => {
  const shaObj = new jsSHA("SHA-512", "TEXT", {
    encoding: "UTF8",
  });
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
  console.log(req.body.email);
  pool.query(
    `SELECT email FROM users WHERE email = '${req.body.email}'`,
    (err, result) => {
      if (err) {
        console.log(err);
        return;
      }
      console.log(result.rows[0].email);
      if (req.body.email === result.rows[0].email) {
        console.log("Email in use", result.rows[0].email);
        res.redirect("/alert");
        return;
      } else {
        return pool.query(
          `INSERT INTO users (first_name, last_name, display_name, email, password) VALUES ($1, $2, $3, $4, $5)`,
          values)
          .then ((result) => {
            console.log("Registration Success!");
            res.redirect("/login")
          }) 
          .catch ((err) => {
            console.log(err);
          })
      };
    }
  )



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
      res.redirect("/login")
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
    const user = result.rows[0];
    const shaObj = new jsSHA("SHA-512", "TEXT", {
      encoding: "UTF8",
    });
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
    const entryDate = getDate();
    // password hashmatches and we authenticate user
    // for cookie
    res.cookie("loggedIn", true);
    //save user id in cookie
    res.cookie("user_id", user.id);
    // redirect to home page
    res.redirect("home")
  });
};

//===============================================JOURNAL ENTRY SECTION===========================================================//
//==============================================================================================================================//

//create new log (entries page posted on home page)
const newJournalLog = async (req, res) => {
  try {
    const answerData = await pool.query(
      `INSERT INTO answer (user_id, mood, accomplishment, event, spending, meal, date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.cookies.user_id,
        req.body.mood,
        req.body.accomplishment,
        req.body.event,
        req.body.spending,
        req.body.meal,
        new Date(),
      ]
    );
    console.log(answerData.rows);
    //your answerid is in journalData
    const answerId = answerData.rows[0].id;
    console.log(answerId);
    //for workout table data
    const workoutData = await pool.query(
      `INSERT INTO workout (workout_done, description, answer_id) VALUES ($1, $2, $3) RETURNING *`,
      [req.body.workout_done, req.body.workout, answerId]
    );
    console.log(workoutData.rows);
  } catch (err) {
    console.log("Error", err);
    res.status(404).send("Sorry, entry not saved!");
    return;
  }
  const entryDate = getDate();
  res.render("home", {
    answerData: req.body,
    entryDate,
  });
};

//display the first journal entry for the day
// const singleEntry = (req, res) => {
//   const entryDate = getDate();
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
//   pool.query(
//     `SELECT * FROM answer WHERE user_id = ${req.cookies.user_id} AND date >= '${
//       today.getMonth() + 1
//     }.${today.getDate()}.${today.getFullYear()} 00:00:00'`,
//     (err, result) => {
//       if (err) {
//         console.log("Error Date", err);
//         return;
//       }
//       console.log(result.rows);
//       res.render("home", {
//         answerData: result.rows[0],
//         entryDate,
//       });
//     }
//   );
// };

//display single journal entry
const displayEntry = async (req, res) => {
  console.log('start of display entry function')
  const entryDate = getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log('querying for today\'s entry');
  try {

    const result = await pool.query(
      `SELECT * FROM answer WHERE user_id = ${req.cookies.user_id} AND date >= '${
        today.getMonth() + 1
      }.${today.getDate()}.${today.getFullYear()} 00:00:00'`
    );
    
    if (result.rows.length === 0) {
      const ejsObj = {
        answerData: undefined,
        workoutData: undefined,
        entryDate,
      }
      res.render('home', ejsObj);
    }
    const answerData = result.rows[0];
    const id = answerData.id;
  
    //get workout table data that has the answer_id inside to link to answer table
    const getWorkout = await pool.query(`SELECT * FROM workout WHERE answer_id=$1`, [id]);
    console.log('this is getWorkout: ', getWorkout.rows)

    console.log('this is answerData: ', answerData)
    
    const ejsObj = {
      answerData: answerData,
      workoutData: getWorkout.rows[0],
      entryDate,
    }
    res.render('home', ejsObj);

  } catch (error) {console.log("Error for querying last entry: ", error)}
      


    // const getWorkoutData = await pool.query(
    //   `SELECT FROM answer.id, answer.user_id, answer.mood, answer.accomplishment, answer.event, answer.spending, answer.meal, answer.date, 
    //   workout.id, workout.workout_done, workout.description,workout.answer_id 
    //    FROM answer 
    //    INNER JOIN workout 
    //    ON answer.id = workout.answer_id 
    //    WHERE answer_id=${id};`
    // );
  
};

//==============================================EDIT JOURNAL SECTION============================================================//
//==============================================================================================================================//

//edit journal entry
const editEntry = async (req, res) => {
  console.log("Helloo");
  try {
    const entryDate = getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await pool.query(
      `SELECT * FROM answer WHERE user_id = ${
        req.cookies.user_id
      } AND date >= '${
        today.getMonth() + 1
      }.${today.getDate()}.${today.getFullYear()} 00:00:00'`
    );
    const answerData = result.rows[0];
    const workoutResult = await pool.query(
      `SELECT * FROM workout WHERE answer_id=${answerData.id}`
    );
    const workoutData = workoutResult.rows[0];
    console.log("results:", result);
    console.log("answer data:", answerData);

    res.render("edit", {
      answerData,
      entryDate,
      workoutData,
    });
  } catch (err) {
    console.log("Error Editing", err);
    res.status(404).send("Edit request failed");
    return;
  }
};

//update edited journal
const updateJournal = async (req, res) => {
  try {
    const { id } = req.params;
    const getanswer = await pool.query(`SELECT * FROM answer WHERE id=$1`, [
      id,
    ]);
    const answerData = getanswer.rows[0];
    console.log(answerData);
    const getworkout = await pool.query(
      `SELECT * FROM workout WHERE answer_id=${id}`
    );
    const workoutData = getworkout.rows[0];
    console.log(workoutData);
    const {
      mood,
      accomplishment,
      event,
      spending,
      meal,
      workout_done,
      workout,
    } = req.body;
    const updateAnswer = `UPDATE answer SET mood ='${mood}', accomplishment='${accomplishment}', event='${event}', spending='${spending}', meal='${meal}' WHERE id=${id}`;
    const updateWorkout = `UPDATE workout SET workout_done='${workout_done}', description='${workout}' WHERE answer_id=${id}`;

    await pool.query(updateAnswer);
    await pool.query(updateWorkout);

    res.redirect("/home");
  } catch (err) {
    console.log("Error Updating", err);
  }
};

//===============================================DELETE JOURNAL ENTRY===========================================================//
//==============================================================================================================================//

const deleteJournal = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM answer WHERE answer_id='${id}'`);
    await pool.query(`DELETE FROM workout WHERE answer_id='${id}'`);
    console.log(req.params);

    const entryDate = getDate();
    res.redirect("/home", {
      answerData: req.body,
      entryDate,
    });
  } catch (err) {
    console.log("Journal not deleted", err);
    return;
  }
};

//===============================================CONNECT TO EJS FILE============================================================//
//==============================================================================================================================//

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
// app.get("/home", singleEntry);

//to post the submitted journal entry
app.get("/home", displayEntry);

//to delete journal entry
// app.delete("/home/:id", (req, res) => {
//   const id = req.params.id;
//   answer.findByIdAndDelete(id)
//   .then(result => {
//     res.json({ redirect: '/home}'})
//   })
//   .catch (err) {
//     console.log(err);
//   }
// })

//to delete journal entry
app.get("/home/:id", deleteJournal);

app.post("/entries", newJournalLog);

//connect to entry log page
app.get("/entries", (req, res) => {
  const entryDate = getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  pool.query(
    `SELECT * FROM answer WHERE user_id = ${req.cookies.user_id} AND date >= '${
      today.getMonth() + 1
    }.${today.getDate()}.${today.getFullYear()} 00:00:00'`,
    (err, result) => {
      if (err) {
        console.log("Error Date", err);
        return;
      }
      console.log(result.rows);
      res.render("entries", {
        answerData: result.rows[0],
        entryDate,
      });
    }
  );
});

//to edit journal
app.get("/edit", editEntry);

//to update the edited note
app.post("/edit/:id", updateJournal);

//connect to alert page
app.get("/alert", (req, res) => {
  res.render("alert");
});

//to clear the cookie
app.get("/logout", (req, res) => {
  res.clearCookie("user_id");
  res.redirect("/intro");
});

//===============================================LISTEN TO PORT=======================================//
app.listen(port);
