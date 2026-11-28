(() => {
  'use strict';

  let wasPlaying = false;

  window.__WD_PLUGIN_SPEC__ = {
    slug: 'gate',
    title: 'Werewolf Digital Gate',
    defaultStem: 'Drums',
    needsStereoAnalysers: false,

    presets: [
      {
        name: 'Tight Snare Gate',
        values: { threshold: -26.0, range: -36.0, attack: 0.5, release: 90.0 },
      },
      {
        name: 'Vocal Breath Trim',
        values: { threshold: -42.0, range: -10.0, attack: 6.0, release: 180.0 },
      },
    ],

    params: [
      { id: 'threshold',  kind: 'slider', min: -80.0,  max: 0.0,     def: -20.0 },
      { id: 'ratio',      kind: 'slider', min: 1.0,    max: 100.0,   center: 4.0,   def: 100.0 },
      { id: 'range',      kind: 'slider', min: -90.0,  max: 0.0,     def: -90.0 },
      { id: 'attack',     kind: 'slider', min: 0.02,   max: 50.0,    center: 2.0,   def: 1.0 },
      { id: 'hold',       kind: 'slider', min: 0.0,    max: 500.0,   def: 50.0 },
      { id: 'release',    kind: 'slider', min: 5.0,    max: 2000.0,  center: 100.0, def: 100.0 },
      { id: 'hysteresis', kind: 'slider', min: 0.0,    max: 12.0,    def: 0.0 },
      { id: 'lookahead',  kind: 'slider', min: 0.0,    max: 5.0,     def: 0.0 },
      { id: 'detector',   kind: 'slider', min: 0.0,    max: 100.0,   def: 30.0 },
      { id: 'scHp',       kind: 'slider', min: 20.0,   max: 500.0,   center: 80.0,  def: 20.0 },
      { id: 'scLp',       kind: 'slider', min: 1000.0, max: 20000.0, center: 5000.0, def: 20000.0 },
      { id: 'link',       kind: 'slider', min: 0.0,    max: 100.0,   def: 100.0 },
      { id: 'delta',      kind: 'toggle', def: false },
      { id: 'power',      kind: 'toggle', def: true },
      { id: 'scsource',   kind: 'combo',  choices: ['Internal', 'External'], def: 0 },
      { id: 'mode',       kind: 'combo',  choices: ['Gate', 'Duck'], def: 0 },
      { id: 'sclisten',   kind: 'toggle', def: false },
    ],

    onFrame: hostCtx => {
      const playing = !!(hostCtx.audio && hostCtx.audio.playing);
      const m = hostCtx.latestWasmMeters || [];

      if (playing && m.length >= 8) {
        wasPlaying = true;
        hostCtx.emit('meters', {
          grL: m[0],
          grR: m[1],
          inL: m[2],
          inR: m[3],
          outL: m[4],
          outR: m[5],
          detectorL: m[6],
          detectorR: m[7],
          sc: -120,
        });
      } else if (wasPlaying) {
        wasPlaying = false;
        hostCtx.emit('meters', {
          grL: 0, grR: 0,
          inL: -120, inR: -120,
          outL: -120, outR: -120,
          detectorL: -120, detectorR: -120,
          sc: -120,
        });
      }
    },
  };
})();
