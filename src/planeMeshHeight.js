'use strict';

/*
    Given a flat (in x,y) mesh and a x,y position, find the z of the position on the mesh
*/

/*
    mesh {
        vertices: [
            {x, y, z} // floats
        ],
        faces: [
            { a, b, c } // indices in vertices array
        ]
    };
*/

module.exports = function(mesh, x, y){
    var vertices = mesh.vertices;
    
    // find the 3 closest vertices
    var xs = vertices.map(function(v){return v.x});
    var ys = vertices.map(function(v){return v.y});
    var zs = vertices.map(function(v){return v.z});

    var range = Array.apply(null, Array(xs.length)).map(function (_, i) {return i;});

    var dx = xs.map(function(c){return c-x});
    var dy = ys.map(function(c){return c-y});

    var distance = range.map(function(i){return Math.sqrt(dx[i]*dx[i] + dy[i]*dy[i])});
    var sortedDist = distance.slice(0).sort(function(a, b){return a-b});
    var indexes = range.slice(0,3).map(function(i){return distance.indexOf(sortedDist[i])});

    // compute the baricentric z of these vertices
    var num = indexes.map(function(i){return zs[i] * distance[i] }).reduce(function(a,b){return a+b});
    var denom = indexes.map(function(i){return distance[i] }).reduce(function(a,b){return a+b});
    
    return num/denom;
};
