var fs = require('fs');
var request = require('request').defaults({ encoding: null });
var jsonfile = require('jsonfile');
var moment = require('moment');
var Twit = require('twit');
var Converter = require("csvtojson").Converter;
var twitterConfig = require('./twitter-config');

console.log(Date());
var Bot = new Twit(twitterConfig);
var csv = new Converter({});

// get the current index from a json file, so records aren't repeated
var obj = JSON.parse(fs.readFileSync(__dirname + '/badarborists-index.json', 'utf8') || '{}');
var index = obj.index || 0;

// read a csv file containing incident of illegal arborist activity
csv.fromFile(__dirname + '/IllegalArborists.csv', function(err, csvFile) {
  if (err) console.error('error reading csv file', err);

  var doTweet = function() {

    var record;
    // loop through the records and find descriptions that contain removal or destruction
    while (true) {
      index++;
      record = csvFile[index];
      if (record.Description.search('remov') > 0 || record.Description.search('destr') > 0) {
        // break out of loop and use this record to tweet
        break;
      }
    }

    var status = 'Illegal destruction of tree on ' + moment(record.Date, 'MM/DD/YYYY').format("dddd, MMMM Do YYYY");
    console.log(status);

    // post to twitter
    var location = encodeURI(record.Address);
    // use Google Maps API to get a street view image of this location
    request.get('https://maps.googleapis.com/maps/api/streetview?size=600x400&location=' + location, function (error, response, body) {
      if (error) {
        console.error('error getting streetview image', error);
      } else {
        imageData = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');

        // upload street view image to Twitter so it can be used in a tweet
        Bot.post('media/upload', { media_data: new Buffer(body).toString('base64') }, function (err, data, response) {
          if (err) console.error('error uploading image to twitter', err);
          // now we can assign alt text to the media, for use by screen readers and 
          // other text-based presentations and interpreters 
          var mediaIdStr = data.media_id_string
          var meta_params = { media_id: mediaIdStr }

          Bot.post('media/metadata/create', meta_params, function (err, data, response) {
            if (err) {
              console.error('error creating metadata', err);
            } else {
              // now we can reference the media and post a tweet (media will attach to the tweet) 
              var params = { status: status, media_ids: [mediaIdStr] }
         
              Bot.post('statuses/update', params, function (err, data, response) {
                if (err) console.error('error tweeting', err);
                else console.log('done tweeting');
              });
            }
          })
        })
      }
    });


    // save csv index to store what records have been read
    jsonfile.writeFile(__dirname + '/badarborists-index.json', { 'index': index }, { spaces: 2 }, function(err) {
      console.error(err);
    });


  }

  // start script after csv is loaded
  doTweet();
});