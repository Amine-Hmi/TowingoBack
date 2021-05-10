const express = require("express");
const app = express();
const mysql = require("mysql");
const CURRENT_TIMESTAMP = require("moment-timezone")().format(
  "YYYY-MM-DD hh:mm:ss"
);
const emailValidator = require("deep-email-validator");
const localtunnel = require("localtunnel");
require("dotenv").config();

//* Log queries with morgan 

var morgan = require("morgan");
app.use(morgan("dev"));

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

 //* CONNECT TO DATABASE //

const con = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

//? TUNNEL LOCALHOST TO WEB //

// (async () => {
//   const tunnel = await localtunnel({
//     port: 4545,
//     subdomain: process.env.LT_SUBDOMAIN,
//   });
//   tunnel.url;
//   console.info(tunnel.url);
//   tunnel.on("close", () => {
//     console.log("Tunnel closed");
//   });
// })();

const server = app.listen(4545, () => {
  let host = server.address().address;
  let port = server.address().port;
  console.log(`Started on PORT ${port}`);
});


//? ESTABLISH CONNECTION TO DATABASE //

con.connect((err) => {
  if (err) console.log("Database Connection Error:", err.sqlMessage);
  else {
    console.log("Successfully connected to DB 😀");
  }
});

let sqltest =
  "INSERT INTO `users` (`id`,`username`, `email_address`, `phone_number`,`DOB`, `created`, `verified`, `premium`) VALUES (NULL,NULL,'lynda.maaroufi@gmail.com', '98555444',NULL," +
  con.escape(CURRENT_TIMESTAMP) +
  ",'1', '0')";


//* FETCH LIST OF All USERS //

app.get("/api/users", (req, res) => {
  con.query("select * from users", (error, rows, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.send(
        "<ul>" +
          rows.map(
            (user) =>
              `<li style=\"list-style:none\"><strong style=\"color:blue\">Email address:</strong> ${user.email_address}</li>
               <li style=\"list-style:none\"><strong style=\"color:blue\">Phone number:</strong> ${user.phone_number}</li>
               <li style=\"list-style:none\"><strong style=\"color:blue\">Creation date:</strong> ${user.created}</li>
               <li style=\"list-style:none\"><strong style=\"color:blue\">Premium:</strong> ${user.premium}</li>
               <li style=\"list-style:none\"><strong style=\"color:blue\">Verified:</strong> ${user.verified}</li>`
          ) +
          "</ul>"
      );
      // res.send(rows);
    }
  });
});

app.get("/", (req, res) => {
  res.send(`<h1>Welcome to TOWINGO 😀</h1><a href="/api/users">View users<a/>`);
});


async function isEmailValid(email) {
  return emailValidator.validate(email);
}

const registerUser = (email, phone, res) => {
  let fetchUserCount =
    "SELECT count(*) as count FROM `users` WHERE `phone_number`=" +
    con.escape(phone) +
    "and `email_address`=" +
    con.escape(email) +
    "";
  // let sql = `INSERT INTO users ('?', '?', '?', '?', '?', '?') VALUES [NULL, ${mail}, ${phone},${CURRENT_TIMESTAMP},'0', '0']`;
  let addUserReq =
    "INSERT INTO `users` (`id`, `username` ,`email_address`,`phone_number` ,`DOB`, `created`, `verified`, `premium`) VALUES (NULL,NULL," +
    con.escape(email) +
    "," +
    con.escape(phone) +
    ", NULL, " +
    con.escape(CURRENT_TIMESTAMP) +
    ",'0', '0')";

  let fetchUser =
    "select exists (  select `email_address` from users where `email_address` =" +
    con.escape(email) +
    " or phone_number =" +
    con.escape(phone) +
    ") as result ";

//* FETCH USER BY PHONE NUMBER OR E-mail

  con.query(fetchUser, (err, result) => {
    if (err) return "DB fetch user failed" + err;
    //* if fetch is success
    else
     if (result[0].result === 0) {
      con.query(addUserReq, (err, result) => {
        if (err) {
          return res
            .status(404)
            .send({ message: "SQL add query failed " + err.message });
        } else {
          return res
            .status(200)
            .send({ message: "Success: " + result.insertId });
        }
      });
    } else return res.status(409).send({ message: "user already exists" });
  });
};

//* REGISTER A NEW USER //

app.post("/api/register/", async function (req, res, next) {
  const { email, phone } = req.body;

  const { valid, reason, validators } = await isEmailValid(email);

  //? CHECK EMAIL SYNATX IS VALID//

  if (valid) {
    const { message } = registerUser(email, phone, res);
    // return (message)
  } else return res.status(400).send({ message: validators[reason].reason });
});

//* Log existing USER //

app.post("/api/login/", async function (req, res, next) {
  const { phone } = req.body;

  let fetchPhone =
    "select exists ( select `phone_number` from users where `phone_number` =" + con.escape(phone) +") as result ";

    con.query(fetchPhone, (err, result) => {
      if (err) return "Error: " + err.message;
      //* if fetch is success
      else if (result[0].result !== 0) {
        //* if user phonenumber is found
        return res.status(200).send({ message: "Welcome back!" });
      } else return res.status(401).send({ message: "User phone number not found\n Please register first" });
    });    
  })

//* SEND SMS //

const accountSid = process.env.TWL_accountSid;
const authToken = process.env.TWL_authToken;
const client = require("twilio")(accountSid, authToken);

app.post("/api/send-sms/", async function (req, res, next) {
  const { to,token,expires } = req.body;

  if (!to)
    return res.status(400).send({ message: "Missing recipient phone number." });
  else {
    // let token = await genToken();
    client.messages
      .create({
        from: process.env.TWL_phoneNumber,
        to: req.body.to,
        token:req.body.token,
        expires:req.body.expires,
        body: `\n${token} is your verification code for\nTowingo: Towing and roadside\nassistance service\nThis code expires in ${expires} seconds`,
      })
      .then((message) => console.log(message))
      .catch((err) => console.log(err));
  
  }
  return res.send("Message sent successfully !");
});

//* GENERATE OTP TOKEN //

const { authenticator, totp } = require("otplib");
authenticator.options = { digits: 4 };
totp.options = { digits: 4, step: 90 }; // *step is token validity in seconds [default:30] //

const secret = authenticator.generateSecret();
function genToken() {
  try {
    const otptoken = totp.generate(secret);
    const tUsed = totp.timeUsed();
    const tRemain = totp.timeRemaining();
    return {
      secret: secret,
      otptoken: otptoken,
      tUsed: tUsed,
      tRemain: tRemain,
    };
  } catch (err) {
    console.log("Error: " + err.message);
  }
}

app.get("/api/otp", async (req, res) => {
  let token = genToken();
  console.log(
    "token: " + token.otptoken,
    "expires in: " + token.tRemain + " seconds"
  );
  res.json(token);
});
//*GET USER INFOS //
app.post("/api/userinfos", async function (req, res, next) {
  const { phone_number } = req.body;
  con.query("select * from users where phone_number = "+con.escape(phone_number)+"", (error, row, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.json(row);
    }
  });
})

//* Update user infos //
app.patch("/api/edituser/:id", async function (req, res, next) {
  const { DOB,username,gender } = req.body;
  const id = req.params.id
  con.query("UPDATE users SET username = ?, gender = ?, DOB = ? where id = ?" ,[username,gender,DOB,id], (error,result) => {
    if (error) console.log("users query error:" + error);
    else {
      res.send(result);
    }
  });
})
// * Get List of Vehicle vendors
app.get("/api/vendors", (req, res) => {
  con.query("select * from car2dbmakes", (error, rows, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      // res.send(
      //   "<ul>" +
      //     rows.map(
      //       (vendor) =>`<li style=\"list-style:none\"><strong style=\"color:blue\">Name:</strong> ${vendor.title}</li>`) +
      //     "</ul>" );
      res.send(rows);
    }
  });
});

// * Get List of Vehicle vendor models
app.get("/api/models/:maker", (req, res) => {
  const maker = req.params.maker
  con.query(`select * from car2dbmodels where make_id = ${maker}`, (error, rows, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.send(rows);
      }
  });
});
