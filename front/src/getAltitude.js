'use strict';
var Promise = require('es6-promise').Promise;
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

module.exports = function getAltitude(lonLats) {
    var url = "http://maps.googleapis.com/maps/api/elevation/json?locations=";

    return new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url+lonLats.map(function(lonLat){return lonLat.lat+","+lonLat.lon}).join("|"));
        
        xhr.addEventListener('load', function(){
            var data = JSON.parse(xhr.responseText);
            console.log(data);
            var elevation = data.results;
            resolve(elevation);
        });
        xhr.send();
    });
}