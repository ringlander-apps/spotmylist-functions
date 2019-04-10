const Spotify = require("spotify-web-api-node");
const spotifyApi = new Spotify();

/**
 * Function which returns tracks in playlist meeting specific criterion based on one of three different categories:
 * 1. Tempo
 * 2. Genre
 * 3. Danceability
 *
 */

module.exports = async (context, cb) => {
  try {
    let { access_token, criteria, playlist, options } = context.body;

    let filtered = [];
    let filteredTracks = [];
    let myTracks = [];
    let thePlaylist = {};
    let playlistOffset;
    let theTrackIds = [];
    let playlistData;
    let totalTracksArray = [];

    spotifyApi.setAccessToken(access_token);

    //We need to get the paging object of playlist
    thePlaylist = await spotifyApi.getPlaylist(playlist);

    //Object destructuring, grabbing limit and total
    let { limit, total } = thePlaylist.body.tracks;

    //How many pages of tracks
    let maxPage = Math.ceil(parseInt(total) / 100);
    //Set the first page
    let currentPage = 1;

    while (currentPage <= maxPage) {
      playlistOffset = (currentPage - 1) * limit;

      //Now get the tracks
      playlistData = await spotifyApi.getPlaylistTracks(playlist, {
        offset: playlistOffset,
        limit
      });
      //Fetch ids
      theTrackIds = playlistData.body.items.map(t => t.track.id);

      switch (criteria.type) {
        case "tempo":
          filtered = await getTracksByTempo(criteria.params, theTrackIds);
          filteredTracks = playlistData.body.items.filter(t => {
            return filtered.some(t2 => {
              return t2.id === t.track.id;
            });
          });

          myTracks = await mergeTracksAndTempo(filteredTracks, filtered);
          totalTracksArray = totalTracksArray.concat(myTracks);
          break;

        default:
          break;
      }

      currentPage += 1;
    }

    cb(null, totalTracksArray);
  } catch (error) {
    cb(error);
  }
};
/**
 *
 * Performs search for matching tempo in provided tracks. Uses getAudioFeaturesForTracks API-call
 *
 * @param {*} searchParams the search paramter obejct, (value, precision)
 * @param {*} trackIds array of track ids
 */
async function getTracksByTempo(searchParams, trackIds) {
  try {
    let { halfTempoAllowed, precision, value } = searchParams;

    let af = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    return af.body.audio_features.filter(track => {
      let num = parseInt(track.tempo);

      return halfTempoAllowed
        ? (num <= value / 2 + precision && num > value / 2 - precision) ||
            (num <= value + precision && num > value - precision)
        : num <= value + precision && num > value - precision;
    });
  } catch (error) {
    return null;
  }
}
/**
 * Add tempo attribute to Spotify track using audio_feature object
 *
 * @param {*} tracks array of Spotify tracks
 * @param {*} audio_features array of spotify audio features
 */
async function mergeTracksAndTempo(tracks, audio_features) {
  let myTracks = [];

  try {
    tracks.forEach(track => {
      let aTrack = track;
      let aObj = audio_features.find(af => {
        return af !== null && af !== undefined
          ? af.id === track.track.id
          : null;
      });
      if (aObj !== null && aObj !== undefined) {
        aTrack.track.tempo = aObj.tempo;
      }
      myTracks.push(aTrack);
    });
    return myTracks;
  } catch (error) {}
}
