"""Assemble the silent demo: trim the raw recording to when the hero appears, encode, prepend the intro,
and write a narration timing sheet from the recorder's log.

  python scripts/assemble_demo.py                 -> data/cache/demo/airgap_demo_silent.mp4 + narration_timing.md
  python scripts/assemble_demo.py voice.m4a       -> also muxes the narration into airgap_demo_final.mp4
"""
import json, re, subprocess, sys, pathlib
D = pathlib.Path("data/cache/demo"); LOG = pathlib.Path("data/cache/record.log")
FF = "ffmpeg"

def run(*a): subprocess.run([FF, "-y", "-loglevel", "error", *a], check=True)

timing = json.loads((D / "timing.json").read_text())
trim = timing["trimStart"]
# 1) demo body: trim + encode
run("-ss", f"{trim:.2f}", "-i", str(D / "raw.webm"), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", str(D / "body.mp4"))
# 2) concat intro + body
(D / "concat.txt").write_text(f"file '{(D / 'intro_cut.mp4').resolve().as_posix()}'\nfile '{(D / 'body.mp4').resolve().as_posix()}'\n")
run("-f", "concat", "-safe", "0", "-i", str(D / "concat.txt"), "-c", "copy", str(D / "airgap_demo_silent.mp4"))
intro_len = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(D / "intro_cut.mp4")]).decode().strip())
total = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(D / "airgap_demo_silent.mp4")]).decode().strip())

# 3) narration sheet from the log (segment start times + intro offset)
marks = []
for line in LOG.read_text().splitlines():
    m = re.match(r"\s*([\d.]+)s\s+(hero|my air|best hours|hindi|map|accuracy|placement|method|close|end)$", line)
    if m: marks.append((float(m.group(1)) + intro_len, m.group(2)))
def mmss(s): return f"{int(s // 60)}:{int(s % 60):02d}"
lines = ["# Narration timing (read each block when the video reaches its time)", "", f"Video length: {mmss(total)}. Intro title card: 0:00–{mmss(intro_len)} (silence, or just breathe).", ""]
for t, name in marks:
    lines.append(f"- **{mmss(t)}** → {name}")
(D / "narration_timing.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print(f"\nsilent video: {D / 'airgap_demo_silent.mp4'}  ({total:.1f}s)")

# 4) optional mux with narration
if len(sys.argv) > 1:
    voice = sys.argv[1]
    run("-i", str(D / "airgap_demo_silent.mp4"), "-i", voice, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(D / "airgap_demo_final.mp4"))
    print(f"final: {D / 'airgap_demo_final.mp4'}")
