const express = require("express");
const Webtask = require("webtask-tools");
const request = require("request");
const querystring = require("querystring");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const redirect_uri =
  //"https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com/spotify_auth/callback";
  "https://wt-820975869a3e549eb65406598aa10b11-0.sandbox.auth0-extend.com/spotify-auth/callback";

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
app.use(cors());
app.use(cookieParser());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

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
          process.env.FRONTEND_URI || "http://localhost:5000/spotify-auth";
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
  console.log(res.getHeaders());
  const refresh_token = req.query.refresh_token;
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(
          req.webtaskContext.data.SPOTIFY_CLIENT_ID +
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
