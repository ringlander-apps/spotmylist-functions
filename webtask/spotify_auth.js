const express = require("express");
const Webtask = require("webtask-tools");
const request = require("request");
const querystring = require("querystring");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");

//const whitelist = ['https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com/','http://localhost:8080'];
// const options = {
//   origin: function(origin, callback){
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   }
// };

const redirect_uri =
  "https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com/spotify_auth/callback";

var generateRandomString = function(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const state_key = "spotify_auth_state";

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

//app.options('*', cors()); // include before other routes

/*app.use(function(req, res, next) {
  //res.header("Access-Control-Allow-Origin","https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com"); //My frontend APP domain
  // console.log('The request headers: '+req.headers);
  
  // //res.header('Access-Control-Allow-Origin', "*");
  // res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  // res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  const allowedOrigins = ['https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com', 'http://localhost:8080'];
  // let origin = req.headers.origin;
  // console.log('Origin in middleware: '+origin);
  // if(allowedOrigins.indexOf(origin) > -1){
  //      res.setHeader('Access-Control-Allow-Origin', origin);
  // }
  //console.log('Request headers: '+req.headers.origin);

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

app.get('/login', (req, res)=>{
  res.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
        response_type: 'code',
        client_id: req.webtaskContext.data.SPOTIFY_CLIENT_ID,
        scope: 'user-read-private user-read-email',
        redirect_uri
    }));
});*/

// app.get('/login',(req,res,next)=>{
//   res.json('This is CORS-enabled for all origins');
// });

/*const whitelist = ['http://127.0.0.1:8080','https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com',
                  'https://accounts.spotify.com/authorize','http://localhost:8080'];


const corsOptions = {
  origin: 'https://spotify.com',
  optionsSuccessStatus:200
}

const corsOptionsDynamic = {
  origin: function(origin, callback){
    if(whitelist.indexOf(origin)!==-1 || !origin){
      callback(null,true);
    }else{
      callback(new Error('Not allowed by CORS'));
    }
  }
  
}*/

// app.get('/login',cors(corsOptions),(req,res,next)=>{
//   res.json('This is CORS-enabled for '+corsOptions.origin.toString());
// });

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/login", (req, res, next) => {
  const state = generateRandomString(16);
  res.cookie(state_key, state);
  console.log("Generated state: " + state);
  console.log("Cookie name:" + state_key + " Cookie value: " + state);
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: req.webtaskContext.data.SPOTIFY_CLIENT_ID,
        scope: "user-read-private user-read-email",
        redirect_uri,
        state
      })
  );
});

app.get("/callback", (req, res, next) => {
  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[state_key] : null;
  
  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch"
        })
    );
  } else {
    res.clearCookie(state_key);
    let authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri,
        grant_type: "authorization_code"
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(
            req.webtaskContext.data.SPOTIFY_CLIENT_ID +
              ":" +
              req.webtaskContext.data.SPOTIFY_CLIENT_SECRET
          ).toString("base64")
      },
      json: true
    };
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        let access_token = body.access_token,
          expires_in = body.expires_in,
          scope = body.scope,
          refresh_token = body.refresh_token;
        let uri =
          process.env.FRONTEND_URI || "http://localhost:8080/spotify-auth";
        res.redirect(
          uri +
            "?" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
              expires_in: expires_in,
              scope: scope
            })
        );
      } else {
        res.redirect(uri + querystring.stringify({ error: "Invalid token" }));
      }
    });
  }
});

app.get("/refresh_token", (req, res) => {
  const refresh_token = req.query.refresh_token;
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(
          webtaskContext.data.SPOTIFY_CLIENT_ID +
            ":" +
            req.webtaskContext.data.SPOTIFY_CLIENT_SECRET
        ).toString("base64")
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token
    },
    json: true
  };
  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token,
        expires_in = body.expires_in;

      res.send(
        querystring.stringify({
          access_token: access_token,
          expires_in: expires_in
        })
      );
    }
  });
});

module.exports = Webtask.fromExpress(app);
