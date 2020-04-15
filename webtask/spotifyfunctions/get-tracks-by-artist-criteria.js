const Spotify = require("spotify-web-api-node");
const spotifyApi = new Spotify();

module.exports = async (context, cb) => {
  try {
    let { access_token, artist_name, criteria, options } = context.body;
    let albumIds = [];
    let albums = [];
    let totalTracks = [];
    let totalTrackIds = [];
    let filtered = [];
    let filteredTracks = [];
    let mergedWithAF = [];
    let returnedTracks = [];
    let restArr = [];
    const maxTrackIds = 100;

    spotifyApi.setAccessToken(access_token);

    //Fetch artist matching name
    let artist = await getArtistByName(artist_name);

    if (artist) {
      //Fetch albums by artist
      albums = await getArtistAlbums(artist.id);
      albumIds = albums.map(a => a.id);

      for (let id of albumIds) {
        //Retrieve tracks for each album
        let data = await getAlbumTracks(id);
        //Add track ids to totaltracks array
        totalTracks = totalTracks.concat(data);
        totalTrackIds = totalTrackIds.concat(data.map(t => t.id));
      }
      //Make sure we don't got any duplicates
      totalTrackIds = [...new Set(totalTrackIds)];
      totalTracks = [...new Set(totalTracks)];

      //Find out how many iterations is needed
      if (totalTrackIds.length > maxTrackIds) {
        let maxIteration = Math.ceil(totalTrackIds.length / maxTrackIds);
        let currentIteration = 0;
        let start = 0;
        let end = 0;
        while (currentIteration < maxIteration) {
          start = currentIteration * maxTrackIds;
          end = start + maxTrackIds - 1;

          if (end >= totalTrackIds.length) {
            end = totalTrackIds.length - 1;
          }
          restArr = totalTrackIds.slice(start, end);

          //Get tracks matching tempo
          filtered = await getTracksByTempo(criteria.parameters, restArr);
          filteredTracks = totalTracks.filter(t => {
            return filtered.some(t2 => {
              return t2.id === t.id;
            });
          });

          mergedWithAF = await mergeTracksAndTempo(filteredTracks, filtered);
          returnedTracks = returnedTracks.concat(mergedWithAF);
          currentIteration += 1;
        }
      } else {
        filtered = await getTracksByTempo(criteria.parameters, totalTrackIds);
        filteredTracks = totalTracks.filter(t => {
          return filtered.some(t2 => {
            return t2.id === t.id;
          });
        });
        returnedTracks = await mergeTracksAndTempo(filteredTracks, filtered);
      }
    }

    cb(null, returnedTracks);
  } catch (error) {
    cb(error);
  }
};
/**
 *
 * @param {*} album_id
 */
async function getAlbumTracks(album_id) {
  try {
    let data = await spotifyApi.getAlbumTracks(album_id);
    let { items } = data.body;
    return items;
  } catch (error) {
    return null;
  }
}
/**
 *
 * @param {*} artist_id
 */
async function getArtistAlbums(artist_id) {
  try {
    let data = await spotifyApi.getArtistAlbums(artist_id, {
      album_type: "album",
      country: "US",
      limit: 10
    });
    let { items, total } = data.body;
    return items;
  } catch (error) {
    return null;
  }
}
/**
 *
 * @param {*} artist_name
 */
async function getArtistByName(artist_name) {
  try {
    let data = await spotifyApi.searchArtists(artist_name, {
      limit: 10,
      offset: 0
    });
    //console.log(artist_name);
    let { items, total } = data.body.artists;
    //console.log(items);
    if (total > 0) {
      let artist = items.find(artist => artist.name == artist_name);
      return artist;
    }
  } catch (error) {
    return null;
  }
}
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
    //&console.log(af);
    return af.body.audio_features.filter(track => {
      let num = parseInt(track.tempo);

      return halfTempoAllowed
        ? (num <= value / 2 + precision && num > value / 2 - precision) ||
            (num <= value + precision && num > value - precision)
        : num <= value + precision && num > value - precision;
    });
  } catch (error) {
    //console.log(error);
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
        return af !== null && af !== undefined ? af.id === track.id : null;
      });
      if (aObj !== null && aObj !== undefined) {
        aTrack.tempo = aObj.tempo;
      }
      myTracks.push(aTrack);
    });
    return myTracks;
  } catch (error) {}
}
