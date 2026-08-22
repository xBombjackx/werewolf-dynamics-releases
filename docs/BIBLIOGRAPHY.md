# Bibliography — the research under the suite

Companion to [ACCURACY.md](ACCURACY.md). That document explains how the
modules are proven; this one lists what they are built from. Three kinds of
sources: peer-reviewed papers the cores implement, manufacturer documents
that anchor the calibration, and standard methods that need no single
citation. Where we hold a copy, the file is named under `docs/references/`.

Per-module anchor documents (`*_ANCHORS.md` in this folder) list the exact
numbers each bench gates against.

## Published research the cores implement

**Opto gain cell (the T4B class — WD Opto, WD Duress opto path)**

- J. Najnudel, R. Müller, T. Hélie, D. Roze, "Power-Balanced Dynamic
  Modeling of Vactrols", *Proc. DAFx-23*, Copenhagen, 2023.
  (`najnudel2023_vactrol.pdf`) — the two-carrier photoconductor core. Our
  cell extends it with a third, deep-trap state to capture the T4's
  program-dependent minutes-long memory.
- A. Iverson, A. Smith (1987) — the full trap-spectrum photoconductor model
  that Najnudel et al. homogenize; our deep-trap extension is a one-level
  approximation of its trap-depth spectrum.
- C. Darabundit et al., "Digital Grey Box Model of the Uni-Vibe Effects
  Pedal", *Proc. DAFx-19*, Birmingham, 2019.
  (`darabundit2019_univibe.pdf`) — measured CdS device variation
  (±30–50 % unit to unit), the basis for the suite's UNIT scatter ranges.
- J. Parker, S. D'Angelo, "A Digital Model of the Buchla Lowpass-Gate",
  *Proc. DAFx-13*, Maynooth, 2013. (`parker2013_buchla.pdf`) — vactrol
  modeling and discretization background.
- F. Eichas, U. Zölzer, optocoupler measurement study, *SPIE*, 2016.
  (`eichas2016_opto.pdf`) — bench measurements of optocoupler dynamics.

**Vari-mu compression (the Fairchild 670 class — WD Mu)**

- P. Raffensperger, "Toward a Wave Digital Filter Model of the Fairchild
  670 Limiter", *Proc. DAFx-12*, York, 2012.
  (`Werner2012_Fairchild670_WDF.pdf`) — the circuit analysis our stage is
  built from: 6386 parameters from his Table 1, circuit values from his
  Fig. 5, the six-position time-constant network from his Fig. 8/Table 3.
  We do not draw a compression law; stage gain is the local slope of the
  6386 anode-current fit against the real plate load.
- GE 6386 datasheet (`GE_6386_datasheet.pdf`) — the remote-cutoff triode
  the fit targets.

**Magnetic hysteresis (tape, transformers, inductors — WD Tape, iron
stages suite-wide, WDTec's inductors)**

- D. C. Jiles, D. L. Atherton, "Theory of Ferromagnetic Hysteresis",
  *Journal of Magnetism and Magnetic Materials* 61, 1986 — the hysteresis
  model itself.
- J. Chowdhury, "Real-time Physical Modelling for Analog Tape Machines",
  *Proc. DAFx-19*, Birmingham, 2019 — the real-time Jiles-Atherton
  implementation our tape record path follows, with a real ultrasonic bias
  oscillator rather than a bias-shaped static curve.
- M. Holters, U. Zölzer, "Circuit Simulation with Inductors and
  Transformers Based on the Jiles-Atherton Model", *Proc. DAFx-16*, Brno,
  2016 — J-A inside circuit elements, the pattern our transformer and
  inductor cores use.
- In-house on top: domain dispersion — several J-A cores at spread standing
  fields, averaged, because a single loop has a reversal kink that rides
  quiet program as a distortion floor; real iron is millions of domains and
  has no single kink.

**Passive equalizer networks (the Pultec class — WDTec)**

- Barrera, Lizarraga-Seijas, Font, "Modeling the Pultec EQP-1A with Wave
  Digital Filters", *Proc. SMC 2024*. (`barrera2024_eqp1a_wdf.pdf`,
  CC-BY 3.0) — the reconstructed circuit fitted against lab measurements
  of the 2019 Pulse Techniques reissue. We take component values and
  simulation numbers as published facts; our core is an independent
  MNA/state-space implementation (their linear WDF cannot host our
  nonlinear inductor cores), so no code or data is ported.

**Tube stages (color stages, preamp laws, the FET module's output triode)**

- N. Koren, "Improved Vacuum-Tube Models for SPICE Simulations", *Glass
  Audio* 8(5), 1996 — the triode plate-current law behind the shared
  12AX7 color stage and every tube stage that borrows it.

**FET gain reduction (the 1176 class — WD FET)**

- Siliconix application note AN105, "FETs as Voltage-Controlled
  Resistors" — the drain-to-gate feedback divider that is the published
  "LN" linearization; our BLACK/BLUE revisions are the divider in and out.
- The 1973 UREI 1176 schematic — the ratio network read off the drawing
  resistor by resistor.

**Anti-aliasing of nonlinear stages**

- J. Parker, V. Zavalishin, E. Le Bivic, "Reducing the Aliasing of
  Nonlinear Waveshaping Using Continuous-Time Convolution", *Proc.
  DAFx-16*, Brno, 2016 — first-order antiderivative anti-aliasing (ADAA1),
  applied to the residual of the clip guard and of the diode/triode laws
  so the identity path stays exact.

## Manufacturer documents (calibration authority)

Spec sheets and manuals outrank papers when they disagree; the anchors
documents record each number used.

- Teletronix/UA LA-2A and LA-3A manuals (`la2a_manual.pdf`)
- Fairchild 670 manual
- UREI 1176 spec sheet + 1973 schematic
- Pultec EQP-1A / MEQ-5 manuals and circulating schematics
  (`pultec_eqp1a_schematic.gif`, `pultec_meq5_schematic.gif`)
- Empirical Labs EL8X manual (`EL8X_Distressor_Manual.pdf`)
- GE 6386 datasheet

## Standard methods used without a single citation

- Modified nodal analysis for the passive RLC networks (the `Mna` solver
  in `Source/dsp/PassiveEQ.h`), with state-space discretization.
- The Langevin function for anhysteretic magnetization (tabulated once,
  shared suite-wide).
- Semi-implicit backward Euler for the stiff opto carrier equations;
  bilinear-transform discretization for linear networks.
- Polyphase IIR half-band 2× oversampling with no integer latency
  (`Source/dsp/Oversample2x.h`), applied per module where the aliasing
  audit measured it necessary.
- ANSI VU ballistics (second-order, 2.1 Hz, ζ 0.62) for the meters.

## License hygiene

Papers are used as engineering sources: published equations, component
values, and measured curves are treated as facts. Where an author's own
implementation exists under a restrictive license (e.g. the EQP-1A study's
GPLv3 repository), nothing is copied or ported — our implementations are
independent, and the benches prove them against the published numbers
rather than against anyone's code.
