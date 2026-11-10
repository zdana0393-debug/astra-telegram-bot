"""Keep historical generated review artifacts intact while running their original suites."""
from pathlib import Path
import json, shutil, sys
mode, directory=sys.argv[1:]
root=Path(__file__).resolve().parent.parent
snapshot=Path(directory)
files=['ASTRA_2_3B_METRICS.json','ASTRA_2_3B_EDITORIAL_SAMPLES.md','ASTRA_2_4A_HISTORY_EXAMPLES.md','ASTRA_2_4A_METRICS.json','ASTRA_2_4_RELEASE_METRICS.json','ASTRA_2_4_ECONOMY_OPTIONS.md','ASTRA_2_4_ECONOMY_OPTIONS.json','ASTRA_2_4_ECONOMY_SIMULATION.md','ASTRA_2_4_UI_EXAMPLES.md','ASTRA_2_4_METRICS.json','ASTRA_2_4_TASK_01_SCREENS.md','ASTRA_2_4_TASK_01_METRICS.json']
if mode=='save':
 for name in files:shutil.copyfile(root/'docs'/name,snapshot/name)
elif mode=='restore':
 for name in files:
  if (snapshot/name).exists():shutil.copyfile(snapshot/name,root/'docs'/name)
else:raise SystemExit('Unknown artifact action')
