# How we know the modules are accurate

Every Werewolf Dynamics module claims to model a real piece of hardware.
That claim is easy to make and hard to prove. This document explains how we
prove it: what "accurate" means here, how it gets measured, and what happens
when a measurement disagrees with us.

The short version: the original manufacturers published numbers. Distortion
at a stated level. Frequency response within a stated window. Attack times,
knee shapes, noise floors. Those numbers are the hardware's fingerprint.
We put every module on a virtual test bench, run the same measurements, and
check that our numbers land on theirs. The bench is code. It runs on every
build. If a future change drifts a module away from its fingerprint, the
build fails.

## Where the reference numbers come from

Three kinds of sources, in order of authority:

1. **Manufacturer spec sheets and service manuals.** The Teletronix LA-2A
   class sheet says less than 0.5% distortion at +10 dBm. The Fairchild 670
   manual says 20 Hz to 15 kHz within 1 dB and under 1% distortion at 0 to
   30 dB of limiting. The Pultec EQP-1A manual says 0.15% at +10 dBm with
   the second harmonic dominant, and its output transformer measures -3 dB
   at 10 Hz. The UREI 1176 sheet says 20 Hz to 20 kHz within 1 dB, under
   0.5% distortion with the LN circuit. These are the primary anchors.
2. **Published research.** Several cores are built directly from
   peer-reviewed papers: the tape machine from the DAFx magnetic-recording
   literature (Jiles-Atherton hysteresis, bias recording), the Fairchild
   from Raffensperger's DAFx-12 circuit analysis, the Pultec network from
   Barrera, Lizarraga-Seijas and Font (SMC 2024), fitted against
   measurements of a 2019 reissue. Where a paper publishes a curve, our
   model is calibrated to reproduce that curve.
3. **Schematics and bench folklore.** The 1176's ratio network is read
   directly off the 1973 UREI drawing, resistor by resistor. The FET
   linearization trick that makes it "low noise" is the exact
   resistor-divider feedback published in the Siliconix FET application
   note. Where magazine bench tests of real units exist, they set the
   plausible range for behavior the sheets don't cover.

Every module has an anchors document in this folder (TAPE_ANCHORS.md,
VARIMU_ANCHORS.md, and so on) that lists its sources and the exact numbers
we hold ourselves to.

## Physics first, then measurement

The modules are physical models, not effect recipes. The compression in
WD Mu is not a gain curve somebody drew: it is the anode current law of a
6386 remote-cutoff triode, solved against the real plate load, with the
sidechain rectifier dragging the grid bias exactly as the 670's circuit
does. The tape machine records through a hysteresis loop with a real
ultrasonic bias oscillator. The Pultec filters are the actual passive RLC
networks solved by nodal analysis, component values from the schematic.

Why does that matter for accuracy? Because a physical model gets the
behavior BETWEEN the published data points right for free. A curve fit hits
the three numbers on the sheet and guesses everywhere else. A circuit model
that hits the three numbers usually hits the rest because the same physics
produces all of it: the distortion character, how it changes with level,
what the knee does at settings nobody measured.

But physics alone proves nothing. A physical model with one wrong component
value produces confidently wrong physics. So every model faces the bench.

## The bench

The test suite contains 35 automated benches. They compile with the
plugins, run in minutes, and every one must pass before any change ships.
Among the things they measure, with the published number beside each gate:

- WD Opto's shipped defaults measure 0.485% distortion at the mapped
  +10 dBm point. The class sheet says under 0.5%. The gate fails if a
  change pushes it over.
- WD Mu measures -0.50 dB at 20 Hz against the 670's published 1 dB window,
  and its third-harmonic character lands within 1 dB of the paper's
  measured value at the paper's own test point.
- WDTec's line amps each measure the published "-3 dB at 10 Hz" corner and
  the 0.15% / second-harmonic-dominant signature. Full-scale 50 Hz lands in
  the 1-2% maximum-output class, exactly where the hardware saturates.
- WD FET holds the 1176's 1 dB window at both band edges, sits at 0.048%
  where the LN promise says under 0.5%, and its push-pull output stage
  measurably cancels even harmonics against the class-A stage. That last
  one is the rev F circuit story, verified as arithmetic.
- WD Tape's head bump sits centered in the published 40-60 Hz region at
  15 ips, moves up an octave when the speed doubles, and its worst in-band
  aliasing product on hot high-frequency program measures -53 dB, gated at
  the frequency where aliasing actually hides.
- WD Duress passes signal at 1:1 with exactly 0.00 dB of gain reduction,
  because the Distressor manual says 1:1 does not compress. Its distortion
  modes sit inside the published 0.02%-20% range at real levels.

There are hundreds more gates like these: wow and flutter inside rated
hardware classes, noise floors that scale with tape speed, erase ghosts at
spec depth, VCA transparency at 0.0002%, response curves held to half a
decibel against published tables.

Under the hood, the measurements use the same discipline a hardware bench
would. Distortion is measured with windowed Goertzel analysis at stated
levels and frequencies, never one convenient point: level-by-frequency
sweeps, because a model can pass a single point and be wrong everywhere
else. Aliasing is probed with high fundamentals (13-17 kHz), because fold
products from low test tones land on top of real harmonics and hide.
Response is measured at two sample rates and must agree, so nothing depends
on the host's clock.

## The fingerprint audit

In July 2026 we ran every module through a formal audit against its sheets:
eleven modules, every published number we could locate. The audit is public
in FINGERPRINT_AUDIT.md, including what it found. It found real problems:

- The 73 preamp's low-frequency transformer distortion measured 47 times
  the published spec. The transformer's corner frequencies had been placed
  an octave too high. Fixed, and the fix made the published numbers land
  without refitting anything else.
- The Fairchild model was -5.5 dB at 20 Hz against a sheet that says
  within 1 dB. Two filter corners were parked at the spec frequency
  instead of below it. Fixed; the bottom octave is real now.
- WDTec's tubes were being fed digital sample values as if they were
  volts, which ran them 19 dB colder than the hardware. The famous Pultec
  pass-through glow was unreachable from the front panel. Fixed by
  declaring the level map: 0 dBFS is 8 volts peak at the module plane.
- The tape machine's bias oscillator sat at 48 kHz where real electronics
  run above 100 kHz, which put its intermodulation products inside the
  audio band. A user's bug report caught it; the bench now gates it.

We publish the failures on purpose. A test process that never finds
anything is not a test process. Each of these produced a permanent gate,
so the same mistake cannot ship twice. The audit also named the recurring
disease: of eleven modules, seven had a filter corner placed at its spec
frequency instead of below it. That check now runs against every new
module at build time.

## Honesty rules

Accuracy needs rules for the places where we deviate, because every model
deviates somewhere. Ours are:

- **Honest by default.** The shipped default settings measure like serviced
  hardware. Character beyond the hardware is opt-in, never the default.
- **Three regimes per knob.** At the calibrated detent a control is the
  honest unit. Mid-travel is believable service drift. The end stop is
  deliberately past realism, so the mechanism is unmistakable. The stop is
  allowed to exceed the sheet; the detent is not.
- **Deviations get written down.** WDTec is honestly a stack of two units,
  so its numbers read double the single-unit sheet, and the anchors say so.
  WD Mu's Broadcast mode deliberately runs about 2% where its donor's
  sheet says 1%, because the sound lives past the sheet; the rear trim at
  half returns you to the sheet number, and the anchors say so. XQ's line
  stage is a deliberate abstraction, not a component model, and its
  documentation says exactly that.
- **A measured artifact gets bounded, not hidden.** A VCA compressor
  tracking a 50 Hz cycle produces control-voltage ripple. Real ones do
  too. We measure it, confirm the harmonic signature matches the physics,
  and gate it inside a bound rather than smoothing it away.

## What we do not claim

No plugin is the hardware. Real units vary between serials (we model that
spread deliberately, as the Unit control, with the reference serial as the
calibrated one). Some behaviors are documented abstractions rather than
component models, and the anchors documents mark every one. Where a
manufacturer published no number, we say "class behavior" and cite the
measurements of real units we calibrated against, not the sheet.

What we do claim: every number a manufacturer printed about the hardware
we model has been located, measured against, and either matched, bounded,
or documented as a deliberate difference. And the bench that proves it
runs on every single build.
