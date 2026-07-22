# WD Rack — User Guide

*How the chassis works, what slot order means, and how to chain the modules.
Written for users; the engineering specs live in the development repo.*

---

## 1. The one thing to understand first

**WD Rack is not an effects chain.** Audio never flows through it from module
to module. Every Werewolf module stays a normal plugin on its own track, doing
its own job in its own insert slot. What the rack adds is the *chassis they
would have shared* if they were hardware: one power supply, one strip of
copper feeding the slots, and the capacitive bleed between neighboring cards.

So there are two different "orders" in your session, and they do different
things:

- **Insert order on a track** — which plugin processes before which. This is
  normal DAW signal flow; the rack has nothing to do with it. See §6 for
  chaining advice.
- **Slot order in the rack** — where each module physically sits in the
  chassis. This never changes signal routing. It changes *who bleeds into
  whom* (neighbors couple) and *who starves first* (the far end of the bus
  bar sees a softer rail). See §4.

If you load the rack and hear the mix change, that is the chassis: shared
supply sag, slot bleed, rectifier hum. Remove the rack (or set Crosstalk to
zero) and every module returns to its exact standalone behavior, bit for bit.

## 2. Quick start

1. Load your Werewolf modules on the tracks where they belong, exactly as you
   always would.
2. Load **WD Rack** anywhere — its own track, the master, wherever. Audio
   through the rack's own track passes untouched; it is a coordinator, not a
   processor.
3. That's it. Frame 1 is the default on every module's rear panel and on the
   rack, so everything meets on the same chassis automatically. The slot map
   on the rack's face fills in as the modules register, with your DAW's track
   names and colors.
4. Turn the **Crosstalk** knob to taste. Zero is a hard bypass. Noon is a
   healthy vintage chassis. The top third is a maintenance nightmare, on
   purpose.
5. Reorder slots with the ▲▼ buttons if you want particular modules to be
   neighbors (or not). Watch the Shared Supply Rail meter breathe while the
   mix plays.

## 3. What the chassis shares

Four physical mechanisms, all derived from the same declared per-module
current draws — there are no per-slot faders to manage.

**The shared supply rail.** Every module declares how much current it pulls
at idle and under program. Loud moments on hungry modules drag one shared
rail down for everyone, and each module's own circuitry decides how it
reacts — sag makes tube stages grab a little sooner, drops a compressor's
knee, slows a tape motor. It is the *hits* that dip the rail: a rack full
of idle gear barely loads the supply (it holds its quiescent current by
spec), but transient program current above idle pulls the rail down on
every hit and lets it recover in the gaps — that breathing is the sound. The rail meter on the rack's face shows it live:
1.000 is a rested supply. The **PSU Sag** knob scales the depth: ×1 is the
honest measured supply, below is stiff modern regulation, ×8 is a dying
transformer — and past ×8 the supply stops holding any line at all, up to a
×32 stop where every hit browns the whole rack out. A starving supply loses
gain, not just headroom: every module's output level rides the rail (−3 dB
at half rail, −12 dB at the ×32 floor), so when the drums slam the chassis,
everything else on it audibly gives way. Sag is its own axis — the
Crosstalk knob no longer scales it (though zero Crosstalk still switches
the whole chassis off).

**Slot bleed.** Adjacent cards in a real chassis couple capacitively, so
each module hears a bright, high-passed sliver of its neighbors — edge and
air, never bass. The Crosstalk knob spans a believable −70 to −45 dB
aggregate across its lower two-thirds, then sprints to obvious lo-fi.
**Chassis Character** picks the flavor: Console is polite (only the highest
frequencies couple, stiffer supply), Broadcast is a 1950s transmitter rack
(bleed reaches further down, supply sags deeper).

**Rectifier ripple.** The chassis caps only charge at the mains peaks, so a
working rack's rail wobbles at twice mains — 120 Hz on a 60 Hz wall, 100 Hz
on 50 — and a trace of hum leaks into every powered module, more the harder
its neighbors pull. ×1 is the honest cap bank (hum down around −70 dB FS
under load), 0 is perfect modern filtering, high is a bank of dried-out cans.

**The bus bar.** The supply enters at slot 1 and everyone's current flows
along one copper strip, so the far end of the chassis sees a slightly
starved rail when the rack is working. ×1 is honest copper (a few percent at
the far end of a full chassis), 0 is star wiring — position stops mattering —
and high is a corroded strip that genuinely starves the last slots.

## 4. Slot order: what it changes, what it doesn't

The slot map is **physical adjacency**, not signal flow. Reordering slots:

- changes *which modules bleed into each other* — only immediate neighbors
  couple, so putting the drum bus card next to the vocal card lets the vocal
  chain hear the drums' edge, and moving it away silences that;
- changes *who sits close to the power inlet* — with the Bus Bar above zero,
  slot 1 gets the stiffest rail and the last occupied slot starves first.
  Put the module whose sag character you want most on the far end.

It does **not** change what order anything is processed in. Two modules on
different tracks were never in series and still aren't.

Practical recipes:

- Want maximum interaction between two specific chains? Make their modules
  neighbors and raise Crosstalk past noon.
- Want one module to pump hard while the rest stay composed? Park it in the
  last slot and bring the Bus Bar up.
- Want the vibe without any surprises? Crosstalk just below noon, everything
  else at ×1, and stop thinking about it.

## 5. LIVE, TAPE, IDLE — and why bounces still work

Each slot shows a state lamp:

- **LIVE** — that module is rendering right now, in this pass.
- **TAPE** — the slot isn't rendering (its track is frozen, or you're
  bouncing a different track) and its contribution replays from the last
  played pass.
- **IDLE** — powered but transport-stopped; only its idle character loads
  the rail.

Everything the chassis computes is keyed to the **host timeline**, never the
clock on the wall. That is why a one-track-at-a-time bounce still hears the
whole rack: the other slots' supply history replays from tape, and a bounced
track comes out bit-identical to what you heard in the full mix.

## 6. Frames: running more than one chassis

The **Frame** selector (1–4, on the rack's face and on every module's rear
panel) decides which chassis a module lives in. Only gear dialed to the same
frame meets. Frame 1 everywhere just works out of the box.

Reach for frames 2–4 when you want:

- two separate chassis in one session — say, a Console frame for the mix bus
  gear and a Broadcast frame for the drum room;
- two open projects that should *not* share a power supply.

A module dialed to a frame with no rack in it simply runs standalone.

## 7. Chaining order: using the modules in series

This is the other "order" — normal insert order on a track — and it is where
taste lives. There are no wrong answers, but there are hardware-honest
starting points. The suite's own fixed-topology products encode the classic
one: **WD Strip** wires preamp → EQ → compressor, the console channel order
(with a switch to put the compressor before the EQ instead).

General laws worth stealing:

- **Preamp first.** WD Pre is an input stage by nature — its five laws are
  about what happens to a signal *entering* the chain. Drive it for color,
  then everything downstream reacts to that color.
- **Corrective EQ before compression, sweetening EQ after.** Cut the boom
  and rumble (WD XQ's high-pass, or a surgical band) before a compressor so
  it doesn't pump on frequencies you're about to remove. Broad musical
  strokes (WDTec's program curves, XQ's air band) sit naturally after.
- **Fast catch before slow ride.** The classic serial-compression pair puts
  the fast unit first to catch peaks (WD FET, or WD Duress on its quicker
  curves) and the slow smooth unit after to ride the level (WD Opto, WD Mu).
  WD Clamp packages exactly this: three compressor slots in one box, on one
  shared supply, in any of the six orders.
- **Bus glue late.** WD VCA is the mix-bus specialist; it usually sits at or
  near the end of a bus chain, before tape.
- **Tape near the end.** WD Tape's head-chain saturation and compression
  respond to everything that came before; it is the "print it" stage.
  WD AX (exciter) works well right after tape, restoring the top edge the
  medium rounds off — that is what it was invented for.
- **Echo where you'd patch it.** WD Echo is a send effect first (its spatial
  tape medium loves a dedicated return track), an insert only when you want
  the whole signal through the loop.
- **WD Delta wraps anything.** Put the SEND at the front of a chain and the
  RETURN at the end to hear exactly what the chain between them is doing —
  it aligns across any plugins, sample-exact.

Two worked examples:

**Vocal track:** WD Pre (73 law, a little iron) → WD FET (fast, catching
2–3 dB) → WD Opto (riding another 3–4 dB) → WDTec (program low + air).

**Mix bus:** WD XQ (gentle corrective, high-pass the mud) → WD VCA (Console
Bus, 1–2 dB of glue) → WD Tape (the print stage) → WD AX (a breath of edge).

And remember the two orders compose: those same plugins, in that insert
order, can *also* live together in a rack frame — the chain defines who
processes first, the chassis defines who shares power and bleed while they
do it.

## 8. Practical notes

- **Turning it off.** Crosstalk at zero is a hard bypass of the whole
  chassis; removing the rack does the same. Either way, modules revert to
  exact standalone behavior — the chassis is additive, never baked in.
- **CPU.** The coordinator itself is a bookkeeper — the rail math is a few
  envelope followers over shared memory. The audible work happens inside
  the modules you already loaded.
- **Defaults are honest.** ×1 on Sag, Ripple, and Bus Bar are the measured
  hardware values, not "off". The knobs above ×1 are deliberately too far —
  that is the house three-regime law: nominal is honest, mid-travel is
  musical, the stops are an effect, proudly.
- **The UI window can be resized** by dragging its corner; the faceplate
  scales to fit.

*Questions this guide doesn't answer belong in the issue tracker — module
deep-dives live in the per-module design notes.*
