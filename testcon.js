const express = require("express");
const app = express();
var morgan = require("morgan");
app.use(morgan("combined"));
app.use(express.json());
app.use( express.urlencoded({extended: true,}));
const mysql = require("mysql");
const CURRENT_TIMESTAMP = require("moment-timezone")().format(
  "YYYY-MM-DD hh:mm:ss"
);
const emailValidator = require("deep-email-validator");
const localtunnel = require("localtunnel");
require("dotenv").config();
const queries = require('./queries.js')

const server = app.listen(4545, () => {
    let host = server.address().address;
    let port = server.address().port;
    console.log(`Started on PORT ${port}`);
    });
    

//* Log incoming requests with morgan 

queries.initCon();
queries.tunnelCon();
queries.dbCon();

  

app.get("/api/users", (req, res) => {
    let response = queries.fetchAll();
    console.log(JSON.stringify(response))
    res.json((response))
});
  
  app.get("/", (req, res) => {
    res.send('Hello World')
   });



