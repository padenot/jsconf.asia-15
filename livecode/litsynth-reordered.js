var ac = new AudioContext();

var track = {
  tempo: 135,
  tracks: {
    Kick: [ 1,0,0,0,
            1,0,0,0,
            1,0,0,0,
            1,0,0,0,
            1,0,0,0,
            1,0,0,0,
            1,0,0,0,
            1,0,1,0]
  }
}

function S(ac, track) {
   this.ac = ac;
   this.track = track;
   this.sink = ac.destination;
}

S.prototype.clock = function() {
  var beatLen = 60 / this.track.tempo;
  return (this.ac.currentTime  - this.startTime) / beatLen;
}

S.prototype.start = function() {
  this.startTime = this.ac.currentTime;
  this.nextScheduling = 0;
  this.scheduler();
}

S.prototype.scheduler = function() {
  var beatLen = 60 / this.track.tempo;

  var lookahead = 0.5;

  if (this.clock() + lookahead > this.nextScheduling) {

    var steps = [];
    for (var i = 0; i < 4; i++) {
      steps.push(this.nextScheduling + i * beatLen / 4);
    }

    for (var i in this.track.tracks) {
      for (var j = 0; j < steps.length; j++) {
        var idx = Math.round(steps[j] / ((beatLen / 4)));

        var note = this.track.tracks[i][idx % this.track.tracks[i].length];
        if (note != 0) {
          this[i](steps[j], note);
        }
      }
    }

    this.nextScheduling += (60 / this.track.tempo);
  }

  setTimeout(this.scheduler.bind(this), 100);
}

var s = new S(ac, clap, track);
s.start();

/// KICKKICKKICK

S.prototype.Kick = function(t) {
  var o = this.ac.createOscillator();

  var g = this.ac.createGain();
  var g2 = this.ac.createGain();

  var o2 = this.ac.createOscillator();
  o2.type = "square";
  o2.frequency.value = 40;

  o.connect(g);
  o2.connect(g2);
  g2.connect(this.sink);
  g.connect(this.sink);

  g.gain.setValueAtTime(1.0, t);
  g2.gain.setValueAtTime(1.0, t);

  g.gain.setTargetAtTime(0.0, t, 0.10);
  g2.gain.setTargetAtTime(0.0, t, 0.01);

  o.frequency.setValueAtTime(140.0, t);
  o.frequency.setTargetAtTime(50.0, t, 0.10);

  o.start(t);
  o.stop(t + 1);
  o2.start(t);
  o2.stop(t + 1);
}

/// HATS HATS HATS

S.prototype.NoiseBuffer = function() {
  if (!S._NoiseBuffer) {
    S._NoiseBuffer = this.ac.createBuffer(1, this.ac.sampleRate / 10, this.ac.sampleRate);
    var cd = S._NoiseBuffer.getChannelData(0);
    for (var i = 0; i < cd.length; i++) {
      cd[i] = Math.random() * 2 - 1;
    }
  }
  return S._NoiseBuffer;
}


S.prototype.Hats = function(t) {
  var s = this.ac.createBufferSource();
  s.buffer = this.NoiseBuffer();

  var g = this.ac.createGain();

  var hpf = this.ac.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 5000;

  g.gain.setValueAtTime(1.0, t);
  g.gain.setTargetAtTime(0.0, t, 0.02);

  s.connect(g);
  g.connect(hpf);
  hpf.connect(this.sink);

  s.start(t);
}

Hats: [ 0,0,1,0,
        0,0,1,0,
        0,0,1,0,
        0,0,1,1,
        0,0,1,0,
        0,0,1,0,
        0,0,1,0,
        0,0,1,0],

fetch('clap.ogg').then((response) => {
  response.arrayBuffer().then((arraybuffer) => {
    ac.decodeAudioData(arraybuffer).then((clap) => {
      var s = new S(ac, clap, track);
      s.start();
    });
  });
});

//// CLAP CLAP CLAP

S.prototype.Clap = function(t) {
  var gain = this.ac.createGain();
  var source = this.ac.createBufferSource();
  source.buffer = this.clap;
  gain.gain.value = 0.5;
  source.connect(gain);
  gain.connect(this.sink);
  source.start(t);
}

Clap: [ 0,0,0,0,
        0,0,1,0,
        0,0,0,0,
        0,0,1,0,
        0,0,0,0,
        0,0,1,0,
        0,0,0,0,
        0,0,1,1],

//// BASS BASS BASS BASS

S.prototype.Bass = function(t, note) {
  function note2freq(note) {
    return Math.pow(2, (note - 69) / 12) * 440;
  }

  var osc1 = this.ac.createOscillator();
  var osc2 = this.ac.createOscillator();
  var enveloppe = this.ac.createGain();
  var volume = this.ac.createGain();
  var lowpass = this.ac.createBiquadFilter();

  osc1.frequency.value = osc2.frequency.value = note2freq(note);
  osc1.type = osc2.type = "sawtooth";

  osc2.detune.value = 30;

  lowpass.type = "lowpass";
  lowpass.Q.value = 25;

  enveloppe.gain.setValueAtTime(1.0, t);
  enveloppe.gain.setTargetAtTime(0.0, t, 0.1);

  lowpass.frequency.setValueAtTime(300, t);
  lowpass.frequency.setTargetAtTime(1000, t, 0.1);

  volume.gain.value = 0.3;

  osc1.connect(enveloppe);
  osc2.connect(enveloppe);
  enveloppe.connect(lowpass);
  lowpass.connect(volume);
  volume.connect(this.sink);

  osc1.start(t);
  osc1.stop(t + 1);
  osc2.start(t);
  osc2.stop(t + 1);
}

Bass: [ 36, 0,38,36,
        36,38,41, 0,
        36,60,36, 0,
        39, 0,48, 0,
        36, 0,24,60,
        40,40,24,24,
        36,60,36, 0,
        39, 0,48, 0 ]

//// REVERB

function reverbBuffer(ac) {
  var len = 0.5 * ac.sampleRate,
      decay = 0.9;
  var buf = ac.createBuffer(2, len, ac.sampleRate);
  for (var c = 0; c < 2; c++) {
    var channelData = buf.getChannelData(c);
    for (var i = 0; i < channelData.length; i++) {
       channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function S(ac, clap, track) {
   this.ac = ac;
   this.track = track;
   this.clap = clap;

   this.rev = ac.createConvolver();
   this.rev.buffer = reverbBuffer(ac);
   this.sink = ac.createGain();
   this.sink.connect(this.rev);
   this.rev.connect(ac.destination);

   this.sink.connect(ac.destination);
}

