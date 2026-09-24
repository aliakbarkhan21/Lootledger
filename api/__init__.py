"""Makes the repo root (where db.py, finance.py, bot.py, importer.py, demo.py
and rates.py live, untouched) importable from every module in this package."""
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
