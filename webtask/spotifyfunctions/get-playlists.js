const Spotify = require("spotify-web-api-node");
const spotifyApi = new Spotify();

/**
 * Function which returns a list of a user's playlists
 */
module.exports = async (context, cb) => {
  try {
    let { options, access_token } = context.body;

    spotifyApi.setAccessToken(access_token);
    let data = await spotifyApi.getUserPlaylists(options);

    cb(null, data.body);
  } catch (error) {
    cb(error);
  }
};
