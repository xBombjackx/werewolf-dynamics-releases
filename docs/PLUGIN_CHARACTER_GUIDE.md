# Werewolf Dynamics — Plugin Character Guide

**Real-time circuit, magnetic, optical, and mechanical models across all 30 Werewolf Dynamics plugins.**

Every module in the Werewolf Dynamics suite solves its underlying electrical, magnetic, optical, or mechanical circuit as audio passes through it. Triode bias shifts under transient load, transformer cores saturate from low-frequency magnetic flux rather than raw amplitude alone, optical cells hold multi-stage carrier memory across phrases, and passive equalizers compute exact nodal impedances. Flip any faceplate around to reach the rear service panel for factory calibration trims, component tolerances, supply draw, and shared chassis settings.

All 30 modules can work together in three ways:
- **`WD Rack` Chassis Coupling:** Assign compatible modules to the same `Chassis` frame (`1`–`4`) alongside `WD Rack` on your master or submix bus to share a physical power-supply rail (causing realistic voltage sag when a neighboring unit hits hard) and adjacent-slot crosstalk. Skip `WD Rack`, and every module runs as an isolated standalone unit.
- **`WD Delta Send` & `WD Delta Return` Verification:** Bracket any plugin chain—Werewolf Dynamics or third-party—to measure exact chain latency automatically and audition loudness-matched wet, latency-aligned dry, or residual delta differences without level bias.
- **`'WBCN' v2` Beacon & Shared Sidechain Buses:** Route zero-latency cross-track key feeds between `WD Outboard`, `WD VCA`, `WD Duress`, and `WD Berth` without setting up complex DAW sidechain sends.

The 30-plugin suite is organized into three tiers (all 30 ship in v0.9.1):
1. **Core Suite (22 Plugins):** Full-release processors covering dynamics, equalizers, preamps, consoles, tape, spatial hardware, and utility routing.
2. **Preview Mode (4 Plugins):** Complete, calibrated processors included in the main distribution while visual displays and edge-case tuning continue toward 1.0.
3. **Lab / Preview (4 Plugins):** Four v0.9.1 additions that ship alongside the main distribution while final refinements wrap up.

---

## Core Suite (22 Plugins)

### WD 361

**Sonic Character & Archetype**
Derived from classic magnetic-tape noise-reduction hardware, `WD 361` is a zero-latency, four-band compander designed for running the encoding stage on its own as a dynamic brightener and low-level density builder. An orthogonal four-band filter bank splits audio below `80 Hz`, `80 Hz–3 kHz`, `3–9 kHz`, and above `9 kHz`, summing bit-identically when `Amount` is at `0%`. Instead of pushing loud peaks down like a standard compressor, encoding lifts quiet detail upward while leaving loud transients untouched—bringing upper-harmonic air, room decay, and soft articulation forward.

**Modes, Models & Controls**
- **`Mode` (`Encode` / `Decode` / `Both`):** `Encode` delivers upward low-level compression for air, breath, and presence; `Decode` applies the complementary downward expansion to push noise floors back or tighten ambience; `Both` runs an encode-into-decode round trip that preserves subtle multi-band phase and transient texture without claiming sterile null cancellation.
- **`Type` (`A` / `Broadband` / `B`):** `A` runs the full four-band peak-detected `2:1` compander; `Broadband` switches to a full-range RMS `2:1` stage (`5 ms` attack, `320 ms` release) for cohesive whole-signal density; `B` engages a sliding high-frequency pair at `1.6:1` (`90 ms` release) focused strictly on upper-mid sheen and air.
- **`Bands` (`All four` / `Low pair` / `High pair`):** Active in `Type A` (dimmed in `Broadband` and `B`) to isolate companding to the low/mid crossover pair, the upper-mid/treble pair, or all four bands together.
- **Tonal & Gain Controls:** `Drive` (`-12` to `+24 dB`) shifts how deeply the thresholds lift into quiet program material; `Tilt` (`±6 dB`) trims Band 4 high-frequency brightness; `Amount` (`0–100%`) and `Mix` blend the compander depth; `Match` autogain keeps auditioning level-neutral alongside `Delta` monitoring and rear `Supply Draw` / `Output Guard` trims.

**Studio Use Cases**
- **Lead & Backing Vocals:** `Type A` (`Encode`, `High pair`) or `Type B` lifts breathy presence, diction, and shimmer without harsh sibilance spikes.
- **Acoustic Guitar, Strings & Drum Overheads:** `Type A` (`Encode`, `All four`) brings out pick attack, bow texture, and cymbal decay without squashing peak transients.
- **Parallel Ambience & Room Mics:** `Broadband` `Encode` or `Decode` shapes room sustain—either blooming quiet decay upward or snapping room tails tight around snare hits.

---

### WD AX

**Sonic Character & Archetype**
An equalizer boosts whatever noise or room resonance already sits in a track; `WD AX` instead synthesizes new harmonic energy and sub-bass sustain at a fixed `49`-sample latency (`2x` oversampled below `88.2 kHz`). Its high band passes a `12 dB/oct` Butterworth high-pass signal into a bias-walking, single-ended asymmetric harmonic generator led by warm second-order harmonics, then blends that sideband back with the dry audio. The low band isolates sub energy and lifts note sustain rather than the initial transient hit, adding low-end weight without tripping bus limiters.

**Modes, Models & Controls**
- **High-Band Exciter (`HF Tune` / `Harmonics` / `Mix` / `Color`):** `HF Tune` (`700–7000 Hz`) sets the corner frequency feeding the sideband generator; `Harmonics` (`0–100%`) drives the asymmetric saturation depth; `Mix` (`0–100%`) dials the synthesized sparkle into the dry signal. Toggling `Color` off switches the generator to a clean gain-matched high-pass sideband so you can hear what the harmonic circuit itself contributes.
- **Low-Band Dynamic Sub (`LF Tune` / `Overhang` / `Girth`):** A low-pass filter (`50–150 Hz`, `Q = 0.60`) feeds a feed-forward `12:1` soft-knee limiter with `+8 dB` fixed makeup and adjustable `Overhang` release (`60–400 ms`), blended via `Girth` (`0–100%`). Because the limiter clamps the initial transient and releases into the note tail, sub-bass bloom stays full while peak headroom stays controlled.
- **Staging & Calibration:** `Match` static autogain, `Unit` (`1–8`), `Pair` drift, `Drive Cal`, `Delta` monitor, and `WD Rack` chassis coupling.

**Studio Use Cases**
- **Dull Vocals, Acoustic Guitars & Synth Leads:** Synthesizing upper-harmonic sheen above `3–5 kHz` where standard shelving EQ sounds brittle or hissy.
- **Sub-Bass Synths, Kick Drums & Bass:** Using `LF Tune` + `Overhang` + `Girth` to lengthen low-end weight and translate bass fundamentals onto smaller playback systems.
- **Mix Bus Final Polish:** Subtle `5–15%` blend on both bands to open top-end air and anchor sub sustain without shifting overall tonal balance.

---

### WD Brigade

**Sonic Character & Archetype**
A zero-latency, dual-chip asynchronous bucket-brigade delay (`BBD`), `WD Brigade` gets its tone straight from clock physics. Delay time equals stage count divided by twice the clock frequency, and the 8-pole anti-aliasing and reconstruction filters track that clock directly—so longer delays narrow top-end bandwidth while short delays stay bright and metallic. Slap echoes ring clearly, long throws melt into dark, smoky wash behind the dry signal, and turning `Time` bends pitch smoothly as stored charges step across clock speeds.

**Modes, Models & Controls**
- **`Stages` (`1024` / `2048` / `4096`):** Sets the physical BBD capacitor chain length. Shorter chains require lower clock rates for a given delay time—darkening and coarsening repeats earlier—while `4096` retains noticeably more high-frequency bandwidth at medium and long delay times.
- **`Compander` (`On` / `Off`):** Engages the classic `2:1` pre-emphasis/de-emphasis compander around a `-70 dB` chain noise floor, suppressing BBD clock hiss while adding subtle transient pumping on hot repeats.
- **`Self-Osc` (Rear Panel Toggle):** Extends `Repeats` past its safe `95%` performance ceiling up to `110%`, enabling runaway analog dub feedback and pitched self-oscillation sweeps.
- **Modulation & Tone:** `Time` (`20–600 ms`, plus UI tempo snap), `Spread` (`0–100%` L/R clock offset for wide stereo Haas bounce), `Mod Depth` & `Mod Rate` (`0.05–8 Hz` analog chorus/vibrato drift), `Noise`, `Send HPF` (`20–2000 Hz`), `Send LPF` (`800–20000 Hz`), `Mix`, `Delta`, and `Output Guard`.

**Studio Use Cases**
- **Rockabilly & Indie Vocal Slapback:** Short `80–130 ms` delays with `Spread` for wide, dark depth that tucks naturally behind a lead vocal.
- **Lead Guitar & Mono Synth Width:** High-clock `1024`-stage modulation with `Spread` for thick analog doubling and pitch-drifting ambience.
- **Dub Throws & Psychedelic Transitions:** `Self-Osc` enabled with live `Time` sweeps for smooth analog pitch glides and saturated runaway feedback.

---

### WD Clamp

**Sonic Character & Archetype**
`WD Clamp` is a three-slot modular compressor rack running at a fixed `147`-sample latency across every engine, routing order, and quality setting. Load any combination of `Opto`, `Mu`, `FET`, or `VCA` dynamics processors into slots `A`, `B`, and `C`, reorder them on the fly over a clickless `30 ms` crossfade, and let all three modules pull current from one shared power supply (`Sag`) with optional inter-slot `Bleed`. When slot `A` slams a drum transient, the shared rail dips for slots `B` and `C`, producing cohesive multi-stage compression behavior impossible with three independent plugins.

**Modes, Models & Controls**
- **Routing & Shared Hardware (`Order` / `Sag` / `Bleed` / `In Pad`):** Six chain orders (`A-B-C`, `A-C-B`, `B-A-C`, `B-C-A`, `C-A-B`, `C-B-A`), shared rail `Sag` (`x0` to `x32`), adjacent-slot `Bleed` (`x0` to `x4`), master `IN PAD` (`0 / -10 / -20 dB`) plus per-slot pads, `ECO`/`HQ` quality, `Auto` / `Auto (Legacy)` autogain, and live measured transfer-curve displays.
- **`Opto` Sub-Models:** `WD-2A` (warm tube electro-optical leveling), `WD-3A` (punchier solid-state electro-optical leveling), and `WD-1B` (all-tube optical cell with `Threshold`, `2–10:1` `Ratio`, `Fixed` / `Fix / Man` / `Manual` timing, `Attack`, `Release`, `SC HPF`, `THD`, and `Iron`).
- **`Mu` Sub-Models:** `Iron Mu` (heavy dual-triode transformer-coupled variable-mu with 6-position `Time Constant`, `Mastering`/`Broadcast` switch, `SC HPF`, `Bias`, `Iron`) and `T-Bar Master` (wideband local-feedback dual-triode vari-mu with `Threshold`, stepped `1.5/2/4/10:1` `Ratio`, continuous `Attack`/`Release`, `Auto` release, `SC HPF`, `SC Tilt`, `THD`, and `Iron`).
- **`FET` Sub-Models:** `Shunt-FET Limiter` (input-driven feedback FET with chordable `4/8/12/20` ratio buttons, `Black` low-noise vs. `Blue` hotter revisions, `Class A`/`Push-Pull`/`Triode` output stages, `Attack Off`, `Bias`, `Drive`), `Stepped Limiter-Gate` (`1–20:1` stepped ratio, `Threshold`, 3-step `Attack`, 8-step or dual-stage `Auto` release, stackable `100:1` peak limiter with `De-Ess` emphasis, and pre-cell `1:2` expander / `1:20` gate), `Germanium` (JFET cell into Class-A germanium/iron output with 6 diode curves `RS`–`ZH`, `Dirty` mode, stepped `SC HPF`), and `Precision` (clean double-precision feed-forward log-domain compressor).
- **`VCA` Sub-Models:** `Console Bus` (stepped `2/4/10:1` ratio, stepped `Attack`/`Release`/`Auto`, `SC HPF`), `RMS Punch` (true-RMS detector, `Hard` or `Soft Knee`, continuous `Ratio`, `SC HPF`), and `Thrust Bus` (`Norm`/`Med`/`Loud` sidechain weighting, `New (FF)`/`Old (FB)` topology, `Hard`/`Med`/`Soft` knee, 7-step `Attack`, continuous `Release`, stepped `Link`, `SC HPF`).

**Studio Use Cases**
- **Serial Vocal Chain:** `Shunt-FET Limiter` catching fast consonants into `WD-2A` or `WD-1B` optical leveling into `Iron Mu` harmonic weight—all reacting on one shared rail.
- **Drum Bus & Room Glue:** `RMS Punch` or `Stepped Limiter-Gate` into `Thrust Bus` (`Loud` weighting) for punchy kick sustain and controlled cymbal splash.
- **Mastering & Stem Shaping:** `T-Bar Master` into `Console Bus` or `WD-1B` with `Bleed` and subtle `Sag` to bind submixes together.

---

### WD Delta Return

**Sonic Character & Archetype**
`WD Delta Return` is the analytical end-of-chain partner to `WD Delta Send`, eliminating loudness bias and timing offsets when evaluating any processing chain. Sitting after your plugins, it pairs with its matching `WD Delta Send` instance over shared memory (`Pair A`–`H`) and runs a `32,768`-sample normalized FFT cross-correlation across up to `131,072` samples of lag to lock onto the exact sample latency of everything between Send and Return.

**Modes, Models & Controls**
- **`Mode` (`Wet` / `Wet Match` / `Dry` / `Delta` / `Delta Match`):** `Wet` passes the processed chain unaltered; `Wet Match` applies continuous `±24 dB` loudness compensation so processed audio matches input loudness; `Dry` plays the latency-aligned pre-chain tap for clickless A/B bypass without PDC jumps; `Delta` outputs `wet - dryAligned` to reveal pure harmonic distortion, compression gain riding, or EQ shape; `Delta Match` plays the gain-matched residual difference.
- **Alignment & Gain-Matching Controls:** `Look` engages `0.85 s` of host-reported lookahead PDC so loudness matching stays steady across sudden transient hits and bypass switches; `Phase` (`Ø`) flips polarity; `Trim` offers `±24 dB` manual calibration; UI `ALIGN` and `±1`/`±10` sample nudges allow manual sub-sample verification.

**Studio Use Cases**
- **Honest Mastering & Mix-Bus A/B:** Checking whether a dense chain of EQs, tape, and limiters actually improved the mix once loudness differences are removed.
- **Auditioning Third-Party Chains:** Measuring exact latency and harmonic/transient residuals (`Delta` / `Delta Match`) of any plugin stack in your DAW.
- **Live Client Bypass Checks:** Using `Dry` mode to bypass a heavy multi-plugin vocal or drum chain instantaneously without DAW latency glitches.

---

### WD Delta Send

**Sonic Character & Archetype**
`WD Delta Send` is the zero-latency, bit-exact input tap placed at the front of an insert chain to feed a paired `WD Delta Return`. Audio passes straight through untouched down to the bit while a stereo reference stream is published continuously to the selected shared-memory slot.

**Modes, Models & Controls**
- **`Pair` (`A`–`H`):** Assigns the exclusive sender channel linking this `WD Delta Send` instance to one or more `WD Delta Return` receivers.
- **Front-Panel Tap Controls:** `Tap Bypass` toggle and real-time peak readout monitoring confirm clean reference capture before downstream processing.

**Studio Use Cases**
- **Chain Entry Reference:** Always insert at slot 1 before EQs, preamps, compressors, or nonlinear color processors paired with `WD Delta Return` at the end of the track or bus.
- **Parallel Chain Diagnostics:** Running multiple `Pair` buses (`A`–`H`) simultaneously across Drum Bus, Vocal Bus, and Mix Bus for instant loudness-matched checks across stems.

---

### WD Duress

**Sonic Character & Archetype**
Built for aggressive tone shaping and heavy compression, `WD Duress` is a computed-curve VCA compressor running at a fixed `49`-sample latency (`2x` oversampled below `88.2 kHz`). Each ratio position loads its own transfer knee and detector circuit—ranging from distortion-only `1:1` saturation up to a twenty-second optical-style memory tail and a logarithmic brickwall limiter. Independent harmonic generators (`Dist 2`, `Dist 3`) and sidechain filters cover everything from punchy bus leveling to crushed room-mic grit.

**Modes, Models & Controls**
- **8 `Ratio` Laws:** `1:1` (zero compression—pure saturation and circuit warmth), `2:1` (up to `30 dB` wide parabolic knee), `3:1`, `4:1`, `6:1`, `10:1 Opto` (two-stage optical-inspired memory tail extending up to `20 s`), `20:1` (hard limiting knee), and `Nuke` (brickwall limiting with an aggressive logarithmic pumping release).
- **`British` (`British Mode`):** Overrides normal envelope behavior with all-buttons-style ballistics—loading a steep plateaued limiting curve on `1:1` and adding aggressive transient-lag grit on every other ratio.
- **`Audio Mode` (`Clean` / `Dist 2` / `Dist 3`) & `HP 80`:** `Clean` stays pristine (`0.025–0.3%` THD); `Dist 2` injects warm Class-A second-harmonic saturation (`0.05–3%` THD); `Dist 3` drives heavier third-harmonic tape-style clipping (`0.1–20%` THD). `HP 80` engages an `80 Hz` 3-pole Bessel audio high-pass filter before the gain cell.
- **Detector & Sidechain (`Detector` / `Link` / `Image` / `Ext SC` / `D/A Iron`):** Detector switches between `Flat`, `HP` (`~80 Hz`), `Band` (`6 kHz` mid/presence emphasis), and `HP+Band`. `Link` (`0–100%`) blends phase-sensitive audio sum while `Image` engages DC control-voltage locking. `Ext SC` accepts DAW sidechain audio or `'WBCN' v2` Beacon / `WD Outboard` feeds with `Key Trim` (`±24 dB`), `SC Listen`, and `D/A Iron` (`18.5 kHz` LPF + `18 Hz` HPF + Permalloy core conditioning). Includes `Auto` / `Auto (Legacy)` autogain, `Mix`, `Color`, `Dist` trim, and `Delta`.

**Studio Use Cases**
- **Snare Crack & Parallel Drum Room Smash:** `Nuke` or `6:1` with `British Mode` and `Dist 3` on drum rooms or parallel drum buses for explosive sustain and transient snap.
- **Bass Guitar & Synth Grit:** `1:1` or `4:1` in `Dist 2` / `Dist 3` with `HP 80` to lock down low-end dynamics while saturating upper harmonics so bass cuts through small speakers.
- **Aggressive Rock Vocals:** `10:1 Opto` or `3:1` with `Band` detector weighting and `Dist 2` to tame upper-mid bite while pinning vocal presence up front.

---

### WD Echo

**Sonic Character & Archetype**
`WD Echo` is a zero-latency mechanical tape-loop delay coupled to a three-spring reverb tank, modeled down to loop splice inertia, motor slew, and imperfect erase-head ghosting. Turning `Repeat Rate` alters motor capstan speed (`1.6–13 ips`) rather than simply jumping a delay buffer—pitch-bending echoes already circulating on the tape loop with authentic mechanical inertia. Playback can even traverse the tape loop backward or in alternating palindrome cycles while still passing through the record/replay EQ and head saturation stages.

**Modes, Models & Controls**
- **12 `Mode` Combinations:** `1: Head 1`, `2: Head 2`, `3: Head 3`, `4: Heads 1+2`, `5: Heads 2+3`, `6: All Heads` (tape loop only), `7: Head 1 + Spring` through `11: All Heads + Spring` (multi-tap tape plus spring tank), and `12: Spring Only`.
- **`Time Arrow` (`FWD` / `PALIN` / `REV`):** Reads the magnetic tape loop forward (`FWD`), alternating forward and backward (`PALIN`), or straight-up backward (`REV`) through the full tape wear and tone circuit.
- **Tape & Spring Physics:** `Repeat Rate` (`1.6–13 ips` with optional host BPM sync), `Intensity` (`0–100%`, self-oscillating past unity), `Echo` & `Reverb` blend levels, `Bass` & `Treble` sitting inside the regeneration feedback loop (shaping each repeat progressively), `Wow / Wear`, `Erase` (leaving faint ghost remnants on recycled tape), `Azimuth` (stereo head tilt), `Spring Tension`, `Color`, `Wet Only` (100% return-fader mode), and `Unit` (`1–8`) transport quirks.

**Studio Use Cases**
- **Dub Chords, Horns & Vocal Throws:** Multi-head rhythmic taps (`Heads 1+2` or `All Heads + Spring`) with `Bass`/`Treble` feedback filtering and `Intensity` pushed into swirling self-oscillation.
- **Psychedelic Guitars & Ear Candy:** `PALIN` or `REV` `Time Arrow` with `Erase` ghosting and `Azimuth` spread for backward tape swells and stereo shimmer.
- **Return-Bus Ambience:** Engaging `Wet Only` on an aux send for classic dub-style tape + spring texture under snares, synths, and guitars.

---

### WD FET

**Sonic Character & Archetype**
`WD FET` packs four distinct field-effect and precision compressor circuits into a single `49`-sample fixed-latency chassis (`2x` oversampled below `88.2 kHz`). Its flagship shunt-FET voice solves the resistor-ladder ratio network directly from circuit schematics—so pushing multiple ratio buttons down simultaneously ("all-buttons") works naturally from physics rather than a pre-drawn curve, collapsing attack behavior into violent microsecond transient punch and saturated midrange bloom. Three companion circuits expand the box from spiky drum crunch to transparent mastering control.

**Modes, Models & Controls**
- **4 `Model` Topologies (`30 ms` crossfade):**
  1. **`Shunt-FET Limiter` (First Voice):** Feedback JFET shunt divider with a fixed internal threshold driven by `Input`, chordable `4 / 8 / 12 / 20` ratio buttons (`4+20` engages the `ALL` plateau; unlatching all buttons leaves the line amp only), microsecond `Attack` (`20–800 µs`) plus an `Attack Off` detent for pure line-amp coloration, `Release` (`50–1100 ms`), `Rev` (`Black` low-noise linearized cell vs. hotter, grittier `Blue` pre-linearization cell), and selectable output `Stage` (`Class A` even-harmonic warmth, `Push-Pull` higher-headroom odd-led punch, or `Triode` twin-triode + iron coloration).
  2. **`Stepped Limiter-Gate` (Second Voice):** Feedback FET with computed CV law, stepped `Ratio` (`1, 2, 3, 5, 10, 20:1`), stepped `Threshold` (`-24` to `-4 dBFS` in `2 dB` steps), 3-step `Attack` (`250 µs`, `2.5 ms`, `25 ms`), 8-step `Release` (`25 ms–3.2 s`) plus dual-stage `Auto` release, stackable `100:1` output peak `Limiter` (`250 µs` at `-4 dBFS`) with `De-Ess` (`50 µs`) pre-emphasis routed to the limiter sidechain, and a pre-cell `Gate` (`Expander 1:2` / `Gate 1:20` over `20 dB` range with `Fast 25 ms` / `Slow 5 s` release).
  3. **`Germanium` (Third Voice):** JFET gain cell driving a Class-A germanium and iron output stage (`1.5–10:1`, `0.5–30 ms` attack, `100–3000 ms` release), 6-step `Knee` diode curves (`RS`, `GS`, `GM`, `SM`, `SH`, `ZH` from `12 dB` soft to `0.3 dB` hard), `Dirty` switch (disconnects the cell linearization divider to jump THD from `0.2–0.5%` to `2–5%`), and stepped `SC HPF`.
  4. **`Precision` (Fourth Voice):** Clean, double-precision feed-forward log-domain compressor (`1–20:1`, `0.02–30 ms` attack, `25–3200 ms` release, 6-step `0–18 dB` knee) that stays completely clean, ignores chassis rail sag, and nulls bit-identically at `1:1`.
- **Shared Controls:** `Bias` (`-1` to `+1`, starving the gate for asymmetric distortion or raising conduction for cleaner headroom), `SC HPF`, `Emph` (detector emphasis on non-limiter-gate models), `SC Listen`, `Link` (`0–100%`), `Mix`, `Drive`, `Color`, `Auto` / `Auto (Legacy)` autogain, `Unit` (`1–8`), and `Delta`.

**Studio Use Cases**
- **Snare Crack, Kick Attack & Parallel Crush:** `Shunt-FET Limiter` (`Blue` or `ALL` buttons) or `Stepped Limiter-Gate` with `Gate` active to explode drum room sustain and sharpen transient snap.
- **Forward Pop/Rock Lead Vocals:** `Shunt-FET Limiter` (`Black`, `4:1` or `8:1`, `Class A` or `Triode`) keeping every syllable pinned right at the front of a dense arrangement.
- **Bass Guitar & Vintage Grit:** `Germanium` (`Dirty` engaged, `GS`/`GM` knee) for thick low-mid harmonic density and chewy dynamic weight.

---

### WD Mu

**Sonic Character & Archetype**
`WD Mu` models a transformer-coupled, remote-cutoff dual-triode variable-mu compressor at a fixed `49`-sample latency (`2x` oversampled below `88.2 kHz`). Following true variable-mu design, there is no threshold control: raising `Input` drives the push-pull triode pair harder into curved grid-bias gain reduction while Jiles-Atherton input and output transformers saturate around low-frequency magnetic flux. That produces rounded transients, full low-mid weight, and smooth harmonic glue that tightens as you push the input.

**Modes, Models & Controls**
- **`Mode` (`Mastering` vs. `Broadcast`):** `Mastering` runs an `8.5x` detector drive into a cleaner, larger transformer core for transparent weight and gentle limiting; `Broadcast` pushes `13x` detector drive with a tighter DC gap and smaller, darker iron that grabs harder and adds midrange thickness.
- **`Time Constant` (6-Position RC Bank):** Positions `1`–`4` step through fixed recovery times (`0.3 s`, `0.8 s`, `2 s`, `5 s`), while positions `5` (`2 / 10 s`) and `6` (`0.3 / 10 / 25 s`) engage multi-stage program-dependent auto release that catches brief peaks rapidly while holding steady under sustained program averages.
- **`Channel Mode` (`Linked` / `Dual Mono` / `Mid-Side`):** Operates as a stereo-linked bus glue box, unlinked dual-mono stereo widener, or `Mid-Side` processor controlling center punch independently from side ambience.
- **Circuit & Gain Controls:** `SC HPF` (`Off / 60 / 100 / 200 Hz`), `Bias` (`-1` to `+1` shifting quiescent tube operating point), `Iron` (`x0.5` to `x2` core saturation drive), `Auto` / `Auto (Legacy)` autogain, `Unit` (`1–8` with rear tube pair mismatch), `Delta`, and `WD Rack` chassis coupling.

**Studio Use Cases**
- **Mix Bus & Mastering Cohesion:** `Mastering` mode, `Time Constant 5` or `6`, and `1–2 dB` of gentle reduction for clear width, depth, and low-end authority.
- **Drum Bus & Room Glue:** `Broadcast` mode (`Time Constant 1` or `2`, `60/100 Hz SC HPF`) to fuse kick, snare, and overheads with thick transformer punch.
- **Lead Vocals, Bass & Acoustic Ensembles:** Tracking `Linked` or `Mid-Side` on `Time Constant 2` or `3` to smooth harsh transients without audible pumping.

---

### WD Opto

**Sonic Character & Archetype**
Built around a physical electroluminescent (`EL`) panel and cadmium-sulfide (`CdS`) photocell model, `WD Opto` is a fixed `6`-sample latency optical leveling amplifier (`4x` oversampled around its nonlinear color stage). Fast and slow carrier pools combine with deep-trap multi-second memory, so the compressor's release tail adapts continuously to what played ten seconds earlier. Because carrier decay depends on signal history, `Peak Reduction` and `Drive` interact naturally with a level-neutral tube or solid-state makeup stage.

**Modes, Models & Controls**
- **`Model` (`WD-2A` vs. `WD-3A`):** `WD-2A` pairs the electro-optical photocell (`~6.8 ms` nominal attack) with a warm twin-triode tube makeup stage (`~0.324%` nominal THD) for soft, round top-end glow; `WD-3A` uses a faster solid-state driver (`~4.1 ms` nominal attack) and Class-AB cubic output (`~0.165%` nominal THD) that grabs transients slightly quicker and punches forward in the upper midrange.
- **`Mode` (`Compress` vs. `Limit`):** `Compress` runs pure optical feedback (`~3.22:1` ratio) for smooth leveling; `Limit` leaks roughly `4%` raw input directly into the detector for a firmer knee and higher peak-limiting ratio.
- **`Channel Mode` (`Linked` vs. `Dual Mono`):** Stereo-linked leveling or independent dual-mono operation.
- **Modifier & Service Controls:** `Peak Reduction`, `Drive` (level-neutral color gain), `Attack` & `Release` (`x0.1` to `x10` cell timing), `Tail` (`0` to `2` deep-trap memory scaling), `Tilt` (`-6` to `+12 dB` sidechain spectral sensitivity), `THD`, `Iron`, `Mix`, `Color` bypass, `Auto` / `Auto (Legacy)` autogain, `Unit` (`1–8`), and `Delta`.

**Studio Use Cases**
- **Lead Vocals & Voiceover:** `WD-2A` in `Compress` mode for smooth, musical vocal riding that keeps quiet phrases intimate without choking loud belts.
- **Bass Guitar & Electric Guitars:** `WD-2A` or `WD-3A` (`Limit` for pick/slap control) to turn uneven notes into a steady, thick pocket.
- **Drum Overheads, Acoustic Guitar & Strings:** `WD-3A` with moderate `Tilt` to let snare and strum transients breathe while gluing sustain smoothly.

---

### WD Pre

**Sonic Character & Archetype**
`WD Pre` places seven complete console, broadcast, and cassette microphone/line preamplifier circuits under one calibrated `Gain` dial. Turning `Gain` reconfigures feedback dividers, transformer flux drive, and bias headroom in real time—moving smoothly from clean head-amp gain into thick stem overdrive past the top of the calibrated range while `Level` acts purely as a passive fader after the output iron. Latency dynamically matches the selected circuit (`2x` oversampling below `88.2 kHz`, plus the integrated tape engine delay when the cassette channel is engaged).

**Modes, Models & Controls**
- **7 `Law` Topologies (`30 ms` dual-path crossfade):**
  1. **`Precision`:** 64-bit linear digital wire (`-25` to `+80 dB`) with zero distortion (`Z`, `Color`, `Flux`, and `Toast` inactive).
  2. **`Class-A British Console`:** Three-stage discrete Class-A preamp with `5 dB` stepped gain (`Mic +20..+80 dB`, `Line -25..+20 dB` plus crank overdrive), three transformers including gapped output iron (`Z` and `Flux` active) for thick low-mid weight and singing treble saturation.
  3. **`American Discrete Op-Amp`:** Continuous potentiometer gain (`Mic 34..69 dB`, `Line 14..45 dB` plus crank), `1:8` input step-up (`Z` active), high-slew discrete op-amp, and `1:3` ungapped output iron (`Flux` active) delivering punchy, forward midrange bark.
  4. **`German Broadcast Pentode`:** Broadcast pentode cascade with `6 dB` stepped attenuation/feedback ladder (`10 dB` to `76 dB` plus crank), fixed `40 Hz` / `15 kHz` band edges, `Z` impedance switching, and a heavy `9:1` output transformer (`Flux` active) for rich odd/even tube sheen.
  5. **`4-Track Cassette Channel`:** Transformerless dual op-amp (`0..50 dB` plus crank; shared jack ignores `Source`, `Z`, and `Flux`) driving an integrated `3.75 ips` high-output cassette `TapeCore` stage controlled by `Toast` (`0–100%`) for lo-fi crunch and squashed midrange character.
  6. **`Clean E`:** Transformerless electronically balanced silicon console head amp (`Mic 20..70 dB`, `Line -20..+20 dB` plus crank) with flat frequency response and a sudden, sharp third-harmonic rail knee at `+24/+26 dBu` (`Z`, `Flux`, `Toast` inactive).
  7. **`Tube Tone`:** Classic British tube console (`16..64 dB` in `6 dB` steps plus crank) placing a pentode front end ahead of the gain trim, a feedback output pair, and dual `200:200` transformers (`Flux` active) for creamy vintage saturation.
- **Input, Filter & Gain Controls:** `Source` (`Mic` `-50 dB` referral vs. `Line`), `Z` (`Hi 1.2k` vs. `Lo 300`, adding `+6 dB` and shifting HF winding resonance on the first three iron laws), `-20 dB Pad`, `Phase` (`Ø`), `Toast` (`0–100%`, cassette law only), post-autogain `HPF` (`0–400 Hz`, `<20 Hz` bit-exact off) & `LPF` (`0–20 kHz`, `<3 kHz` bit-exact off), `Auto` autogain with `→ LEVEL` bake button, passive `Level` (`±24 dB`), `Color`, `Iron`, `Unit` (`1–8`), and `Delta`.

**Studio Use Cases**
- **Snare, Kick & Bass Tracking Color:** `American Discrete Op-Amp` or `Class-A British Console` pushed into the top of the `Mic` scale for punchy transient edge and low-end transformer bloom.
- **Clean-to-Bite Guitar & Synth DI:** `German Broadcast Pentode` or `Tube Tone` (`Lo 300` impedance for darker bite) to give sterile software synths and amp sims physical weight.
- **Lo-Fi Percussion, Vocals & Textures:** `4-Track Cassette Channel` with `Toast` dialed up for authentic `3.75 ips` cassette compression and gritty midrange crunch.

---

### WD Rack

**Sonic Character & Archetype**
A zero-latency, bit-exact passthrough chassis controller, `WD Rack` links independent Werewolf Dynamics plugins onto one shared virtual hardware frame. Audio passing through `WD Rack` itself stays completely unaltered; its sole job is coordinating the shared-memory backplane for any module set to the same `Chassis` frame (`1`–`4`). When one plugin draws heavy transient current, neighboring slots experience voltage sag and adjacent-slot crosstalk according to slot order.

**Modes, Models & Controls**
- **`Chassis` (`1`–`4`):** Selects which of four independent virtual hardware frames this rack coordinates.
- **`Character` (`Console` vs. `Broadcast`):** `Console` applies a `1.5 kHz` high-pass bleed profile across adjacent slots; `Broadcast` shifts bleed lower (`600 Hz` HPF) with deeper power-supply sag.
- **`Mains` (`60 Hz` vs. `50 Hz`):** Sets regional AC power frequency for doubled mains rectifier ripple (`120 Hz` or `100 Hz`).
- **Backplane & Global Controls:** `Crosstalk` (`0–1`), `PSU Sag` (`x0.5` to `x32`), `PSU Ripple` (`x0` to `x8`), `Bus Bar` (`0` star wiring to `x8` resistive ladder that starves far-end slots), interactive slot reordering, `Clear Ghosts`, and master `Power` / `Delta` overrides that toggle every module in the chassis simultaneously.

**Studio Use Cases**
- **Whole-Mix Analog Cohesion:** Dropping `WD Rack` on the master bus (`Chassis 1`) so compressors, EQs, and tape machines across your session breathe off one power rail.
- **Isolated Stem Frames:** Using `Chassis 2` for Drums and `Chassis 3` for Vocals to create separate physical racks with independent sag and crosstalk profiles.
- **One-Click Global Delta & Bypass:** Using `WD Rack`'s master switches to audition the cumulative color of every racked module in a project at once.

---

### WD Span

**Sonic Character & Archetype**
Using Mid-Side transformer physics instead of phase delays or all-pass networks, `WD Span` widens stereo width at zero latency without comb filtering. Processing happens exclusively on the difference (`Side`) channel before re-matrixing, so a mono fold collapses back down to exact `L + R = 2M` with `-327 dB` structural null. Driving the transformer core saturates low-frequency flux first, naturally pulling sub-bass back toward the phantom center without crossover filters.

**Modes, Models & Controls**
- **`Width` (`0–200%`):** Scales Side-channel gain smoothly from pure mono (`0%`) through unity (`100%`) to wide stereo spread (`200%`).
- **`Iron` (`0–100%`) & `Drive` (`x0.25` to `x8`):** Drives a gapped Jiles-Atherton magnetic core and magnetizing shunt on the Side channel, warming stereo width and compressing wide low-end mud back toward center.
- **`Shuffle` (`-6` to `+6 dB`):** Applies a `250 Hz` Mid-Side shuffler low shelf on the Side signal for classic wide-stereo low-end fullness or side tightening.
- **Utility Controls:** `Output` (`-12` to `+12 dB`), `Color` toggle, `Delta` residual monitor, and rear `Supply Draw`.

**Studio Use Cases**
- **Mix Bus & Mastering Width:** Adding `105–125%` `Width` with gentle `Iron` and positive `Shuffle` to widen the stereo field while keeping kick and bass locked dead center.
- **Acoustic Guitars, Keys & Backing Pads:** Widening stereo pairs aggressively without introducing phase smear on mono club systems or phone speakers.
- **Tightening Muddy Stereo Synths:** Negative `Shuffle` (`-2` to `-4 dB`) to clean out wide side-channel rumble while maintaining bright upper-mid width.

---

### WD Spring

**Sonic Character & Archetype**
Dual decorrelated three-spring tanks give `WD Spring` a zero-latency physical dispersion reverb that standard algorithmic delays miss. Real coiled steel carries high frequencies faster than low frequencies, smearing every transient into the classic descending metallic chirp ("boing") from wave-propagation physics. High-amplitude hits also raise instantaneous spring tension, subtly bending pitch during heavy splashes.

**Modes, Models & Controls**
- **3 `Tank` Geometries:**
  1. **`Combo`:** Short, bright guitar-amp spring pan (`8.5 ms` onset, `1301 Hz` centroid, `0.92` dispersion) with snappy splash and pronounced metallic chirp.
  2. **`Outboard`:** Balanced rack-mount studio tank (`11.0 ms` onset, `651 Hz` centroid, `0.70` dispersion) voiced for general mixes, percussion, and vocals.
  3. **`Tall`:** Long, dark console reverb tank (`14.6 ms` onset, `390 Hz` centroid, `0.45` dispersion) with deep, moody low-mid bloom and restrained chirp.
- **Tank Physics & Tone:** `Decay` (`0.25–6 s` T60-renormalized), `Tone` (`x0.25` to `x4` mode crossover—the primary brightness voice), `Damping` (`x0.25` to `x4` tail HF rolloff), `Dispersion` (`0–100%` chirp intensity), `Tension` (`0–100%` amplitude-dependent pitch glide), `Drive` (`0–12` ADAA1 transducer saturation), `Motion` (`0–100%` `±0.4 ms` mechanical wander), `Width` (`0–150%`), `Predelay` (`0–250 ms`), `Low Cut` (`20–500 Hz`, `<25 Hz` bypassed), `Mix`, `Output`, `Delta`, and rear `Supply Draw`.

**Studio Use Cases**
- **Surf, Indie & Garage Guitars:** `Combo` tank with moderate `Dispersion` and `Tension` for drippy amp-style spring bounce.
- **Snare, Percussion & Dub Accents:** `Outboard` tank with `Predelay` (`20–50 ms`) and `Drive` pushed for splashy vintage transducer bite.
- **Moody Vocals & Synth Beds:** `Tall` tank with `Low Cut` at `120–200 Hz` and `Width` spread out for dark, enveloping vintage depth.

---

### WD Strip

**Sonic Character & Archetype**
`WD Strip` consolidates a complete Werewolf Dynamics console channel into one fixed `98`-sample latency window—routing input, expander/gate, preamp, swappable EQ and compressor bays, console output stage, and soft-to-hard clipper off a single internal power supply. When the preamp pushes hard into the rail, the downstream compressor and output stage feel that sag directly in real time, without needing `WD Rack` inserted.

**Modes, Models & Controls**
- **1. `Gate` Stage:** Switchable `Expander 1:2` (`-40 dB` floor) or `Gate 1:20` (`-80 dB` floor with `+2 dB` hysteresis), `Threshold` (`-80` to `-20 dB`), and `Release` (`25–5000 ms`).
- **2. `Pre` Stage (7 Laws):** Offers `Precision`, `Class-A British Console`, `American Discrete Op-Amp`, `German Broadcast Pentode`, `4-Track Cassette Channel` (running the discrete low-rail desk op-amp stage *without* `WD Pre`'s `3.75 ips` cassette `TapeCore` / `Toast` stage so the strip stays locked at `98` samples), `Clean E`, and `Tube Tone`—complete with `Mic`/`Line`, `Hi 1200R`/`Lo 300R` impedance, `-20 dB` pad, `Ø` phase, `Iron`, `Drive`, and post-tap `Out`.
- **3. Swappable `EQ` ↔ `COMP` Bay (`Pre Comp` / `Post Comp`, `30 ms` repatch crossfade; Linked stereo only):**
  - **`EQ` (with shared `±6 dB @ 700 Hz` `Tilt`):** With `Desk EQ` set to `OFF`, choose `XQ` (all 5 families plus per-band `DYN` compression, omitting `Match EQ` and Band `Listen`) or `WDTec` (full passive `Program` and `Midrange` sections with `500 Hz Mod`, `Termination`, `NFB`, `Core`, and `Drive`). Engaging `Desk EQ` crossfades into 5 dedicated console networks: `British Inductor Console EQ` (18 dB/oct stepped HPF, shared-loop Baxandall shelves, tapped-inductor mid), `Clean E` (nodal state-space card with swept HPF/LPF, shelf/bell LF & HF toggles, dual-gang Q-coupled LMF/HMF), `American Proportional-Q Steel EQ` (3-band 2 dB stepped proportional-Q bells with Low/High shelf toggles), `Tube Tone` (MNA passive tone box in 2 dB detents with bass R-L boost/R-C cut and Classic 10 kHz treble shelf or switchable presence peaks), and `German Broadcast Console EQ` (2 dB stepped 60 Hz LS, 10 kHz HS, boost-only presence `700 Hz–4 kHz`).
  - **`COMP`:** Toggle `CHANNEL COMP` (true-RMS console dynamics with `1:1–100:1` ratio, auto/manual release, and soft vs. hard knee) or load the full 4-engine Bay Compressor: `Opto` (`WD-2A` / `WD-3A` / `WD-1B`), `Mu` (`Iron Mu` / `T-Bar Master`), `FET` (`Shunt-FET Limiter` with chordable `4/8/12/20` + `Black`/`Blue` + `Class A`/`Push-Pull`/`Triode`, `Stepped Limiter-Gate` with pre-comp expander/gate, `Germanium`, `Precision`), or `VCA` (`Console Bus`, `RMS Punch` with `Hard`/`Soft Knee`, `Thrust Bus`).
- **4. `Console Out`, `Clip` & Channel Utilities:** Optional `Out` stage (`WD-N BRIT IRON`, `WD-S BIG CLEAN`, `WD-A US STEEL`, `WD-T TUBE CONSOLE`, `WD-G GERMAN BROADCAST`) with `Group` (`1–8`) and `Drive`; static `Auto` autogain; `Mix`; quadratic ADAA1 `Clip` (`Ceiling`, `Shape` Soft-to-Hard, even-order `Tube` bias); `Output`; channel utilities (`Ø` polarity, `L↔R` swap, `Mute L`, `Mute R`, `Mono`); and `ECO`/`HQ` (offline bounce forces `HQ`).

**Studio Use Cases**
- **All-in-One Lead Vocal Strip:** `Gate` (`Expander 1:2`) → `Class-A British Console` Pre → `British Inductor Console EQ` → `Opto` (`WD-2A` or `WD-1B`) → `Tube Console` out.
- **Punchy Drum Track Shaping:** `American Discrete Op-Amp` Pre → `American Proportional-Q Steel EQ` → `FET` (`Shunt-FET Limiter`) or `CHANNEL COMP` → `Clip` shaving sharp snare peaks.
- **Fast Mix Templates Across Stems:** Loading consistent `WD Strip` instances across guitars, keys, and backing vocals with varied `Desk EQ` and `Console Out` banks per stem.

---

### WD Summer

**Sonic Character & Archetype**
Designed to pair with `WD Summer Channel` instances across your tracks, `WD Summer` is a fixed `49`-sample latency (`2x` FIR oversampled below `88.2 kHz`) analog bus summing stage. Instead of summing digitally into a fixed clipper, `WD Summer` dynamically adjusts its bus rail and headroom from live channel telemetry (`CROWD`): as more `WD Summer Channel` instances feed the same `Group` (`1–8`), the shared supply sags earlier and bus saturation engages sooner—tightening dense choruses naturally while keeping sparse verses open.

**Modes, Models & Controls**
- **5 `Desk` Banks (`WD-N BRIT IRON` / `WD-S BIG CLEAN` / `WD-A US STEEL` / `WD-T TUBE CONSOLE` / `WD-G GERMAN BROADCAST`):**
  - `WD-N BRIT IRON`: Class-A British iron warmth with thick low-end flux and rounded highs.
  - `WD-S BIG CLEAN`: Wide-bandwidth inline desk with a rail-rectifier pedestal and subtle even-order gain modulation under drive.
  - `WD-A US STEEL`: Discrete op-amp steel-core punch with fast transient edges and firm low-mid authority.
  - `WD-T TUBE CONSOLE`: Vintage European pentode/triode console richness with soft harmonic bloom.
  - `WD-G GERMAN BROADCAST`: Ultra-clean German broadcast transformer path that stays virtually invisible until pushed hard.
- **Group & Bus Controls:** `Group` (`1–8`), `Drive` (`x0.25` to `x4` scaled by active `CROWD` count), `Bleed Floor` (`0–100%`, defaults off, modeling physical inter-channel bus crosstalk), `Output` (`±12 dB`), `Color` bypass, `Delta` monitor, rear `PSU Sag` (`x0.25` to `x4`), plus `Group Power` and `Group Delta` master switches controlling all linked `WD Summer Channel` instances in the group simultaneously.

**Studio Use Cases**
- **Drum, Vocal & Instrument Submix Buses:** Dropping `WD Summer` on Group buses (`Group 1` Drums, `Group 2` Guitars, `Group 3` Vocals) fed by `WD Summer Channel` tracks for authentic console summing density.
- **Full Mix Bus Glue:** `WD-S BIG CLEAN` or `WD-N BRIT IRON` on the master bus with `Bleed` dialed gently (`5–15%`) for cohesive analog stereo binding.
- **Instant Group Bypass & Delta:** Flipping `Group Power` or `Group Delta` on `WD Summer` to evaluate an entire stem's console coloration in one click.

---

### WD Summer Channel

**Sonic Character & Archetype**
`WD Summer Channel` is the zero-latency (`2x` IIR wrapped) track-side partner to `WD Summer`, bringing physical console strip tolerance and input transformer/op-amp nonlinearities to individual tracks. Every instance computes a deterministic component tolerance hash from its DAW track name—giving 32 channels subtle channel-to-channel impedance and harmonic variation just like discrete analog hardware channels on a real desk. When placed on a matching `Group` (`1–8`), it automatically syncs its `Desk` bank and responds to `Group Power` / `Group Delta` from `WD Summer`.

**Modes, Models & Controls**
- **5 `Desk` Banks:** Identical five console architectures (`WD-N BRIT IRON`, `WD-S BIG CLEAN`, `WD-A US STEEL`, `WD-T TUBE CONSOLE`, `WD-G GERMAN BROADCAST`) synchronized automatically to `WD Summer` when present on the same group, or selectable independently when used standalone.
- **Drive & Knee Controls:** `Drive` (`x0.25` to `x8` paired with a loudness neutralizer so saturation thickens tone without jumping volume) and `Edge` (`0` gradual knee to `1` hard op-amp wall, default `0` for smooth analog rounding).
- **Console Filters & Staging:** `HPF` (`0–400 Hz`, `<20 Hz` bit-exact off), `LPF` (`0–20 kHz`, `<3 kHz` bit-exact off), `Output` (`±12 dB`), `Group` (`1–8`), `Color`, `Delta`, and rear `Supply Draw`.

**Studio Use Cases**
- **Console Track Staging:** Inserting on every mix track prior to compression/EQ to establish cohesive analog headroom, high-pass cleanup, and track-to-track hardware variance.
- **Snare, Guitar & Synth Edge:** Pushing `Drive` and raising `Edge` (`0.4–0.8`) on `WD-A US STEEL` or `WD-N BRIT IRON` to shave sharp digital transients with console knee clipping.

---

### WD Tape

**Sonic Character & Archetype**
At a fixed `4801`-sample latency across all sample rates up to `192 kHz`, `WD Tape` models a full magnetic tape transport and electronics path. It integrates Jiles-Atherton magnetic hysteresis directly with record-head pre-emphasis, high-frequency bias oscillation, gap loss, self-erasure, reproduce-head contour bump, motor transport inertia, and electronics saturation—aligned to real fluxivity calibration standards.

**Modes, Models & Controls**
- **3 `Stock` Formulations:** `Workhorse` (balanced studio oxide with classic midrange punch and smooth saturation), `High Output` (higher flux headroom, tighter sub-bass, and cleaner transient reach), and `Old Reel` (aged vintage oxide that compresses highs earlier with softer harmonic breakup).
- **5 `Machine` Electronics:** `Reference` (`REF`, clean linear electronics around the pure tape path), `Swiss` (`SWI`, transformerless precision studio transport at `~0.20%` THD), `American` (`AME`, iron-coupled studio electronics at `~1.83%` THD for thick low-mid glue), `Tube` (`TUB`, all-valve electronics with heavy iron at `~3.70%` THD for lush saturation), and `Japanese` (`JAP`, hard-knee IC electronics at `~0.29%` THD with brisk transient bite).
- **Speed, Voicing, EQ & Calibration:** `Voicing` (`Studio` vs. `Portable` compact deck contour), `Speed` (`3.75`, `7.5`, `15`, `30 ips`—shifting head-bump frequency, HF bandwidth, and noise spectrum), `EQ Std` (`NAB` vs. `CCIR`; `30 ips` automatically engages AES `17.5 µs`, while `3.75 ips` reverts to `NAB`), `Cal Level` (`250`, `320`, `500 nWb/m` re-aligning internal flux sensitivity and headroom together), and `Quality` (`Eco` `4x` pre-integrated RK4 vs. `HQ` `16x` full Jiles-Atherton RK4 solver).
- **Transport & Service Trims:** `Transport` (`Play` / `Stop` motor spin-up and spin-down pitch ramp), `Bias` (`-1` underbias bright/hissy to `+1` overbias warm/rounded), `Flutter`, `Varispeed` (`±3` semitones), `Noise`, `Azimuth` (`-1` to `+1`), `Head Wear`, `Drive Cal`, `Unit` (`1–8`), `Pair` drift, `Match Bypass` autogain, `Mix`, `Color`, `Delta`, and `WD Rack` chassis coupling.

**Studio Use Cases**
- **Mix Bus & Mastering Polish:** `30 ips` or `15 ips`, `High Output` or `Workhorse` stock, `Swiss` or `American` electronics (`320` or `500 nWb/m`) for low-end weight and softened digital transients.
- **Drums, Bass & Electric Guitars:** `15 ips` `Workhorse` on `Tube` or `American` electronics to fatten kick/snare weight and round off fizz on distorted guitars.
- **Lo-Fi Keys, Percussion & Tape Stops:** `7.5` or `3.75 ips` `Old Reel` in `Portable` voicing with `Flutter`, `Head Wear`, and `Transport` stop ramps for warbly vintage character.

---

### WD Tec

**Sonic Character & Archetype**
`WD Tec` solves a Modified Nodal Analysis (`MNA`) passive equalizer at zero latency, combining a `Program EQ Section` (low-frequency boost/attenuate and high-frequency boost/attenuate) and a `Midrange EQ Section` (dual midrange peaks and single mid dip) into one dual-triode recovery amplifier. Because the passive RLC ladder is computed from real nodal impedances and Jiles-Atherton inductor cores, boosting and cutting the same low-frequency band creates the classic simultaneous resonant dip-and-lift curve, while pushing the inductors (`Core`) and tube recovery stage (`Drive`) adds harmonic density right inside the EQ shape.

**Modes, Models & Controls**
- **Passive EQ Sections (`Program` In / `Midrange` In):** Independent bypass switches for the Program section (`20/30/60/100 Hz` low boost/cut, `3/4/5/6/8/10/12/16 kHz` high boost with `Bandwidth` Q, `5/10/20 kHz` high attenuation) and Midrange section (`200/300/500/700/1000 Hz` low-mid peak, `200/300/500/700/1000/1500/2000/3000/4000/5000/7000 Hz` mid dip, `1.5/2/3/4/5 kHz` high-mid peak).
- **`500 Hz Mod`:** Switches the `500 Hz` midrange peak between the classic shared `777 Hz` inductor leg and a dedicated `439 Hz` inductor tap for tighter low-mid focus.
- **Impedance & Feedback Architecture (`Termination` / `NFB`):** `Termination` switches between `600R Term` (classic loaded passive contour and insertion loss), `Unterm` (higher open-circuit level and lifted top-end Q), and `Bridge` (high-impedance bridging feel). `NFB` (`-6 / -3 / Cal / +3 / +6 dB`) adjusts negative feedback around the dual-triode recovery amplifier—trading cleaner linearity for open, harmonic bloom.
- **Routing, Saturation & Banks:** `Channel Mode` (`Linked` / `Dual Mono` / `Mid-Side`), dual `A`/`B` comparison banks, `Core` (`x0.25` to `x4` inductor magnetic flux), `Drive` (`0–24 dB`), `Color` toggle, `Unit` (`1–8`), `Delta`, and `WD Rack` chassis coupling.

**Studio Use Cases**
- **Mix Bus & Mastering Weight:** Simultaneous `60 Hz` or `100 Hz` low boost + attenuate with `10 kHz` or `12 kHz` broad air lift (`600R Term`, `Mid-Side` or `Linked`) for deep, sculpted punch.
- **Kick Drum, Bass & Guitars:** Using `500 Hz Mod` and `Mid Dip` (`300–500 Hz`) to clear boxiness while pushing `Core` for thick inductor saturation.
- **Lead Vocals & Overheads:** `10/12/16 kHz` silky tube top-end boost with negative `NFB` (`-3` or `-6 dB`) for open analog sheen.

---

### WD VCA

**Sonic Character & Archetype**
`WD VCA` is a fixed `49`-sample latency (`2x` FIR oversampled below `88.2 kHz`) stereo VCA bus and track compressor offering three complete VCA detector topologies sharing one gain-cell architecture. Whether tightening a whole mix with classic program-adaptive bus glue, slamming a snare drum with true-RMS transient snap, or tailoring low-end kick energy via weighted sidechain curves, every timing capacitor and gain law is computed directly from circuit behavior.

**Modes, Models & Controls**
- **3 `Model` Topologies:**
  1. **`Console Bus`:** Classic British-desk stereo bus glue with snapped `2 / 4 / 10:1` ratios, stepped `Attack` (`0.1`–`30 ms`), and stepped `Release` (`0.1`–`1.2 s` plus dual-stage `Auto`).
  2. **`RMS Punch`:** True-RMS feed-forward VCA with program-dependent timing, continuous `Ratio` (`1:1` to `100:1`), and selectable `Hard` or `Soft Knee`—built for snappy percussive impact and steady level riding.
  3. **`Thrust Bus`:** Weighted-sidechain VCA bus compressor featuring `Thrust` sidechain tilt (`Norm` flat, `Med` balanced, `Loud` 3 dB/oct rolloff keeping sub-bass from choking the detector), switchable `New (FF)` feed-forward vs. `Old (FB)` feedback topology, `Hard` / `Med` / `Soft` knee, 7-step `Attack` (`0.03`–`30 ms`), continuous `Release` (`0.05`–`3 s`), and stepped stereo `Link` (`IND` to `100%`).
- **`Cell` (`Early Can` vs. `Modern IC`):** Swaps the VCA gain core between vintage canned VCA tolerance/control-feedthrough warmth and cleaner modern integrated-circuit precision.
- **Sidechain & Rear Trims:** `SC HPF` (`Off / 60 / 100 / 200 Hz`), `Ext SC` (DAW sidechain or `'WBCN' v2` Beacon / `WD Outboard` feeds), `D/A Iron` (`18.5 kHz` LPF + `18 Hz` HPF + Permalloy core on the key path), `SC Listen`, `Comp In`, `Auto` autogain, `Feedthrough`, `Symmetry`, `Unit` (`1–8`), and `Delta`.

**Studio Use Cases**
- **Mix Bus & Mastering Glue:** `Console Bus` (`4:1`, `10` or `30 ms` attack, `Auto` release) or `Thrust Bus` (`Med`/`Loud`, `New (FF)`) to lock kick, snare, and vocal energy together.
- **Drum Bus & Snare Punch:** `RMS Punch` (`Hard` knee) or `Thrust Bus` (`Old (FB)`, `Loud` weighting, `10–30 ms` attack) to let transient crack jump forward while squeezing sustain.
- **External Key Ducking & Pumping:** Driving `Ext SC` from `WD Outboard` over `'WBCN' v2` Beacon with `D/A Iron` conditioning for smooth, musical bus movement.

---

### WD XQ

**Sonic Character & Archetype**
`WD XQ` is a zero-latency, four-band parametric and shelving equalizer with selectable analog circuit brains under a single consistent control layout. As you switch between five distinct EQ families, the knobs remain right where you set them while the underlying filter Q scaling, proportional bandwidth laws, transformer headroom, and saturation staging transform beneath your hands. Every band also includes independent dynamic EQ compression, solo monitoring, Mid-Side routing, and a model-constrained `Match EQ` solver.

**Modes, Models & Controls**
- **5 `Family` Architectures:**
  1. **`Precision`:** Surgical, linear digital curves with clean proportional control and zero saturation.
  2. **`Console E`:** Classic musical console parametric curves with asymmetric Q behavior and crisp, forward high-mid bite.
  3. **`Console G`:** Tighter, narrower bell geometry at moderate gains that opens up smoothly for mix-bus polish and transparent surgical sweeps.
  4. **`American Proportional-Q Discrete`:** Proportional-Q curve law that automatically narrows filter bandwidth as boost or cut deepens, paired with discrete op-amp and steel-core harmonic saturation.
  5. **`British Inductor Console`:** Inductor-style shelving and resonant bell contours with rich low-end core bloom and smooth, forgiving upper-mid presence.
- **Filters, Dynamic Bands & Match EQ:** Variable-slope `HPF` & `LPF` (`6 / 12 / 18 / 24 dB/oct`); 4 bands each switchable across `Off`, `Bell`, `Low Shelf`, `High Shelf`, and `Notch`; per-band `DYN` toggle + `Threshold` for frequency-selective dynamic control; per-band `Listen` solo; `Linked` / `Dual Mono` / `Mid-Side` channel modes; dual `A`/`B` comparison banks; and **`Match EQ`** (`Balanced`, `Warm Tape`, `Modern Punch`, `Vocal Air`, or `Captured Ref` via `REF` / `LEARN` / `FIT 0–150%` / `TILT ±6 dB`) solving tonal curves within the active analog family's real physical constraints. Includes `Drive` saturation, `Unit` (`1–8`), and `Delta`.

**Studio Use Cases**
- **Vocal & Guitar Tone Shaping:** `British Inductor Console` for weighty lows and smooth air, or `Console E` with `DYN` engaged at `2.5–4 kHz` to tame harsh vocal grit only when pushed.
- **Drums & Snare Bite:** `American Proportional-Q Discrete` boosting `60–100 Hz` punch and `3–5 kHz` crack with natural proportional tightening and steel-core saturation.
- **Mastering & Reference Matching:** `Console G` or `Precision` in `Mid-Side` mode with `Match EQ` (`FIT 25–45%`) to bring a mix's tonal tilt gently toward a reference curve without surgical over-EQ.

---

## Preview Mode (4 Plugins)

### WD Annihilator

**Sonic Character & Archetype**
`WD Annihilator` is a zero-latency, three-band (or three-lane parallel) distortion processor where Low, Mid, and High bands each run a selectable analog or synthetic nonlinear circuit—while drawing current from one shared internal supply rail. Hit the low band with heavy bass, and the mids and highs sag dynamically from shared rail collapse, tying extreme distortion across the spectrum together into one reactive stage.

**Modes, Models & Controls**
- **8 Active Per-Band `Circuit` Laws (`Low` / `Mid` / `High`):**
  1. **`TRIODE`:** Twin-triode stage with grid blocking (`Supply Voltage` scales plate headroom; `Current Feed` shifts cold-to-hot quiescent bias).
  2. **`IRON`:** Jiles-Atherton hysteresis inside a magnetizing-shunt transformer loop (`Supply Voltage` scales flux headroom; `Current Feed` controls core source stiffness).
  3. **`TAPE`:** Record-path magnetic hysteresis (`Supply Voltage` scales record-amp headroom; `Current Feed` sweeps record bias from bright `0.607x` underbias `+2.50 dB` HF lift to dark `1.647x` overbias `-5.53 dB` rolloff; cubic octave `Drive` taper spans a clean `0.25x` (`<0.06%` THD) floor at `0%` through warm `+2.4 dB` push at noon up to `+24 dB` saturation at `100%`).
  4. **`CLASS A`:** Single-ended `tanh` saturation with even-order residual (`Supply Voltage` scales headroom; `Current Feed` shifts DC-blocked asymmetry).
  5. **`OP-AMP`:** High-slew discrete feedback op-amp stage with hard rail clipping (low `Current Feed` starves HF slew rate; high `Current Feed` introduces thermal gain droop).
  6. **`DIODE`:** Anti-parallel diode clipper (`ADAA` + `2x` residual oversampling below `96 kHz`; `Supply Voltage` scales driver headroom; `Current Feed` tilts branch current and polarity asymmetry).
  7. **`NEGATIVE IRON` (Synthetic):** Sign-inverted magnetizing shunt past the core knee that dynamically blooms and expands low frequencies under drive.
  8. **`QUANTUM RAIL` (Synthetic):** Quantizes the supply rail into `2–16` discrete voltage terraces (`Steps` per band) with `0.5 ms` slew while keeping the audio path continuous for stepped, bit-like analog breakups.
- **Routing & Global Macros:** `Band Routing` switches between `Multiband` (exact-residual 2-pole crossover at `60–800 Hz` / `800–8000 Hz`) and `Parallel` (all three full-range nonlinear residuals summed around one clean carrier). `Channel Mode` offers `Stereo`, `M-S` (`Mid-Side`), `Mid` (`Mid Only`), and `Side` (`Side Only`). Global `Wreck` (`0–100%` loudness-compensated macro drive), `Supply Voltage` (`x0.5–x2`), `Current Feed` (`x0.5–x2`), `Tone` (`±6 dB` post-sum tilt), `Match Bypass` autogain, `Color`, `Mix`, `Unit` (`1–8`), and `Delta`.

**Studio Use Cases**
- **Bass & Sub-Synth Destruction:** `IRON` or `NEGATIVE IRON` on Low, `TAPE` or `TRIODE` on Mid, and `DIODE` on High for sub weight that hits like a wall while upper-mid grit stays articulate.
- **Parallel Drum Bus Saturation:** `Parallel` routing with `OP-AMP` + `CLASS A` + `TAPE` blended at `20–40%` `Mix` for huge harmonic density without losing punch.
- **Experimental Sound Design & Synth Shredding:** `QUANTUM RAIL` (`2–6` steps) in `Mid-Side` or `Side Only` mode to fracture synth pads and industrial percussion.

---

### WD Damper

**Sonic Character & Archetype**
Designed to separate harsh, narrow-band whistles and room rings from broad tonal balance, `WD Damper` measures `-3 dB` prominence width across peaks before applying cut depth—pulling down sharp metallic resonances and nasal hotspots while leaving wide vocal warmth or guitar body boosts intact. You can switch between time-domain Cytomic SVF notches and high-resolution FFT spectral suppression without host latency jumps.

**Modes, Models & Controls**
- **`Mode` (`FILTER` vs. `SPECTRAL`) & Constant Latency:** The plugin reports a fixed constant latency of `max(4095, 200 ms)` samples to the host (for example, `9600` samples at `48 kHz`), so switching between `FILTER` and `SPECTRAL` or sweeping `Lookahead` never triggers a DAW PDC jump:
  - **`FILTER` (Default):** Drives up to `64` minimum-phase `1/24`-octave Cytomic state-variable notches (`Bands 4–64`) directly in the time domain without passing audio through the FFT, using per-sample coefficient interpolation across hops and optional `Lookahead` (`0–200 ms`).
  - **`SPECTRAL`:** Uses a `75%`-overlapping `4096`-sample Hann FFT analyzer/resynthesizer with Lorentzian skirts and causal cepstral minimum-phase reconstruction to suppress pre-echo.
- **Detection & Shaping Controls:** `Depth` (`0` = bit-exact wire to `1` maximum suppression), `Bias` (`0–8 dB`, default `2.5 dB` with adaptive spectral-density scaling), `Focus` (`0.05–0.75 oct`, default `0.33 oct`; above `1/2 oct` widens into broad low-mid bells across `150–550 Hz` for mud/boxiness), `Persist` (`0–8 s` stationary-resonance tracking), `Protect` (`0–1` harmonic pitch protection preserving musical fundamentals), `Attack` (`1–200 ms`), `Release` (`20–4000 ms`), `Low` (`20–2000 Hz`) & `High` (`2–20 kHz`) active frequency boundaries, `Delta` (solo the suppressed resonances), and `Output`.

**Studio Use Cases**
- **Harsh Vocals & Sibilance Control:** `FILTER` mode (`Focus` narrow, `Protect` raised) taming shrill `3–6 kHz` vocal mic peaks without dulling air or flattening body.
- **Cymbal Wash, Snare Ring & Acoustic Guitar Squeaks:** `FILTER` (`Lookahead 10–30 ms`) or `SPECTRAL` targeting piercing metallic overtones while keeping natural stick transient weight.
- **Master Bus & Room-Resonance Cleanup:** Subtle `Depth` (`0.15–0.35`) with long `Persist` gently relaxing congested low-mid room modes without thinning the bassline.

---

### WD Horse Girl

**Sonic Character & Archetype**
`WD Horse Girl` is a zero-latency two-channel coupled EQ and saturation processor for resolving frequency collisions—either blending two tracks together into one cohesive voice or carving room between competing instruments. Link two instances across tracks via shared memory (`Pair A`–`H`) or process `Mid/Side` and `Left/Right` on a single stereo bus, with a bit-exact passthrough when `EQ Glue` and `Sat Glue` are zeroed.

**Modes, Models & Controls**
- **`Axis` (`2-TRK / LO-HI` / `MID / SIDE` / `L / R`):** `2-TRK / LO-HI` links two tracks across `Pair A`–`H` (assigning `Role` `TRK 1 (LO)` vs. `TRK 2 (HI)`) or splits a single stereo track around `Pivot` (`80–600 Hz`); `MID / SIDE` and `L / R` balance stereo components internally.
- **`Mode` (`GLUE` vs. `SEPARATE`):** `GLUE` draws both channels toward shared harmonic and tonal cohesion; `SEPARATE` carves reciprocal space so low-end weight and upper-mid presence stay out of each other's way.
- **6 Coupled Moves (`EQ Glue` `0–100%` / `Sat Glue` `0–100%`):**
  - **EQ Moves:** `OCTAVE` (harmonic octave coupling), `ZIPPER` (interleaved reciprocal notch/boost spacing), and `MOAT` (protective dip carving space around the pivot zone).
  - **Saturation Moves:** `BRIDGE` (cross-coupled harmonic texture), `WINDOW` (spectral saturation balance), and `SAG LOCK` (coupled rail-style dynamic compression between channels).

**Studio Use Cases**
- **Kick & Bass Separation:** `2-TRK / LO-HI` across `Pair A` (`TRK 1 LO` on Kick, `TRK 2 HI` on Bass) in `SEPARATE` mode (`MOAT` + `ZIPPER` + `SAG LOCK`) so sub punch and bass growl sit together without masking.
- **Double-Tracked Guitars & Layered Synths:** `2-TRK / LO-HI` or `L / R` in `GLUE` mode (`OCTAVE` + `BRIDGE`) to fuse stacked parts into one thick wall.
- **Lead Vocal vs. Backing Bed:** `MID / SIDE` in `SEPARATE` mode carving midrange space out of dense stereo pads whenever the center vocal pushes forward.

---

### WD VU

**Sonic Character & Archetype**
Modeled directly on IEC 60268-17 needle mechanics, `WD VU` is a zero-latency, bit-exact passthrough stereo ballistic VU and peak meter bridge. Instead of drawing damped digital bar meters, it solves the physical second-order meter movement (`300 ms` rise to `99%`, `1.25%` overshoot, and end-stop peg bounce restitution) driven by a `4x` oversampled full-wave rectifier and inter-sample peak detector.

**Modes, Models & Controls**
- **`Mode` (`L/R` / `Mono` / `M/S`):** Displays standard left/right stereo channels, summed mono level, or Mid-Side center vs. width balance.
- **Calibration & Display Controls:** `Ref` (`-24` to `-8 dBFS`, default `-18 dBFS` = `0 VU`) aligns gain-staging headroom to studio or mastering standards; `Peak` (`-12` to `0 dBFS`, default `-2 dBFS`) sets the inter-sample peak LED trip threshold; `Lamp` toggles faceplate backlighting; UI `Delta` monitors `L - R` difference; and `Bypass` drops the physical needles to rest.

**Studio Use Cases**
- **Analog Gain-Staging Calibration:** Confirming vocal, drum, and instrument tracks hit `0 VU` (`-18 dBFS`) before feeding nonlinear compressors, preamps, and tape models.
- **Mix Bus Dynamics & Loudness Check:** Monitoring average RMS energy (`0 VU` to `+2 VU` peaks) alongside inter-sample transient hits on the `M/S` or `L/R` needles.

---

## Lab / Preview (4 Plugins)

> *Note: Beginning in v0.9.1, all four modules below ship in the main release archive alongside the rest of the suite.*

### WD 1B

**Sonic Character & Archetype**
Combining a smooth `12 dB` soft-knee LED/LDR resistor divider with a transparent push-pull twin-triode gain stage and wideband Jiles-Atherton transformer (`~0.0588%` nominal THD), `WD 1B` is an all-tube optical compressor running at a fixed `6`-sample latency (`4x`/`2x`/`1x` polyphase IIR oversampled). More open and controllable than vintage fixed-knob optical boxes, it keeps vocal air and sub extension intact while offering fixed, hybrid, or manual attack and release envelopes.

**Modes, Models & Controls**
- **`Timing` (`Fixed` / `Fix / Man` / `Manual`):** `Fixed` locks in classic fixed optical leveling curves; `Fix / Man` combines fixed fast transient attack with manual release shaping; `Manual` gives full independent control over `Attack` and `Release` (`Threshold` `-40` to `0 dBFS`, continuous `2:1` to `10:1` `Ratio`).
- **`Channel Mode` (`Linked` vs. `Dual Mono`):** Operates as a stereo-linked leveler or unlinked dual-mono compressor.
- **Tone & Calibration Controls:** `SC HPF` (`Off / 60 / 100 / 200 Hz`), `Gain` (`-12` to `+30 dB`), `THD` & `Iron` trims for pushing tube/core saturation beyond stock transparency, `Auto` autogain (defaults `On`), `Unit` (`1–8`), `Pair` drift, `Drive Cal`, `Delta`, and `WD Rack` chassis coupling.

**Studio Use Cases**
- **Modern Pop & R&B Lead Vocals:** `Fix / Man` or `Fixed` at `3:1–5:1` for silky, upfront vocal leveling that stays clear and open even under `6–10 dB` of gain reduction.
- **Acoustic Instruments, Piano & Bass:** `Manual` mode with slower attack (`15–30 ms`) letting pick/hammer definition cut through before optical compression rides sustain.
- **Clean Mastering & Submix Leveling:** `Linked` at `2:1` (`SC HPF 60 Hz`) for transparent loudness tightening with gentle push-pull triode sheen.

---

### WD T-Bar

**Sonic Character & Archetype**
Built around matched local-negative-feedback dual-triode stages and wideband Jiles-Atherton iron (`~0.0351%` nominal THD), `WD T-Bar` is a mastering-grade variable-mu compressor with a fixed `192`-sample latency (`2x` FIR oversampled below `88.2 kHz` plus a `1 ms` constant lookahead ring). Where heavy vintage vari-mu limiters often round transients and thicken midrange aggressively, `WD T-Bar` pairs controlled variable-mu curvature with modern attack/release precision, continuously variable sidechain filtering, and optional `1 ms` lookahead to catch fast mastering peaks transparently.

**Modes, Models & Controls**
- **Stepped `Ratio` & Dynamic Knees:** `1.5:1` (`16 dB` ultra-soft mastering knee), `2:1` (`12 dB` knee), `4:1` (`8 dB` knee), and `10:1` (`4 dB` firm limiting knee), driven against an explicit `Threshold` (`-36` to `0 dB`).
- **Timing & Lookahead:** Continuous `Attack` (`0.5–100 ms`), continuous `Release` (`40–3000 ms`) or dual-stage `Auto` release (`80 ms` fast + `1200 ms` slow), and `Lookahead` (`0–1.00 ms`) inside the fixed `192`-sample PDC window.
- **Sidechain & Stereo Topology:** Continuously swept `SC HPF` (`Off`, `20.5–250 Hz`), `SC Tilt` (`-6` to `+6 dB` @ `1 kHz` to bias detector sensitivity toward lows or highs), `Channel Mode` (`Linked` / `Dual Mono` / `Mid-Side`), `THD` & `Iron` trims, `Auto` autogain (defaults `On`), `Unit` (`1–8`), `Delta`, and `WD Rack` chassis coupling.

**Studio Use Cases**
- **Final Mix Bus & Mastering Compression:** `1.5:1` or `2:1` (`Mid-Side` or `Linked`, `Auto` release, `SC HPF` `45–80 Hz`, `Lookahead` `0.5–1.0 ms`) for wide, deep stereo glue without transient dulling.
- **Acoustic Ensembles, Jazz & Classical Stems:** `1.5:1` with subtle `THD`/`Iron` to bring cohesive room bloom and low-level weight without audible clamping.
- **Controlled Drum & Vocal Bus Glue:** `4:1` with negative `SC Tilt` (ignoring harsh hi-hats) to keep the groove anchored.

---

### WD Berth

**Sonic Character & Archetype**
`WD Berth` is a zero-latency, FFT-free 24-band Cytomic state-variable dynamic spectral spacer that carves real-time room for a lead element inside a competing bed. Using parallel proportional bands rather than FFT windows avoids pre-ringing and latency completely, allowing one sidechain key—either a standard DAW key, `'WBCN' v2` Beacon / `WD Outboard` feed, or a shared `BerthShm` bus (`Bus A`–`H`)—to duck only the frequency bands where the key signal currently peaks.

**Modes, Models & Controls**
- **`Role` (`Carve` vs. `Send Key`):** `Carve` ducks the local track dynamically against the incoming key; `Send Key` acts as a bit-exact `0.00e+00` passthrough broadcaster feeding one-to-many `Carve` receivers on a shared `Bus A`–`H`.
- **`Source` (`Ext SC` vs. `Bus A..H`):** Receives from external DAW sidechain (`Ext SC`, or `'WBCN' v2` Beacon / `WD Outboard`) or a named internal `BerthShm` bus (`A`–`H`).
- **`Target` (`Stereo` / `Mid` / `Side`):** Confines spectral carving exclusively to the stereo image, center `Mid` channel (protecting stereo width), or `Side` channels (keeping center punch intact).
- **Spectral & Key Controls:** `Amount` (`0–100%`, up to `-18 dB` band cut), `Selectivity` (`0%` broad `Q = 1.4` to `100%` narrow `Q = 4.0`), `Low Cut` (`20–5000 Hz`) & `High Cut` (`100–20000 Hz`) boundary curtains, `Attack` (`0.5–50 ms`), `Release` (`20–600 ms`), `Key Trim` (`±24 dB`), `Link` (`0–100%`), `SC Iron` (`18.5 kHz` LPF + `18 Hz` HPF + Permalloy core on the key), `Color` (VCA gain-cell residual), `Key Listen`, `Freeze`, `Mix`, `Delta`, and `Output`.

**Studio Use Cases**
- **Lead Vocal vs. Dense Guitars/Synths:** Dropping `Send Key` on the Lead Vocal (`Bus A`) and `Carve` (`Target: Mid` or `Stereo`, `Selectivity 50–70%`) on the Instrument Bus so guitars duck specifically around active vocal formants.
- **Kick Drum vs. Sub Bass:** `Low Cut` / `High Cut` narrowed to `30–250 Hz` (`Attack 0.5–2 ms`) carving transient punch into a sustained bass track without pumping upper bass harmonics.
- **Broadcast Voiceover Ducking:** `Send Key` on dialogue carving a music bed dynamically with zero latency for live or post-production mixes.

---

### WD Outboard

**Sonic Character & Archetype**
Pairing a zero-latency mastering converter and analog line-stage simulator (`2x` IIR residual oversampling below `88.2 kHz`) with a lock-free 64-slot `'WBCN' v2` Beacon key broadcaster, `WD Outboard` handles two distinct jobs in a mix setup. Print vintage magnetic converter iron, discrete ladder nonlinearity, or transparent AD soft-clipping onto stems and master buses—or run it as a bit-exact calibration bridge publishing zero-latency key audio to `WD VCA`, `WD Duress`, and `WD Berth`.

**Modes, Models & Controls**
- **4 Converter & Color `Flavors`:**
  1. **`Reference Clean`:** Bit-exact `0.00e+00` passthrough when `Input` and `Output` trims sit at `0 dB` (`Drive`, `Ceiling`, and `Mix` inactive)—acting as a pure digital calibration converter or transparent `'WBCN' v2` Beacon transmitter.
  2. **`Nickel / Iron`:** Shapes response through a gentle `42 Hz` low-end lift (`+0.45 dB`) and `14.5 kHz` air shelf (`-0.35 dB`) into coupled Jiles-Atherton hysteresis driven by `1/f` low-frequency flux and a soft `tanh` headroom knee (`0.85 * Ceiling`). Turning `Color` off reduces the stage to a clean hard ceiling clamp.
  3. **`90s R-2R`:** Models classic analog anti-aliasing warmth (`+0.30 dB @ 9.5 kHz` + `12 dB/oct` LPF), deterministic periodic MSB differential nonlinearity (`DNL`) ladder residuals, and asymmetric op-amp buffer clipping for forward midrange punch and vintage converter bite.
  4. **`Soft-Clip AD`:** Blends `tanh` saturation into a closed-form ADAA1 piecewise-quadratic clipper (`Color` adds even-harmonic tube asymmetry), lowering ceiling slightly under heavy `WD Rack` chassis sag.
- **`'WBCN' v2` Beacon TX & Global Controls:** `TX Enable` (publishes stereo audio onto the shared-memory `'WBCN' v2` Beacon bus with customizable publish names; stays active even when `Power` is bypassed), `TX Tap` (`Post-AD` post-nonlinear converter output vs. `Pre-FX` raw pre-input feed), `Input` (`±18 dB`), `Drive` (`0–100%`), `Ceiling` (`-6` to `0 dBFS`), `Mix` (`0–100%`), `Output` (`±18 dB`), `Color`, `Delta`, `Unit` (`1–8`), `Chassis` (`1–4`), `Supply Draw`, and `Output Guard`.

**Studio Use Cases**
- **Master Bus Converter Weight & Peak Shaving:** `Soft-Clip AD` (`Ceiling -0.3` to `-1.0 dBFS`) to trim stray snare/kick overs before a mastering limiter, or `Nickel / Iron` at `25–45%` `Drive` for cohesive transformer depth.
- **Forward Drum & Vocal Stems:** `90s R-2R` bringing snappy midrange presence and subtle converter grit to drums, synths, and vocals.
- **Zero-Latency Cross-Track Beacon Keying:** Inserting `WD Outboard` (`Reference Clean`, `TX Enable` on) on a kick, snare, or vocal track to feed `WD VCA`, `WD Duress`, or `WD Berth` across any bus routing.
