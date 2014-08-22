'use strict';

var serverCommunication = require('./serverCommunication.js');
var gui = require('./gui.js');
var guiControls = gui.guiControls;

//var parseGeometry = require('./parseGeometry.js');
var rTree = require('./rTree.js');
var geoCode = require('./geoCode.js');
var loadTiles = require('./loadTiles.js');

var _3dviz = require('./3dviz.js');
var scene = _3dviz.scene;
var camera = _3dviz.camera;
var light = _3dviz.light;
var renderer = _3dviz.renderer;

//var controls = require('./controls.js')(camera);
var controls = require('./FirstPersonControls.js')(camera, renderer.domElement);
var moveCamera = require('./moveCamera.js')(camera, function(camera){
    // visible bounding box
    var L = 2 * camera.position.z * Math.tan(3.14*camera.fov/(2*180));
    var l = L * WIDTH / HEIGHT;
    // console.log(camera.position.x,camera.position.z);
    // console.log(L, l);
    // console.log("----------");
    var south = camera.position.y - L/2;
    var north = camera.position.y + L/2;
    var west = camera.position.x - l/2;
    var east = camera.position.x + l/2;
    console.log(south, north, east, west);
    loadTiles(south, north, east, west);
});

var CUB = require('./CUB_parameters.js');

var GeoConverter = require('./geoConverter.js');
var SunCalc = require('suncalc');

// TODO change values on resize
var WIDTH = window.innerWidth,
    HEIGHT = window.innerHeight;

// Create an event listener that resizes the renderer with the browser window.
window.addEventListener('resize', function() {
    WIDTH = window.innerWidth,
    HEIGHT = window.innerHeight;
    renderer.setSize(WIDTH, HEIGHT);
    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();
});

// initialise the geoconverter that will pass from a shifted lambert cc 45 to lon, lat and reverse

var geoConverter = new GeoConverter(CUB.lambert, CUB.deltaX, CUB.deltaY);


serverCommunication.metadataP.then(function(metadata) {

    Object.keys(metadata).forEach(function(id) {
        var building = metadata[id];
        var X = building.X;
        var Y = building.Y;
        var item = [building.xmin + X*200, building.ymin + (CUB.MAX_Y-Y)*200, building.xmax + X*200, building.ymax+ (CUB.MAX_Y-Y)*200, {id: id, X:X, Y:Y}];
        rTree.insert(item);
    });

    // load unconditionnally
    // loadTiles(11065.111059952906, 11270.186327486968, 24849.239355716505, 24233.21091018855);
    loadTiles(10733.030036453603, 11038.862106779145, 24776.123980987297, 24062.720113534535 );
    // geoCode(guiControls.address).then(function(coords) {
    //     var newPosition = geoConverter.toLambert(coords.lon, coords.lat);
    //     moveCamera(newPosition.X, newPosition.Y, 300); })
    // });
});

gui.addressControler.onFinishChange(function(value) {
    geoCode(value).then(function(coords) {
        var newPosition = geoConverter.toLambert(coords.lon, coords.lat);
        console.log("new pos", newPosition);
        moveCamera(newPosition.X, newPosition.Y, 300);
    })
});

gui.altitudeControler.onFinishChange(function(value) {
    var camz = guiControls.altitude;
    moveCamera(undefined, undefined, camz);
});


gui.hourControler.onChange(function(value) {
    // get today's sunlight times for Bordeaux
    var date = new Date();
    date.setHours(value);

    var sunPos = SunCalc.getPosition(date, -0.573781, 44.840484);

    var radius = 30000;
    var lightX = radius * Math.cos(sunPos.azimuth);
    var lightY = radius * Math.sin(sunPos.azimuth);
    var lightZ = radius * Math.tan(sunPos.altitude);
    light.position.set(lightX, lightY, lightZ);
});


