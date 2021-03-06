const express = require("express");
const app = express();
const mysql = require("mysql");
const CURRENT_TIMESTAMP = require("moment-timezone")()
.format(  "YYYY-MM-DD hh:mm:ss");
const emailValidator = require("deep-email-validator");
const localtunnel = require("localtunnel");
require("dotenv").config();

//* Log queries with morgan 

var morgan = require("morgan");
app.use(morgan("combined"));

app.use(express.json());
app.use(express.urlencoded({
    extended: true,
  })
);

//* enable cors on server //
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

//* CORS v2 *//
// const util = require('util');
// const createMiddleware = require('@apidevtools/swagger-express-middleware');

// createMiddleware('swagger.json', app, function(err, middleware) {
//   app.use(middleware.metadata());
//   app.use(middleware.CORS());

//   // Show the CORS headers as HTML
//   app.use(function(req, res, next) {
//       res.send('<pre>' + util.inspect(res._headers) + '</pre>');
//   });


// });

//* Swagger UI */

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


 //* CONNECT TO DATABASE //

const con = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// //? TUNNEL LOCALHOST TO WEB //
(async () => {
  const tunnel = await localtunnel({
    port: 4545,
    subdomain: process.env.LT_SUBDOMAIN,
  });
  tunnel.url;
  console.info(tunnel.url);
  tunnel.on("close", () => {
    console.log("Tunnel closed");
  });
})();

const server = app.listen(4545, () => {
  let host = server.address().address;
  let port = server.address().port;
  console.log(`🚀 Started on PORT ${port}`);
});


//? CONNECT TO DATABASE // 

con.connect((err) => {
  if (err) console.log("Database Connection Error:", err.code);
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
      res.send(rows);
    }
  });
});

app.get("/", (req, res) => {
  res.send(`<h1 style="text-align:center"> Welcome to Towingo 🚗</h1><a href="/api/docs">📚 View API documentation<a/>`);
});


async function isEmailValid(email_address) {
  try {
     let isValid = await emailValidator.validate(email_address);
     return isValid
  }catch(err){
    res.send(err)
  }
}

const registerUser = async (email_address, phone_number, res) => {
  let fetchUserCount =
    "SELECT count(*) as count FROM `users` WHERE `phone_number`=" +
    con.escape(phone_number) +
    "and `email_address`=" +
    con.escape(email_address) +
    "";
  // let sql = `INSERT INTO users ('?', '?', '?', '?', '?', '?') VALUES [NULL, ${mail}, ${phone},${CURRENT_TIMESTAMP},'0', '0']`;
  let addUserReq =
    "INSERT INTO `users` (`id`, `username` ,`email_address`,`phone_number` ,`DOB`, `created`, `verified`, `premium`) VALUES (NULL,NULL," +
    con.escape(email_address) +
    "," +
    con.escape(phone_number) +
    ", NULL, " +
    con.escape(CURRENT_TIMESTAMP) +
    ",'0', '0')";

  let fetchUser =
    "select exists (  select `email_address` from users where `email_address` =" +
    con.escape(email_address) +
    " or phone_number =" +
    con.escape(phone_number) +
    ") as result ";

//* FETCH USER BY PHONE NUMBER OR E-mail

  con.query(fetchUser, (err, result) => {
    if (err)
      return "DB fetch user failed" + err;


    //* if fetch is success
    else if (result[0].result === 0) {
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
    } else { return res.status(409).send({ message: "user already exists" }); }
  });
};

//* REGISTER A NEW USER //

app.post("/api/user/register", async function (req, res, next) {
  const { email_address, phone_number } = req.body;

  const { valid, reason, validators } = await isEmailValid(email_address);

  //? CHECK EMAIL SYNATX IS VALID//

  if (valid) {
    const { message } = registerUser(email_address, phone_number, res);
    return (message)
  } else return res.status(400).send({ message: validators[reason].reason });
});

//* Log existing USER //

app.post("/api/user/login", async function (req, res, next) {
  const { phone_number } = req.body;

  let fetchPhone =
    "select exists ( select `phone_number` from users where `phone_number` =" + con.escape(phone_number) +") as result ";

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

app.post("/api/send-sms", async function (req, res, next) {
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
function genOTP() {
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
  let token = genOTP();
  res.json(token);
  console.log("token: " + token.otptoken,"expires in: " + token.tRemain + " seconds");
});
//*GET USER INFOS //
app.post("/api/user/infos", async function (req, res, next) {
  const { phone_number } = req.body;
  con.query(`SELECT id, email_address, username, phone_number, gender, DATE_FORMAT(created,'%d/%m/%Y %H:%i:%s') as created, verified, premium, DATE_FORMAT(DOB,'%d/%m/%Y') as DOB FROM users WHERE  phone_number = ${phone_number}`, (error, row, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.json(row);
    }
  });
})

//* Update user infos //
app.patch("/api/user/:id/edit", async function (req, res, next) {
  const { DOB,username,gender } = req.body;
  const id = req.params.id
  con.query("UPDATE users SET username = ?, gender = ?, DOB = ? where id = ?" ,[username,gender,DOB,id], (error,result) => {
    if (error) console.log("users query error:" + error);
    else {
      res.status(200)
      .send(`User infos updated successfully:\n{ username: "${username}", gender: "${gender}", DOB: ${DOB} }`);
    }
  });
})
// * Get List of Vehicle make
app.get("/api/car/make", (req, res) => {
  con.query("select * from car2dbmakes", (error, rows, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.send(rows);
    }
  });
});

// * Get List of Vehicle vendor models
app.get("/api/car/models/:make", (req, res) => {
  const make = req.params.make
  con.query(`select * from car2dbmodels where make_id = ${make}`, (error, rows, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.send(rows);
      }
  });
});

// * Get List of cars owned by user
app.get("/api/cars/:userId", (req, res) => {
  const user_id = req.params.userId
  con.query(`select car2dbmakes.make_name, car2dbmodels.model_name, isdefault from user_cars inner join car2dbmakes on
  user_cars.make_id = car2dbmakes.make_id 
  inner join car2dbmodels on user_cars.model_id = car2dbmodels.model_id
  where user_cars.user_id = ${user_id} order by user_cars.car_id asc `, (error, rows, fields) => {
    if (error) console.log("users query error:" + error);
    else {
      res.send(rows);
      }
  });
});

//*Add a new user car *//
app.post("/api/car/add/:userId", async function (req, res, next) {
  let {make_id, model_id} = req.body;
  let user_id = req.params.userId
  con.query( `INSERT INTO user_cars (make_id, model_id, user_id, isdefault,car_id) VALUES (${make_id},${model_id},${user_id},false,NULL)`, (err, result) => {
    if (err) return "DB fetch user failed" + err;
        if (err) {
          return res
            .status(404)
            .send({ message: "SQL add query failed " + err.message });
        } else {
          console.log(JSON.stringify(result))
          return res
            .status(200)
            .send({ message: `car successfully added to user car collection` });
        }
      })
    })