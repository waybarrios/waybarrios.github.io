"""Export audited experiment data for the static CUDA blog, without machine identifiers."""
import argparse
import csv
import gzip
import hashlib
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DEST = SITE / "blog/exact-cuda-projections/data"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_bound(root, reference):
    path = (root / reference["path"]).resolve()
    if not path.is_relative_to(root) or sha(path) != reference["sha256"]:
        raise ValueError(f"Audited source changed: {reference['path']}")
    return json.loads(path.read_text())


def point(case, *, family, profile, dtype, shape_passed, source_sha, summary=None):
    s = summary or case
    interval = s["ci95_pct"]
    selected = "custom" if family == "native" else case["selected"]
    custom = case["methods"][selected]["median_us"]
    baseline = s["best_vendor_us"]
    return {"family": family, "profile": profile, "dtype": dtype, "seed": case["seed"],
            "shape": case["shape_mnk"], "tensor": case.get("weight_tensor"), "layer": case.get("layer"),
            "config": case.get("config", selected), "gain": s["time_saved_pct"],
            "low": interval[0] if interval else None, "high": interval[1] if interval else None,
            "vendor": s["best_vendor"], "baseline_us": baseline, "custom_us": custom,
            "saved_us": baseline - custom if baseline is not None else None,
            "aa": s["aa_time_saved_pct"], "case_passed": bool(case.get("accepted_10pct_target", s["passes_10pct_gate"])),
            "shape_passed": shape_passed, "source_sha256": source_sha}


def main(source):
    root = Path(source).resolve()
    data = {"schema": 1, "date": "2026-10-25", "device": "RTX 3070 Ti Laptop GPU",
            "architecture": "SM86", "gpu_state": "stock", "memory_clocks": ["810 MHz"],
            "power_condition": "AC connected in both system power profiles", "native": [],
            "checkpoint": [], "energy_savings_validated": False, "unlocked_comparison": "pending",
            "sources": [], "native_profiles": []}
    raw_export, all_rows = [], []
    native_identity = None
    for profile in ("performance", "battery"):
        paths = [root / f"results/native-precision-{profile}-{dtype}-evidence-r1.json"
                 for dtype in ("fp32", "fp16", "bf16")]
        if not all(path.exists() for path in paths):
            if profile == "performance":
                raise ValueError("All three Performance cohorts are required")
            continue
        data["native_profiles"].append(profile)
        for dtype, path in zip(("fp32", "fp16", "bf16"), paths):
            cohort = json.loads(path.read_text())
            if (cohort.get("status") != "complete" or cohort.get("kind") != "native-precision-evidence"
                    or cohort["seeds"] != [971, 977, 983]):
                raise ValueError("Native data require complete three-process audits")
            if native_identity is None:
                native_identity = cohort["identity"]
            if cohort["identity"] != native_identity:
                raise ValueError("Native source/runtime/device identity differs across cohorts")
            shapes = {tuple(s["shape_mnk"]): s["accepted_10pct"] for s in cohort["shapes"]}
            data["sources"].append({"name": path.name, "sha256": sha(path)})
            for reference in cohort["artifacts"]:
                raw = load_bound(root, reference)
                if raw.get("kind") != "native-precision-projection":
                    continue
                for case in raw["cases"]:
                    row = point(case, family="native", profile=profile, dtype=dtype,
                                shape_passed=shapes[tuple(case["shape_mnk"])] ,
                                source_sha=reference["sha256"], summary=case["summary"])
                    data["native"].append(row)
                    all_rows.append(row)
                    raw_export.append({**row, "copies": case["copies"], "raw_ring_bytes": case["raw_ring_bytes"],
                                       "vendor_routes": case["vendor_routes"], "methods": case["methods"]})
    for output in ("bf16", "fp32"):
        path = root / f"results/compressed-performance-{output}-evidence-r2.json"
        cohort = json.loads(path.read_text())
        if cohort.get("kind") != "compressed-dispatch-evidence" or cohort.get("status") != "complete":
            raise ValueError("Checkpoint data require the complete audited cohort")
        primary = set(cohort["primary_shapes"])
        audited_cases = {(c["seed"], c["weight_tensor"], tuple(c["shape_mnk"])): c for c in cohort["cases"]}
        data["sources"].append({"name": path.name, "sha256": sha(path)})
        group_rows = []
        for reference in cohort["inputs"]["reports"]:
            raw = load_bound(root, reference)
            for case in raw["cases"]:
                key = ",".join(map(str, case["shape_mnk"]))
                row = point(case, family="checkpoint", profile="performance", dtype=output,
                            shape_passed=cohort["shapes"][key]["kernel_gate_passed"], source_sha=reference["sha256"])
                row["case_passed"] = audited_cases[(case["seed"], case["weight_tensor"], tuple(case["shape_mnk"]))]["kernel_gate_passed"]
                row["primary"] = key in primary and case["role"] == "held-out"
                group_rows.append(row)
                all_rows.append(row)
                raw_export.append({**row, "copies": case["copies"], "raw_ring_bytes": case["raw_ring_bytes"],
                                   "vendor_routes": case["vendor_routes"], "methods": case["methods"]})
        if len(group_rows) != 396 or sum(row["primary"] for row in group_rows) != 27:
            raise ValueError("Checkpoint grid must retain all 396 cases and all 27 primary cases")
        data["checkpoint"].extend(group_rows)
    for name in ("kv-pair-performance-evidence-r1.json", "kv-large-composition-evidence-r1.json"):
        path = root / "results" / name
        data["sources"].append({"name": name, "sha256": sha(path)})
    DEST.mkdir(parents=True, exist_ok=True)
    targets = [DEST / name for name in ("results.json", "measurements.csv", "timing-rounds.json.gz", "manifest.json")]
    if any(path.exists() for path in targets):
        raise ValueError("Preserve the existing blog data snapshot")
    targets[0].write_text(json.dumps(data, separators=(",", ":")) + "\n")
    fields = ("family", "profile", "dtype", "seed", "shape", "tensor", "config", "gain", "low", "high",
              "baseline_us", "custom_us", "saved_us", "aa", "case_passed", "shape_passed", "source_sha256")
    with targets[1].open("x", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    with gzip.open(targets[2], "wt") as handle:
        json.dump({"kind": "klab-timing-snapshot", "schema": 1,
                   "scope": "Exported raw timing rounds and numerical diagnostics; original full-report SHA256 retained per case. Machine identifiers and paths omitted.",
                   "cases": raw_export}, handle, separators=(",", ":"))
    targets[3].write_text(json.dumps({"kind": "klab-blog-data-manifest", "date": data["date"],
        "files": [{"name": p.name, "sha256": sha(p), "bytes": p.stat().st_size} for p in targets[:3]],
        "exporter_sha256": sha(Path(__file__)), "native_cases": len(data["native"]),
        "checkpoint_cases": len(data["checkpoint"]), "original_cohorts": data["sources"]}, indent=2) + "\n")
    print(json.dumps({"native_cases": len(data["native"]), "checkpoint_cases": len(data["checkpoint"]),
                      "profiles": data["native_profiles"], "files": [str(p.relative_to(SITE)) for p in targets]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    main(parser.parse_args().source)
