const mysql = require("mysql");
const config = require("./Config")
const con = initCon();
const localtunnel = require('localtunnel');

function initCon(){
    return mysql.createConnection({config});
}

function tunnelCon(){
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
}


function dbCon(){
    con.connect((err) => {
        if (err) console.log("Database Connection Error:", err.sqlMessage);
        else {
          console.log("Successfully connected to DB 😀");
        }
      });      
}
  async function fetchAll() {
      let response = null
      try {
        response = con.query("select * from users", (error, rows, fields) => {
        // response = rows
    
      })
      console.log("w: "+response+typeof(response))
      return (response);

      }catch(err){console.log(err)}
    }
    
    
  module.exports = {dbCon,fetchAll,initCon,tunnelCon}
