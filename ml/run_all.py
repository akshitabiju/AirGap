"""Run the whole AirGap pipeline end to end (re-runnable; all fetches are cached).

    python ml/run_all.py            # everything
    python ml/run_all.py --no-fetch # skip network steps, retrain + republish
"""
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
STEPS = [
    ("fetch_openaq.py", []), ("fetch_features.py", ["stations"]), ("fetch_features.py", ["districts"]),
    ("train.py", []), ("predict_districts.py", []), ("placement.py", []),
]
if "--no-fetch" in sys.argv:
    STEPS = STEPS[3:]

t0 = time.time()
for script, args in STEPS:
    print(f"\n=== {script} {' '.join(args)} ===", flush=True)
    r = subprocess.run([sys.executable, str(HERE / script), *args], cwd=HERE.parent)
    if r.returncode != 0:
        sys.exit(f"{script} failed with code {r.returncode}")
print(f"\nPipeline finished in {time.time() - t0:.0f}s")
