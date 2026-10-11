"""Build the final demo video: intro + one Ken-Burns clip per narration segment (duration = audio), narration muxed.

  python scripts/build_video.py  -> data/cache/demo/airgap_demo_final.mp4
"""
import json, pathlib, subprocess
D = pathlib.Path("data/cache/demo"); SHOTS = D / "shots"; TTS = D / "tts"; CLIPS = D / "clips"; CLIPS.mkdir(exist_ok=True)
segs = json.load(open("scripts/narration.json", encoding="utf-8"))
dur = json.load(open(TTS / "durations.json"))
FPS = 30
W, H = 1920, 1080

def run(*a):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)

# Camera moves, alternating so consecutive clips don't look identical.
MOVES = [
    "z='min(zoom+0.0006,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",                 # slow push in, centre
    "z='1.08-0.0005*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",                         # slow pull out
    "z='min(zoom+0.0005,1.08)':x='(iw-iw/zoom)*on/({n})':y='ih/2-(ih/zoom/2)'",             # push in, pan right
    "z='min(zoom+0.0005,1.08)':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/({n})'",             # push in, pan down
]
# where to look within a shot: (focus x, focus y) as fractions, used to bias the pan
list_file = D / "concat_final.txt"
lines = [f"file '{(D / 'intro_cut.mp4').resolve().as_posix()}'"]
for i, s in enumerate(segs):
    d = dur[s["id"]] + 0.2           # small breath after each line
    n = int(round(d * FPS))
    img = SHOTS / f"{s['shot']}.png"
    if not img.exists():
        raise SystemExit(f"missing shot {img}")
    move = MOVES[i % len(MOVES)].replace("{n}", str(n))
    out = CLIPS / f"{s['id']}.mp4"
    run("-loop", "1", "-framerate", str(FPS), "-i", str(img), "-i", str(TTS / f"{s['id']}.trim.m4a"),
        "-filter_complex", f"[0:v]scale=2400:-1,zoompan={move}:d={n}:s={W}x{H}:fps={FPS},format=yuv420p[v]",
        "-map", "[v]", "-map", "1:a", "-t", f"{d:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", str(out))
    lines.append(f"file '{out.resolve().as_posix()}'")
    print(f"clip {s['id']} {d:.1f}s")

# intro has no audio track; give it silent AAC so concat streams match
run("-i", str(D / "intro_cut.mp4"), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", str(D / "intro_a.mp4"))
lines[0] = f"file '{(D / 'intro_a.mp4').resolve().as_posix()}'"
list_file.write_text("\n".join(lines) + "\n")
run("-f", "concat", "-safe", "0", "-i", str(list_file), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(D / "airgap_demo_final.mp4"))
total = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(D / "airgap_demo_final.mp4")]).decode().strip())
print(f"FINAL {D / 'airgap_demo_final.mp4'}  {int(total // 60)}:{int(total % 60):02d}")
