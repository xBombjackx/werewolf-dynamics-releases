# How we know the modules are accurate

Every Werewolf Dynamics module claims to model a real piece of hardware.
That claim is easy to make and hard to prove. This document explains how we
prove it: what "accurate" means here, how it gets measured, and what happens
when a measurement disagrees with us.

In short, the original manufacturers published concrete numbers: distortion
at a stated level, frequency response within a stated window, attack times,
knee shapes, and noise floors. Together, those numbers form the hardware's
fingerprint. We put every module on a virtual test bench, run the same
measurements, and check that our numbers land on theirs. The bench is code.
It runs on every build. If a future change drifts a module away from its
fingerprint, the build fails.

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
we hold ourselves to. The full citation list — every paper, manual, and
method, with what each was used for — is [BIBLIOGRAPHY.md](BIBLIOGRAPHY.md).

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

The test suite contains 79 automated test suites. They compile with the
plugins, run in minutes, and every one must pass before any change ships.
Among the things they measure, with the published number beside each gate:

- WD Opto's shipped defaults measure 0.485% distortion at the mapped
  +10 dBm point. The class sheet says under 0.5%. The gate fails if a
  change pushes it over.
- WD Mu measures -0.50 dB at 20 Hz against the 670's published 1 dB window,
  and its third-harmonic character lands within 1 dB of the paper's
  measured value at the paper's own test point.
- WD Tec's line amps each measure the published "-3 dB at 10 Hz" corner and
  the 0.15% / second-harmonic-dominant profile. Full-scale 50 Hz lands in
  the 1-2% maximum-output class, exactly where the hardware saturates.
- WD FET holds the 1176's 1 dB window at both band edges, sits at 0.048%
  where the LN promise says under 0.5%, and its push-pull output stage
  measurably cancels even harmonics against the class-A stage. That last
  behavior comes directly from the rev F output-stage topology, verified
  mathematically.
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

The measurements follow the same discipline a physical test bench uses.
Distortion is measured with windowed Goertzel analysis at stated levels
and frequencies, never one convenient point: level-by-frequency sweeps,
because a model can pass a single point and be wrong everywhere else.
Aliasing is probed with high fundamentals (13-17 kHz), because fold
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
- WD Tec's tubes were being fed digital sample values as if they were
  volts, which ran them 19 dB colder than the hardware. The famous Pultec
  pass-through glow was unreachable from the front panel. Fixed by
  declaring the level map: 0 dBFS is 8 volts peak at the module plane.
- The tape machine's bias oscillator sat at 48 kHz where real electronics
  run above 100 kHz, which put its intermodulation products inside the
  audio band. A user's bug report caught it; the bench now gates it.

We publish the failures on purpose. A test process that never finds
anything is not a test process. Each of these produced a permanent gate,
so the same mistake cannot ship twice. The audit also exposed a recurring
bug: out of eleven modules, seven had a filter corner placed at its spec
frequency instead of below it. That check now runs against every new
module at build time.

## The aliasing census

In August 2026 we measured aliasing across all seventeen instrumented
modules (15 nominal defaults are listed below; WD Annihilator and WD Brigade
are documented separately in [ALIASING_CENSUS_2026-08-24.md](ALIASING_CENSUS_2026-08-24.md))
because the question kept coming up and the honest answer is a table, not
a policy. Method: a sine parked just under 12 kHz — chosen because at
44.1 kHz every distortion product of that tone folds, making it the worst
probe there is — at 0 VU nominal level (−18 dBFS), at each module's
default settings. Numbers are total folded-product power against the
fundamental; more negative is cleaner. For reference, −80 dBc is far
below anything audible in program material.

| module | aliasing at nominal, defaults |
|---|---|
| WD XQ (Precision model) | −131 dBc (bit-exact wire) |
| WD Span | −131 dBc |
| WD Spring | −126 dBc |
| WD VCA | −112 dBc |
| WD Pre | −110 dBc |
| WD Opto | −109 dBc |
| WD Strip | −106 dBc |
| WD AX | −102 dBc |
| WD 361 | −100 dBc |
| WD Tape | −98 dBc |
| WD Duress | −93 dBc |
| WD Mu | −87 dBc |
| WD Tec | −87 dBc |
| WD FET | −80 dBc |
| WD Summer Channel | −86 dBc (was −64 until 2026-09-01) |

Two findings from the census, documented openly:

- **WD Summer Channel ran without the oversampling wrap** the other
  nonlinear modules carry, and its −64 dBc — while still quiet — was
  25 dB behind its neighbors, with the energy confirmed on the exact
  folded-harmonic positions. The wrap was built and measured (−85 dBc),
  but it also costs 1.8× on a module designed to sit on forty tracks at
  once — a budget that is itself a tested contract here. **Decided
  2026-09-01: the oversampling wrapper runs on every instance.** The
  default settings now measure −85.9 dBc (H2′; H3′ −98.3) on the census
  probe and are gated at the −80 suite bar like every other module. The
  price is real and published: ~52–58 instances per core instead of ~101
  (MSVC Release, measured on the reference test machine) — about 2% of a
  core per instance, gated at >40 — so forty tracks of it is roughly
  5–10% of a modern 8-core. Latency is still zero (the wrap is IIR both
  ways).
- **WD FET's detector is sample-bound at its fastest attack**: gain
  reduction varies by half a decibel with nothing but the sample-grid
  phase of the input, because a microsecond attack outruns a 23 µs
  sampling grid. Running the detector at a higher internal rate addresses
  this behavior, using these August 2026 measurements as the baseline.

Turn a module's drive to its maximum end stop and the numbers get
dramatically worse on this probe. Those upper limits intentionally extend
past the normal musical range, every distortion product of a 12 kHz tone
folds by construction, and a probe tone is not music. The defaults are the
claim; the census is how we check it stays true.

## Honesty rules

Accuracy needs rules for the places where we deviate, because every model
deviates somewhere. Ours are:

- **Defaults match serviced hardware.** The shipped default settings measure
  like serviced hardware. Character beyond the hardware is opt-in, never the
  default.
- **Three regimes per knob.** At the calibrated detent, a control matches a
  well-serviced hardware unit. Mid-travel reflects believable service drift,
  while the end stop goes beyond normal studio limits so the circuit's
  behavior is clear. The end stop is allowed to exceed the sheet; the
  detent is not.
- **Deviations get written down.** WD Tec combines two stacked units in one
  plugin, so its distortion and tube stages reflect both sections together,
  and its anchors document records this. WD Mu's Broadcast mode intentionally
  runs at about 2% THD where the reference manual specifies 1% to provide
  extra harmonic character; lowering the rear Iron trim to half restores the
  1% spec, as noted in the anchors. XQ's line stage is a deliberate
  abstraction, not a component model, and its documentation says exactly
  that.
- **A measured artifact gets bounded, not hidden.** A VCA compressor
  tracking a 50 Hz cycle produces control-voltage ripple. Real ones do
  too. We measure it, confirm the harmonic profile matches the physics,
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
