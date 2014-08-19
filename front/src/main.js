'use strict';

var THREE = require('three');
var rbush = require('rbush');
var io = require('socket.io-client');
var dat = require('dat-gui');
  

var MAXY = 170;
var buildingMap = new Map();
var rTree = rbush(100000);

// useful functions
// we'll transform x,y ranging from -nbx to nbx in 4096 int values
var nbx = 150;
function transform(x) {
    return 2*x*nbx/4095-nbx;
}

var nbz1 = -75;
var nbz2 = 115;
// we'll transform z ranging from nbz1 to nbz2 in 255 int values
function transformZ(z) {
    return (z - 255)*(nbz2-nbz1)/255 +nbz2;
}

function parseGeom(data) {

    var geometry = new THREE.Geometry();
    var buffer = new DataView(data.buffer);
    var offset = 0;

    var verticesNb = buffer.getUint16(offset);
    offset += 2;

    for(var i = 0 ; i < verticesNb ; i++){

        var b1 = buffer.getUint8(offset);
        offset++;
        var b2 = buffer.getUint8(offset);
        offset++;
        var b3 = buffer.getUint8(offset);
        offset++;

        var x = transform(((b1 & 0xFF) << 4) + ((b2 & 0xF0) >> 4));
        var y = transform(((b2 & 0x0F) << 8) + ((b3 & 0xFF) >> 0));

        var z = transformZ( buffer.getUint8(offset) );
        offset++;

        // decompress en x, y, z
        geometry.vertices.push(new THREE.Vector3(x, y, z));
    }


    var facesNb = buffer.getUint16(offset);
    offset += 2;

    var faces = [];
    for(var i = 0 ; i < facesNb ; i++){
        var a = buffer.getUint16(offset);
        offset += 2;
        var b = buffer.getUint16(offset);
        offset += 2;
        var c = buffer.getUint16(offset);
        offset += 2;
        geometry.faces.push(new THREE.Face3(a, b, c));
    }

    geometry.computeFaceNormals();
    var mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
        color: 0xaaaaaa,
        wireframe: false
    }));
    mesh.position.set(jsondata[data.id]["X"] * 200, (MAXY - jsondata[data.id]["Y"]) * 200, 0);
    scene.add(mesh);
    return mesh;
}

//socket
var socket = io();
var endpointP = new Promise(function(resolve){
    socket.on('endpoint', function(msg){
        console.log("endpoint", msg);
        resolve(msg);
    });
});

// when receiving a building parse it
socket.on('building', function(msg){
    try {
        var mesh = parseGeom(msg);
        // add to map
        buildingMap.set(msg.id, {mesh:mesh, visible:true});
    } catch (e) {
        console.error(e);
    }
});

// Set up the scene, camera, and renderer as global variables.
var scene, camera, renderer;

// global variables for time
var curHour = 10;
var seasonsMonth = [7, 11];
var curMonth = seasonsMonth[0];

var camx, camy, camz;
var token;
var jsondata;

// setup the gui
var guiControls = {
    address : "Place Peyberland, Bordeaux",
    altitude : 500,
    hour : 14,
    winter : false
};
var gui = new dat.GUI();
var addressControl = gui.add(guiControls, 'address');
var altitudeControler = gui.add(guiControls, 'altitude',100,3000);

init();
animate();

function geoCode(address) {
    var url = "http://maps.googleapis.com/maps/api/geocode/json?address=";

    return new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url+address);
        xhr.responseType = 'json';

        xhr.addEventListener('load', function(){
            var data = xhr.response
            var lon = data.results[0].geometry.location.lng;
            var lat = data.results[0].geometry.location.lat;
            console.log(lon,lat);
            resolve({lon : lon, lat : lat});
        });
        xhr.send();
    });
}

function invLinX(x) {
    return (x + 0.575803)*(123*200-125*200)/(-0.575803+0.570726) + 123*200;
}
function invLinY(y) {
    return (y - 44.839642)*((MAXY - 112)*200 - (MAXY - 113)*200)/(44.841441 - 44.839642) + (MAXY - 113)*200;
}


// Sets up the scene.
function init() {

    // Create the scene and set the scene size.
    scene = new THREE.Scene();

    var WIDTH = window.innerWidth,
        HEIGHT = window.innerHeight;

    // Create a renderer and add it to the DOM.
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(WIDTH, HEIGHT);
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    document.body.appendChild(renderer.domElement);


    // Create an event listener that resizes the renderer with the browser window.
    window.addEventListener('resize', function() {
        var WIDTH = window.innerWidth,
            HEIGHT = window.innerHeight;
        renderer.setSize(WIDTH, HEIGHT);
        camera.aspect = WIDTH / HEIGHT;
        camera.updateProjectionMatrix();
    });

    // Set the background color of the scene.
    renderer.setClearColorHex(0x333F47, 1);

    endpointP.then(function(msg) {
        token = msg.token;

        // fill the rtree
        jsondata = JSON.parse(msg.metadata);

        Object.keys(jsondata).forEach(function(id) {
            var building = jsondata[id];
            var X = building.X;
            var Y = building.Y;
            var item = [building.xmin + X*200, building.ymin + (MAXY-Y)*200, building.xmax + X*200, building.ymax+ (MAXY-Y)*200, {id: id, X:X, Y:Y}];
            rTree.insert(item);
        });

        geoCode("peyberland bordeaux").then(function(coords) {
            console.log("moving to",invLinX(coords.lon), invLinY(coords.lat), 300);
            moveCamera(invLinX(coords.lon), invLinY(coords.lat), 300);
        })
    });


    // Create a camera, zoom it out from the model a bit, and add it to the scene.
    camera = new THREE.PerspectiveCamera( 30, WIDTH / HEIGHT, 1, 5000 );
    camera.up.set(0, 1, 0);
    scene.add(camera);


    var light = new THREE.DirectionalLight(0xffffff, 1);
    light.lookAt([0,0,0]);
    light.castShadow = true;
    light.shadowDarkness = 0.6;
    light.shadowMapWidth = 2048;
    light.shadowMapHeight = 2048;
    light.position.set(0,0,400);
    scene.add(light);


    function loadTiles(south, north, east, west) {
        console.log("query", south, north, east, west);
        // query the rtree to know what building are needed
        var results = rTree.search([west, south, east, north]);

        console.log("query results", results);

        //remove all buildings from scene
        buildingMap.forEach(function(building){
            building.visible = false;
            scene.remove(building.mesh);
        });

        results.forEach(function(result) {
            if (buildingMap.has(result[4].id) === false){
                // not in the map => ask the backend
                socket.emit('object', {token : token, id : result[4].id});
            } else { // in the map
                var entry = buildingMap.get(result[4].id);
                // if not visible, added back to the scene
                scene.add(entry.mesh);
                entry.visible = true;
            }

        });

        var buildings = results.forEach(function(result) {

        });
    }

    function moveCamera(ncamx, ncamy, ncamz) {
        camx = ncamx;
        camy = ncamy;
        camz = ncamz
        camera.position.x = camx;
        camera.position.y = camy;
        camera.position.z = camz;
        camera.lookAt(new THREE.Vector3( camx, camy, 0 ));

        // visible bounding box
        var L = 2 * camz * Math.tan(3.14*camera.fov/(2*180));
        var l = L * WIDTH / HEIGHT;
        // console.log(camera.position.x,camera.position.z);
        // console.log(L, l);
        // console.log("----------");
        var south = camera.position.y - L/2;
        var north = camera.position.y + L/2;
        var west = camera.position.x - l/2;
        var east = camera.position.x + l/2;
        loadTiles(south, north, east, west);
    };

    addressControl.onFinishChange(function(value) {
        geoCode(value).then(function(coords) {
            console.log("moving to", invLinX(coords.lon), invLinY(coords.lat), camz)
            moveCamera(invLinX(coords.lon), invLinY(coords.lat), camz);
        })
    });

    altitudeControler.onFinishChange(function(value) {
        camz = guiControls.altitude;
        moveCamera(camx, camy, camz);
    });

    // add controls
    var keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40, ROTATE: 65, ZOOM: 83, PAN: 68 };
    var userPanSpeed = 200.0;
    function pan ( distance ) {
        camx = camera.position.x + distance.x*userPanSpeed;
        camy = camera.position.y + distance.y*userPanSpeed;
        moveCamera(camx, camy, camz);
    };

    function onKeyDown( event ) {
        switch ( event.keyCode ) {

            case keys.UP:
                pan( new THREE.Vector3( 0, 1, 0 ) );
                break;
            case keys.BOTTOM:
                pan( new THREE.Vector3( 0, - 1, 0 ) );
                break;
            case keys.LEFT:
                pan( new THREE.Vector3( - 1, 0, 0 ) );
                break;
            case keys.RIGHT:
                pan( new THREE.Vector3( 1, 0, 0 ) );
                break;
        }
    }

    function onKeyUp( event ) {

        switch ( event.keyCode ) {

            case keys.ROTATE:
            case keys.ZOOM:
            case keys.PAN:
                state = STATE.NONE;
                break;
        }

    }
    window.addEventListener( 'keydown', onKeyDown, false );
    window.addEventListener( 'keyup', onKeyUp, false );

}


// Renders the scene and updates the render as needed.
function animate() {

    // Read more about requestAnimationFrame at http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
    requestAnimationFrame(animate);

    // Render the scene.
    renderer.render(scene, camera);

}