"""Extract only the reviewed aggregate scores from Epoch AI's pinned CC BY 4.0 archive."""
import csv
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

ARCHIVE_SHA256 = "1f488dfd7e8f8a202efc16e792da93c35ebac431f5ee73f55b9d86b052302cf2"
CHECKPOINTS = {
    "gpt-4o-2024-08-06": "openai/gpt-4o-2024-08-06",
    "gpt-4o-2024-05-13": "openai/gpt-4o-2024-05-13",
    "gpt-4o-2024-11-20": "openai/gpt-4o-2024-11-20",
    "gpt-4o-mini-2024-07-18": "openai/gpt-4o-mini-2024-07-18",
    "gemma-2-27b-it": "google/gemma-2-27b-it",
    "Llama-3.1-70B-Instruct": "meta-llama/llama-3.1-70b-instruct",
    "Llama-3.3-70B-Instruct": "meta-llama/llama-3.3-70b-instruct",
    "qwen2.5-72b-instruct": "qwen/qwen-2.5-72b-instruct",
    "mistral-large-2407": "mistralai/mistral-large-2407",
    "phi-4": "microsoft/phi-4",
}
SELECTION = {
    "gpqa_diamond.csv": "2025-01-27",
    "otis_mock_aime_2024_2025.csv": "2025-02-25",
}

archive = Path(sys.argv[1]).read_bytes()
if hashlib.sha256(archive).hexdigest() != ARCHIVE_SHA256:
    raise SystemExit("Epoch archive SHA-256 mismatch.")

cohorts = []
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    for filename, date in SELECTION.items():
        sheet = csv.DictReader(io.StringIO(bundle.read(filename).decode("utf-8-sig")))
        rows = [row for row in sheet if row["Started at"].startswith(date + "T")]
        selected = []
        for row in rows:
            name = row["Model version"]
            if name not in CHECKPOINTS:
                continue
            if not row["mean_score"] or not row["Log viewer"]:
                raise SystemExit("Missing data for a reviewed checkpoint.")
            selected.append({
                "sourceModel": name, "checkpoint": CHECKPOINTS[name],
                "scoreFraction": row["mean_score"], "sourceUrl": row["Log viewer"],
            })
        if len(selected) != 8 or len({row["checkpoint"] for row in selected}) != 8:
            raise SystemExit("Unexpected cohort membership.")
        cohorts.append({
            "file": filename, "date": date,
            "unmappedModels": sorted(row["Model version"] for row in rows if row["Model version"] not in CHECKPOINTS),
            "rows": selected,
        })

print(json.dumps({"archiveSha256": ARCHIVE_SHA256, "cohorts": cohorts}, indent=2))
