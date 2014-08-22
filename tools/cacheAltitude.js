"use strict";


var fs = require('graceful-fs');
var getAltitude = require('../front/src/getAltitude.js');
var Promise =  require('es6-promise').Promise;


function group(list, size){
	var ret = [];
	var cursor = 0;
	while(cursor < list.length){
		ret.push(list.slice(cursor, cursor + size));
		cursor += size;
	}
	return ret;
}

fs.readFile("./tools/data/lonLat.json", function(error, text){

	if (error) {
		console.error(error, "If file missing run tools/gatherLonLat.js");
		throw error;
	};

	var data = JSON.parse(text);
	var lonLats = Object.keys(data).map(function(key){return {key: key, lonLat:data[key]}});
	var finalResult = {};


	var chunkPs = group(lonLats,510).map(function(chunk){



		return getAltitude(chunk.map(function(res){return res.lonLat})).then(function(results){
			var altitudes = results.forEach(function(res, i){
				finalResult[chunk[i].key] = res.elevation;
				});
		}).catch(function(err){console.error(err, "here")});

	})

	Promise.all(chunkPs).then(function(){
		fs.writeFile("./tools/data/altitudes.json", JSON.stringify(finalResult), function(err){console.error(err)});
	}).catch(function(err){console.error(err)});

})

