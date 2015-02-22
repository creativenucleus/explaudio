var ScAMPLE_RATE = 44100;
var AUDIO_BITS = new Array();
var OSCILLATORS = new Array();

$(document).ready(function() {
	$('#btn_play').hide();
	$('#btn_stop').hide();

	var canvasEnv = setupCanvasEnv('viewport');

	$('#btn_upload').on('click', function() {
		var fileInput = $('input[name="fileToUpload"]');
		fileInput = fileInput[0];
		var files = fileInput.files;

		if(files.length == 0 || !files[0]) {
			return;
		}
		
		imageFromUpload(canvasEnv, files[0]).done(function() {
			createSound(canvasEnv);
		});
	});
	
	$('#btn_load_sample').on('click', function() {
		var fileToLoad = $('select[name="image"]').val();
		
		imageFromSample(canvasEnv, fileToLoad).done(function() {
			createSound(canvasEnv);
		});
	});

	$('#btn_play').on('click', function() {
		playSound();
	});

	$('#btn_stop').on('click', function() {
		stopSound();
	});
});


function createSound(canvasEnv) {
	stopSound();
	
	var imageColumns = new Array();
	var canvasWidth = canvasEnv.canvas.width;
	for(var x = 0; x < canvasWidth; x ++) {
		imageColumns[x] = getPixelColumn(canvasEnv, x);
	}
		
	var bitPositions = createAudioBuffer(6.0);
	var rPhase = 0;
	var gPhase = 0;
	var bPhase = 0;
	var hPhase = 0;
	var sPhase = 0;
	var lPhase = 1;
	for(var bPos = 0; bPos < bitPositions; bPos ++) {
		// Get the pixel index in the image for this bit position
		var pixelIndexXFl = (bPos / bitPositions) * canvasWidth;
		var pixelIndex = Math.floor(pixelIndexXFl);
		
		var imageColumn = imageColumns[pixelIndex];
		
		var val1 = (
			waveFunc(rPhase, rPhase, gPhase, bPhase)
			+ waveFunc(gPhase, rPhase, gPhase, bPhase)
			+ waveFunc(bPhase, rPhase, gPhase, bPhase)
		) / 3;

		var val2 = (
			waveFunc(rPhase * hPhase, rPhase, gPhase, bPhase)
			+ waveFunc(gPhase * sPhase, rPhase, gPhase, bPhase)
			+ waveFunc(bPhase * lPhase, rPhase, gPhase, bPhase)
		) / 3;
		
		setAudioBit(bPos, false, val1);
		setAudioBit(bPos, true, val2);
		
		rPhase += 0.05 * imageColumn['r'];
		gPhase += 0.025 * imageColumn['g'];
		bPhase += 0.01 * imageColumn['b'];
//		hPhase += 0.1 * imageColumn['h'];
//		sPhase += 0.2 * imageColumn['s'];
		lPhase += 0.1 * imageColumn['l'];
	}
	
	showButton();
}


// Inputs:
// 	value: any float
// squarePart, sawPart, sinePart: 0 to 1 -> don't need to add up to 3
// Returns -1 to +1
function waveFunc(value, squarePart, sawPart, sinePart) {
	var value = 0;
	var totalParts = 0;

	if(squarePart > 0) {
		var input = (value - Math.floor(value)) < 0.5 ? -1.0 : 1.0;
		value += input * squarePart;
		totalParts += squarePart;
	}

	if(sawPart > 0) {
		var input = 2 * (value - Math.floor(value)) - 1;
		value += input * sawPart;
		totalParts += sawPart;
	}

	if(sinePart > 0) {
		var input = Math.sin(value);
		value += input * sinePart;
		totalParts += sinePart;
	}

	if(totalParts == 0) {
		return 0;
	}
	
	return (totalParts == 0) ? 0 : (value / totalParts);
}


function showButton() {
	$('#btn_play').show();
//	$('#btn_stop').show();
}


// Returns the context
function setupCanvasEnv(canvasId) {
	var canvas = document.getElementById(canvasId);
	return {
		canvas: canvas,
		context: canvas.getContext('2d')
	}
}


// Loads the image
function imageFromSample(canvasEnv, filepath) {
	var dfd = new jQuery.Deferred();
	
	var srcImage = new Image();
	srcImage.onload = function(){
		canvasEnv.context.drawImage(srcImage, 0, 0, canvasEnv.canvas.width, canvasEnv.canvas.height);
		dfd.resolve();
	}
	srcImage.src = filepath;
	
	return dfd.promise();
}


function imageFromUpload(canvasEnv, filepath) {
	var dfd = new jQuery.Deferred();

	var reader = new FileReader();
	reader.onload = function(event){
		var srcImage = new Image();
		srcImage.onload = function(){
			canvasEnv.context.drawImage(srcImage, 0, 0, canvasEnv.canvas.width, canvasEnv.canvas.height);
			dfd.resolve();
		}
		srcImage.src = event.target.result;
	}
	
	reader.readAsDataURL(filepath);
	return dfd.promise();
}

// Returns [0]->r [1]->g [2]->b
function getPixel(context, x, y) {
	return context.getImageData(x, y, 1, 1).data;
}


function getPixelColumn(canvasEnv, x) {
	var column = canvasEnv.context.getImageData(x, 0, 1, canvasEnv.canvas.height).data;

	var accR = 0;
	var accG = 0;
	var accB = 0;
	var accH = 0;
	var accS = 0;
	var accL = 0;
	for(var pixIndex = 0; pixIndex < column.length; pixIndex += 4) {
		accR += column[pixIndex];
		accG += column[pixIndex + 1];
		accB += column[pixIndex + 2];
		var hsl = rgbToHsl(column[pixIndex], column[pixIndex + 1], column[pixIndex + 2]);
		accH += hsl[0];
		accS += hsl[1];
		accL += hsl[2];
	}
	
	return {
		r: (accR / column.length) / 255.0,
		g: (accG / column.length) / 255.0,
		b: (accB / column.length) / 255.0,
		h: (accH / column.length),
		s: (accS / column.length),
		l: (accL / column.length)
	}
}


/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}


function createAudioBuffer(lengthSeconds) {
	var data = []; // yes, it's an array
	
	var size = lengthSeconds * 44100;	
	for(var i = 0; i < size; i++) { 
		AUDIO_BITS[i++] = 127;	// left, then right
	}

	return size / 2;	// So we have the correct number for Left and Right
}

// value should be float, -1.0 to 1.0
function setAudioBit(position, isRight, value) {
	var bitPos = position * 2 + (isRight ? 1 : 0);
	var valInt = 127 + Math.round(127 * value);
		
	AUDIO_BITS[bitPos] = valInt;
}


function setupAudioContext() {
	try {
	// Fix up for prefixing
		window.AudioContext = window.AudioContext||window.webkitAudioContext;
		return new AudioContext();
	} catch(e) {
		alert('Web Audio API is not supported in this browser');
		return null;
	}
}



// createOscillator(audioContext, 1, 400);
// 
//Sine wave is type = “sine”
//Square wave is type = “square”
//Sawtooth wave is type = “saw”
//Triangle wave is type = “triangle”
//Custom wave is type = “custom”
function createOscillator(audioContext, waveType, frequency, connectTo) {
	var oscillator = audioContext.createOscillator();
	oscillator.type = waveType; // Tell the oscillator to use a square wave
	oscillator.frequency.value = frequency; // in hertz
	
	OSCILLATORS.push(oscillator);

	return oscillator;
}


function connectOscillator(from, to) {
	from.connect(to);
}

function playSound() {
	var audio = new Audio(); // create the HTML5 audio element
	var riffwave = new RIFFWAVE(); // create an empty wave file
	riffwave.header.sampleRate = SAMPLE_RATE;
	riffwave.header.numChannels = 2; // two channels (stereo)
	riffwave.Make(AUDIO_BITS); // make the wave file
	audio.src = riffwave.dataURI; // set audio source
	audio.play(); // we should hear two tones one on each speaker	
	
/*
	for(var i = 0; i < OSCILLATORS.length; i ++) {
		var oscillator = OSCILLATORS[i];
		oscillator.start(0); // Start generating sound immediately
	}
	*/
}


function stopSound() {
	for(var i = 0; i < OSCILLATORS.length; i ++) {
		var oscillator = OSCILLATORS[i];
		oscillator.stop(0); // Stop generating sound immediately
	}
}