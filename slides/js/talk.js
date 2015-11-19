var _AudioContext = window.AudioContext.prototype.constructor;
var AudioContext = AudioContextPatch;

function AudioContextPatch() {
  if (window.ac) {
    window.ac.ctx.close();
    window.ac = null;
  }
  this.ctx = new _AudioContext;
  this.destination = this.ctx.createAnalyser();
  this.destination.connect(this.ctx.destination);
  window.ac = this;
  this.domElements = [];
  return this;
}

AudioContextPatch.prototype.timeScope = function(parent, mult, biquad) {
  var cvs = this.cvs = document.createElement("canvas");
  var c = this.c = cvs.getContext("2d");
  this.domElements.push(this.cvs);
  parent.appendChild(cvs);
  var rect = parent.getBoundingClientRect();
  cvs.width = rect.width;
  cvs.height = rect.height * 0.8;
  cvs.style.top = rect.top;
  cvs.style.left = rect.left;
  cvs.style.zIndex = "0";
  cvs.style.opacity = 1.0;
  // cvs.style.position = "absolute";
  c.fillRect(0, 0, cvs.width, cvs.height);
  // we overshoot the required number of points for zero crossing alignment,
  // fftSize requires that it is the next power of teo
  var nextPot = Math.min(Math.pow(2, Math.round(Math.log2(cvs.width * mult)) + 2), 32768);
  console.log("nextpot", nextPot)
  this.destination.fftSize = nextPot;
  this.destination.smoothingTimeConstant = 0.1
  this.timeDomainData = new Float32Array(this.destination.frequencyBinCount);
  // number of milliseconds
  var ms = Math.round((cvs.width / this.destination.context.sampleRate) * 1000) * mult;
  this.rAF = function() {
    if (this.stop) {
      window.ac = null;
      return;
    }
    c.clearRect(0, 0, cvs.width, cvs.height);

    c.fillStyle = "rgba(255, 255, 255, 0.3)";
    c.fillRect(0, 0, cvs.width, cvs.height);
    c.lineWidth = 1;
    c.moveTo(0, cvs.height / 2);
    c.lineTo(cvs.width, cvs.height / 2);
    c.lineJoin = "round";
    c.stroke();
    c.moveTo(1, cvs.height);
    c.lineTo(1, 0);
    c.stroke();

    c.fillStyle = "rgba(0, 0, 0, 0.4)";
    c.font = "24px sans";
    c.fillText("+1.0", cvs.width / 40, cvs.height / 20);
    c.fillText("-1.0", cvs.width / 40, cvs.height - cvs.height / 20);
    c.fillText(ms + "ms", cvs.width - cvs.width / 10, cvs.height / 10 + cvs.height / 2);
    this.destination.getFloatTimeDomainData(this.timeDomainData);
    c.beginPath();
    c.moveTo(0, cvs.height / 2);
    var i = 0;
    // cheap zero crossing to auto align
    while(!(this.timeDomainData[i] > 0 && this.timeDomainData[i+1] < 0) && i < this.timeDomainData.length) {
      i++;
    }
    var incr = 1;
    var offset = 0;
    c.lineWidth = 2;
    for (; offset < cvs.width; i+=mult, offset++) {
      c.lineTo(offset * incr, ((this.timeDomainData[i] + 1) / 2) * cvs.height);
    }
    c.stroke();

    requestAnimationFrame(this.rAF.bind(this));
  }
  this.rAF();
}

AudioContextPatch.prototype.freqScope = function(parent, biquad) {
  var cvs = this.cvs = document.createElement("canvas");
  var c = this.c = cvs.getContext("2d");
  this.domElements.push(this.cvs);
  parent.appendChild(cvs);
  var rect = parent.getBoundingClientRect();
  cvs.width = rect.width;
  cvs.height = rect.height;
  cvs.style.top = rect.top;
  cvs.style.left = rect.left;
  cvs.style.zIndex = "0";
  cvs.style.opacity = 1.0;
  this.freqDomainData = new Float32Array(this.destination.frequencyBinCount);
  this.destination.smoothingTimeConstant = 0.3;
  this.rAF = function() {
    if (this.stop) {
      window.ac = null;
      return;
    }

    c.clearRect(0, 0, cvs.width, cvs.height);

    c.strokeStyle = "#000";
    c.fillStyle = "rgba(0, 0, 0, 1)";
    var o = cvs.width / 20;
    c.font = "14px sans";
    c.fillText("-100dB", 0, cvs.height - o);
    c.fillText("0dB", 0, o);
    c.fillText("0Hz", o, cvs.height - 0.5 * o);
    c.fillText("20000Hz", cvs.width - cvs.width / 10, cvs.height - 0.5 * o);
    c.moveTo(o, cvs.height - o);
    c.lineTo(cvs.width, cvs.height - o);
    c.stroke();
    c.moveTo(o, o);
    c.lineTo(o, cvs.height - o);
    c.stroke();
    this.destination.getFloatFrequencyData(this.freqDomainData);
    var minDecibels = -this.destination.minDecibels;
    var range = -this.destination.minDecibels + this.destination.maxDecibels;
    for (var i = 0; i < cvs.width; i+=2) {
      c.fillRect(o + i,
                 cvs.height - o,
                 0.8,
                 Math.min(-((this.freqDomainData[i] + minDecibels) / range) * (cvs.height - 4 * o), 0));
    }
    if (biquad) {
      if (!this.freqResp) {
        this.freqs = new Float32Array(cvs.width);
        this.freqResp = new Float32Array(cvs.width);
        this.phase = new Float32Array(cvs.width);
        for (var i = 0 ; i < this.freqs.length; i++) {
          this.freqs[i] = (i - 1) * this.ctx.sampleRate / this.destination.fftSize;
        }
      }
      c.strokeStyle = "#f00";
      biquad.getFrequencyResponse(this.freqs, this.freqResp, this.phase);
      c.moveTo(o, this.freqResp[0]);
      c.beginPath();
      for (var i = 0; i < this.freqs.length; i+=2) {
        var db = 20.0 * Math.log(this.freqResp[i]) / Math.LN10
        var y = Math.min((0.5 * cvs.height) - 4 * db, cvs.height - o);
        c.lineTo(i + o, y);
      }
      c.stroke();
    }
    requestAnimationFrame(this.rAF.bind(this));
  }
  this.rAF();
}

function simpleSine(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }
  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  var osc = ac.ctx.createOscillator();
  var gain = ac.ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 440.; // A4
  osc.connect(gain);
  gain.connect(ac.destination)
  osc.start();
  ac.timeScope(parent, mult);
  var input = document.createElement("input");
  input.type = "range";
  input.style.marginTop = "2em";
  input.min = 20;
  input.className = "fader";
  input.max = 10000;
  input.step = 1;
  input.width = 100;
  input.value = 440;
  input.oninput = (e) => osc.frequency.value = e.target.value
  var input2 = document.createElement("input");
  input2.type = "range";
  input2.className = "fader";
  input2.min = 0;
  input2.max = 1;
  input2.step = 0.01;
  input2.width = 100;
  input2.oninput = (e) => gain.gain.value = e.target.value;

  var controls = document.createElement("div");
  controls.className = "controlss";

  controls.appendChild(input);
  controls.appendChild(input2);

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
  parent.appendChild(controls);
  window.ac.domElements.push(input);
  window.ac.domElements.push(input2);
  window.ac.domElements.push(controls);

  var sel = document.createElement("select");

  ["sine", "square", "triangle", "sawtooth"].forEach(function(e) {
    var i = document.createElement("option");
    i.type = "radio";
    i.className="fader";
    i.innerHTML = e;
    i.name = "wave";
    i.value = e;
    window.ac.domElements.push(i);
    sel.appendChild(i);
  });

  sel.onchange = (e) => osc.type = e.target.value;

  controls.appendChild(sel);
  window.ac.domElements.push(sel);
}

function gainDecay(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }

  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  ac.timeScope(parent, mult);

  var osc = ac.ctx.createOscillator();
  osc.frequency.value = 50;

  var gain = ac.ctx.createGain();
  osc.connect(gain);
  gain.connect(ac.destination)

  osc.start();

  function kick() {
    gain.gain.setValueAtTime(1.0, ac.ctx.currentTime + 0.1);
    gain.gain.setTargetAtTime(0.0, ac.ctx.currentTime + 0.1, 0.5);
  }

  setInterval(kick, 1000);
  kick();

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
}

function fullkick(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }
  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  ac.timeScope(parent, mult);

  var osc = ac.ctx.createOscillator();
  var gain = ac.ctx.createGain();

  osc.connect(gain);
  gain.connect(ac.destination)

  gain.gain.setValueAtTime(0.0, 0.0);
  osc.frequency.setValueAtTime(0.0, 0.0);

  osc.start();


  function kick() {
    gain.gain.setValueAtTime(1.0,  ac.ctx.currentTime + 0.3);
    gain.gain.setTargetAtTime(0.0, ac.ctx.currentTime + 0.3, 0.12);

    osc.frequency.setValueAtTime(140.0, ac.ctx.currentTime + 0.3);
    osc.frequency.setTargetAtTime(45.0, ac.ctx.currentTime + 0.3, 0.07);
  }

  setInterval(kick, 500);
  kick();
}

function frequency(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }
  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  var osc = ac.ctx.createOscillator();
  var gain = ac.ctx.createGain();
  gain.gain.value = 0.1;
  osc.type = "sine";
  osc.frequency.value = 440.; // A4
  osc.connect(gain);
  gain.connect(ac.destination)
  osc.start();
  ac.freqScope(parent);
  var input = document.createElement("input");
  input.type = "range";
  input.style.marginTop = "2em";
  input.min = 20;
  input.className = "fader";
  input.max = 10000;
  input.step = 1;
  input.width = 100;
  input.value = 440;
  input.oninput = (e) => osc.frequency.value = e.target.value
  var input2 = document.createElement("input");
  input2.type = "range";
  input2.className = "fader";
  input2.min = 0;
  input2.max = 1;
  input2.step = 0.01;
  input2.width = 100;
  input2.value = 0.1;
  input2.oninput = (e) => gain.gain.value = e.target.value;

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
  var controls = document.createElement("div");
  controls.className = "controlss";
  controls.appendChild(input);
  controls.appendChild(input2);
  parent.appendChild(controls);
  window.ac.domElements.push(input);
  window.ac.domElements.push(input2);
  window.ac.domElements.push(controls);

  var sel = document.createElement("select");

  ["sine", "square", "triangle", "sawtooth"].forEach(function(e) {
    var i = document.createElement("option");
    i.type = "radio";
    i.className="fader";
    i.innerHTML = e;
    i.name = "wave";
    i.value = e;
    window.ac.domElements.push(i);
    sel.appendChild(i);
  });

  sel.value = "sine";

  sel.onchange = (e) => osc.type = e.target.value;

  controls.appendChild(sel);
  window.ac.domElements.push(sel);
}

function detune(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }

  mult = 10;

  var parent = document.querySelector(sel);
  var ac = new AudioContext;

  var osc1 = ac.ctx.createOscillator();
  var osc2 = ac.ctx.createOscillator();

  var gain = ac.ctx.createGain();
  gain.gain.value = 0.3;

  osc1.type = "sawtooth";
  osc2.type = "sawtooth";
  osc1.frequency.value = osc2.frequency.value = 80;

  osc1.connect(gain);
  osc2.connect(gain);

  gain.connect(ac.destination);

  osc1.start();
  osc2.start();

  ac.timeScope(parent, mult);

  var input = document.createElement("input");
  input.type = "range";
  input.min = 0;
  input.className = "fader";
  input.max = 50;
  input.step = 0.1;
  input.width = 100;
  input.value = 440;
  input.style.marginTop = "3em";
  input.oninput = (e) => osc2.detune.value = e.target.value
  var input2 = document.createElement("input");
  input2.type = "range";
  input2.className = "fader";
  input2.min = 0;
  input2.max = 250;
  input2.step = 1;
  input2.width = 100;
  input2.oninput = (e) => osc1.frequency.value = osc2.frequency.value = e.target.value;

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
  var controls = document.createElement("div");
  controls.className = "controlss";

  controls.appendChild(input);
  controls.appendChild(input2);
  parent.appendChild(controls);
  window.ac.domElements.push(input);
  window.ac.domElements.push(input2);
  window.ac.domElements.push(controls);

  controls.appendChild(sel);
  window.ac.domElements.push(sel);
}

function filtering(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }

  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  var osc = ac.ctx.createOscillator();
  var osc2 = ac.ctx.createOscillator();
  var gain = ac.ctx.createGain();
  var biquad = ac.ctx.createBiquadFilter();
  osc.type = osc2.type = "sawtooth";
  osc.frequency.value = osc2.frequency.value = 55.;

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(biquad);
  biquad.connect(ac.destination);

  osc2.detune.value = 60;

  osc.start();
  osc2.start();
  ac.freqScope(parent, biquad);
  var input = document.createElement("input");
  input.type = "range";
  input.style.marginTop = "2em";
  input.min = 0;
  input.className = "fader";
  input.max = 10000;
  input.step = 1;
  input.value = 10000;
  input.width = 100;
  input.value = 440;
  input.oninput = (e) => biquad.frequency.value = e.target.value
  var input2 = document.createElement("input");
  input2.type = "range";
  input2.className = "fader";
  input2.min = -40;
  input2.max = 40;
  input2.value = 0;
  input2.step = 0.01;
  input2.width = 100;
  input2.oninput = (e) => biquad.gain.value = e.target.value;
  var input3 = document.createElement("input");
  input3.type = "range";
  input3.className = "fader";
  input3.min = 0;
  input3.value = 0;
  input3.max = 40;
  input3.step = 0.01;
  input3.width = 100;
  input3.oninput = (e) => biquad.Q.value = e.target.value;

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
  var controls = document.createElement("div");
  controls.className = "controlss";

  controls.appendChild(input);
  controls.appendChild(input2);
  controls.appendChild(input3);
  parent.appendChild(controls);
  window.ac.domElements.push(input);
  window.ac.domElements.push(input2);
  window.ac.domElements.push(input3);
  window.ac.domElements.push(controls);

  var sel = document.createElement("select");

  ["lowpass", "highpass", "bandpass", "peaking"].forEach(function(e) {
    var i = document.createElement("option");
    i.type = "radio";
    i.className="fader";
    i.innerHTML = e;
    i.name = "wave";
    i.value = e;
    window.ac.domElements.push(i);
    sel.appendChild(i);
  });

  sel.value = "lowpass";

  sel.onchange = (e) => biquad.type = e.target.value;

  controls.appendChild(sel);
  window.ac.domElements.push(sel);
}

function noise(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }
  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  ac.timeScope(parent, mult);
  var gain = ac.ctx.createGain();
  gain.gain.value = 0.3;

  var source = ac.ctx.createBufferSource();
  var buffer = ac.ctx.createBuffer(1, 1 * ac.ctx.sampleRate, ac.ctx.sampleRate);
  var channel = buffer.getChannelData(0);

  for (var i = 0; i < channel.length; i++) {
    channel[i] = Math.random() * 2 - 1; /* [-1, 1] */
  }

  source.loop = true;
  source.buffer = buffer;
  source.connect(gain)
  gain.connect(ac.destination);
  source.start();

  var parent = document.querySelector(sel);

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
}

function clap(sel, mult) {
  if (window.ac) {
    window.ac.domElements.forEach(function(e) { e.remove() });
    window.ac.ctx.close();
    window.ac.stop = true;
    return;
  }
  var parent = document.querySelector(sel);
  var ac = new AudioContext;
  ac.timeScope(parent, mult);

  var parent = document.querySelector(sel);

  var xhr = new XMLHttpRequest();
  xhr.responseType = "arraybuffer";
  xhr.onload = function() {
      ac.ctx.decodeAudioData(xhr.response, function(buffer) {
        var source = ac.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(ac.destination);
        source.start();
      });
  }
  xhr.open("GET", "/clap.wav");
  xhr.send(null);

  // Fx bug
  // document.querySelector(".present").style.opacity = "0.5";
}

setInterval(() => document.querySelector("body").style.backgroundColor = "white", 106);

