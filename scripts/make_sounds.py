"""Generate the alert sounds in sounds/. Run: python3 scripts/make_sounds.py"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "sounds"


def tone(freq, ms, volume=0.6):
    n = int(RATE * ms / 1000)
    fade = int(RATE * 0.008)  # short fade in/out to avoid clicks
    for i in range(n):
        env = min(1.0, i / fade, (n - i) / fade)
        yield volume * env * math.sin(2 * math.pi * freq * i / RATE)


def silence(ms):
    yield from [0.0] * int(RATE * ms / 1000)


def write(name, *parts):
    samples = [s for part in parts for s in part]
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(s * 32767)) for s in samples))


# Corner closure: two short high beeps.
write("corner.wav", tone(1320, 110), silence(70), tone(1320, 110))
# Full closure: three longer descending tones.
write("full.wav", tone(880, 220), silence(60), tone(660, 220), silence(60), tone(440, 380))
# Corner/card markets removed (Corners/Cards tab hidden): three quick rising chirps.
write("removed.wav", tone(660, 80), silence(40), tone(990, 80), silence(40), tone(1480, 120))
# Match ending (all but the last market removed, then that one suspended): ding-dong, twice.
write("ending.wav", tone(784, 300), tone(523, 450), silence(150), tone(784, 300), tone(523, 600))
