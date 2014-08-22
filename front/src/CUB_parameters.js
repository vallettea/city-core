'use strict';

// this are the variables used to center the messy model from CUB

// the map is shifted
// -0.583232, 44.839270 corresponds to 1416800.1046884255, 4188402.562212417 in lambert 45
// and to (X=119) * 200 + (x=100), (MAX_Y-(Y=115))*200 + (y=100) in the map
var MAX_Y = 170;

module.exports = {
	MAX_Y : MAX_Y,
	lambert : 45,
	deltaX : 1416800.1046884255 - 119*200 - 100,
	deltaY : 4188402.562212417 - (MAX_Y-115)*200 - 100
}