const express = require('express');
const Webtask = require('webtask-tools');
const request = require('request');
const querystring = require('querystring');
const bodyParser = require('body-parser');

const redirect_uri = 'https://wt-528cf0f2960f63b4d651b3859d2fbb9a-0.sandbox.auth0-extend.com/spotify_auth/callback';

const app = express();

app.use(bodyParser.json());

app.get('/login', (req, res)=>{
  res.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
        response_type: 'code',
        client_id: req.webtaskContext.data.SPOTIFY_CLIENT_ID,
        scope: 'user-read-private user-read-email',
        redirect_uri
    }));
});

app.get('/callback', (req, res)=>{
  let code = req.query.code || null
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer(
        req.webtaskContext.data.SPOTIFY_CLIENT_ID + ':' + req.webtaskContext.data.SPOTIFY_CLIENT_SECRET
      ).toString('base64'))
    },
    json: true
  };
  request.post(authOptions, function(error, response, body) {
    let access_token = body.access_token;
    let uri = process.env.FRONTEND_URI || 'http://localhost:8080';
    res.redirect(uri + '?access_token=' + access_token);
  });
});

module.exports = Webtask.fromExpress(app);