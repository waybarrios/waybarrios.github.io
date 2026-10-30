"""Export the measured results behind the "small ops" blog post into one compact JSON file.

Every number in the post's charts comes from a result file in /code/way/research/l2-prefetch (or the P5-regime
native-precision cohort in /code/way/results); nothing is typed in by hand except the copy-bandwidth probe, whose
two readings are recorded in research-log.md.
"""
import hashlib
import json
import math
import re
from pathlib import Path

LAB = Path("/code/way")
RES = LAB / "research/l2-prefetch"
OUT = Path(__file__).resolve().parents[1] / "blog/small-ops-l2-prefetch/data"


def load(path):
    return json.loads(Path(path).read_text())


def geomean_saving(ratios):
    return 100 * (1 - math.exp(sum(map(math.log, ratios)) / len(ratios)))


def regime():
    """Same frozen custom kernels, P5 (nvidia-powerd on) vs P0 (stopped)."""
    p0 = {(r["dtype"], tuple(r["shape"])): r for r in load(RES / "data/p0_rebaseline.json")}
    rows = []
    for dt in ("bf16", "fp16", "fp32"):
        p5 = load(LAB / f"results/native-precision-performance-{dt}-971-r1.json")
        for c in p5["cases"]:
            shape = tuple(c["shape_mnk"])
            if (dt, shape) not in p0:
                continue
            s = c["summary"]
            rows.append({"dtype": dt, "shape": "x".join(map(str, shape)),
                         "p5_custom_us": s["best_vendor_us"] * (1 - s["time_saved_pct"] / 100), "p5_vendor_us": s["best_vendor_us"],
                         "p0_custom_us": p0[(dt, shape)]["custom_us"], "p0_vendor_us": p0[(dt, shape)]["vendor_us"]})
    return {"copy_bandwidth_gbs": {"P5 (nvidia-powerd running)": 35.8, "P0 (nvidia-powerd stopped)": 356.2},
            "memory_clock_mhz": {"P5 (nvidia-powerd running)": 810, "P0 (nvidia-powerd stopped)": 6001},
            "kernels": rows}


def heatmap():
    sweep = load(RES / "experiments/H1-characterization/results/sweep.json")
    best = {(r["d"], r["m"]): max(v["saved_pct"] for k, v in r["variants"].items() if k not in ("torch", "torch_aa"))
            for r in sweep}
    ds, ms = sorted({d for d, _ in best}), sorted({m for _, m in best})
    return {"d": ds, "m": ms, "mib": [d * d * 2 / 2**20 for d in ds], "best_saved_pct": [[best[(d, m)] for m in ms] for d in ds]}


def heldout():
    runs = {"original": RES / "experiments/H2b-autotune/results/autotune.json",
            "replica 1": RES / "experiments/R1-replicate-H2b/results/replica1.json",
            "replica 2": RES / "experiments/R1-replicate-H2b/results/replica2.json",
            "with 2 s warm-up": RES / "experiments/R2-warm-recheck/results/warm.json"}
    out = {"shapes": None, "runs": {}}
    for name, path in runs.items():
        data = load(path)
        out["shapes"] = [f"{r['dtype']} {r['d']}² M={r['m']}" for r in data]
        out["runs"][name] = {"saved_pct": [r["variants"]["autotuned"]["saved_pct"] for r in data],
                             "ci95": [r["variants"]["autotuned"]["ci95"] for r in data],
                             "kept": [r["plan"] is not None for r in data],
                             "geomean": geomean_saving([r["variants"]["autotuned"]["us_per_op"] / r["variants"]["torch"]["us_per_op"] for r in data])}
    return out


def training():
    g2 = load(RES / "experiments/G2-training-confirm/results/g2.json")
    return {"shapes": [f"{r['dtype']} {r['d']}² M={r['m']}" for r in g2["shapes"]],
            "saved_pct": [r["saved_pct"] for r in g2["shapes"]], "ci95": [r["ci95"] for r in g2["shapes"]],
            "bit_identical": all(r["bit_identical"] for r in g2["shapes"]), "geomean": g2["geomean"]}


def decode():
    runs = {"H16": RES / "experiments/H16-strong-baseline/results/h16.json",
            "R3 (cooled)": RES / "experiments/R3-thermal-H16/results/r3.json"}
    r4 = RES / "experiments/R4-strict-thermal/results/r4.json"
    if r4.exists() and len(load(r4).get("steps", [])) == 12:
        runs["R4 (strict <= 60 C)"] = r4
    out = {"configs": None, "runs": {}}
    for name, path in runs.items():
        data = load(path)
        out["configs"] = [f"{s['model']} · KV {s['kv_len']}" for s in data["steps"]]
        out["runs"][name] = {"dispatch_saved": [s["dispatch_saved"] for s in data["steps"]],
                             "full_saved": [s["full_saved"] for s in data["steps"]],
                             "pick": [s["pick"] for s in data["steps"]],
                             "base_us": [s["base_us"] for s in data["steps"]],
                             "geomean_full": data["geomean_full"]}
    return out


def attention():
    text = (RES / "experiments/H11-decode-attention/analysis.md").read_text()
    versions = {}
    for label, key in (("SmolLM2 shape", "9 query / 3 KV heads"), ("Qwen shape", "14 query / 2 KV heads")):
        m = re.search(rf"\| {label} \| ([\d.]+) us \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \| \*\*([\d.]+)", text)
        if m is None:
            raise ValueError(f"attention version table row missing: {label}")
        versions[key] = dict(zip(("PyTorch copy+SDPA", "v1", "v2", "v3", "v4"), map(float, m.groups())))
    cells = []
    for line in (RES / "experiments/H17-flashinfer/results/micro.log").read_text().splitlines():
        m = re.match(r"h=(\d+) kvh=(\d+) L=(\d+): sdpa ([\d.]+) flashinfer ([\d.]+) v4 ([\d.]+)", line)
        u = re.match(r"h=(\d+) kvh=(\d+) L=(\d+): flashinfer unsupported", line)
        if m:
            h, kvh, L, sd, fi, v4 = m.groups()
            cells.append({"heads": f"{h}/{kvh}", "kv": int(L), "sdpa": float(sd), "flashinfer": float(fi), "v4": float(v4)})
        elif u:
            h, kvh, L = u.groups()
            cells.append({"heads": f"{h}/{kvh}", "kv": int(L), "sdpa": None, "flashinfer": None, "v4": None, "unsupported": True})
    return {"versions_kv512": versions, "flashinfer": cells}


def non_llm():
    g7 = load(RES / "experiments/G7-non-llm-models/results/g7.json")["models"]
    g7b = {m["model"]: m for m in load(RES / "experiments/G7b-hooks/results/explore.json")}
    rows = []
    for m in g7:
        b = g7b.get(m["model"], {})
        rows.append({"model": m["model"], "weights_mib": m["weight_bytes"] / 2**20, "plain_us": m["plain_us"],
                     "layer_level": m["saved_pct"], "hooks": b.get("hooks", {}).get("saved"),
                     "fastpath_off_cost": b.get("plain_nofast", {}).get("saved")})
    return rows


def beyond_llm():
    """Every non-LLM workload measured: wins and losses in one list, latency saved vs plain PyTorch."""
    rows = []
    h3 = load(RES / "experiments/H3-generic-ops/results/generic.json")
    names = {("mlp", 256, 1024, 1): "MLP block d256, batch 1", ("mlp", 384, 1536, 1): "MLP block d384, batch 1",
             ("mlp", 512, 1024, 4): "MLP block d512, batch 4", ("mlp", 512, 1024, 16): "MLP block d512, batch 16",
             ("conv", 128, 14, 1): "conv3x3 C128 14x14, batch 1", ("conv", 256, 7, 1): "conv3x3 C256 7x7, batch 1",
             ("conv", 256, 14, 1): "conv3x3 C256 14x14, batch 1", ("conv", 64, 28, 1): "conv3x3 C64 28x28, batch 1"}
    for r in h3:
        best = max(v["saved_pct"] for k, v in r["variants"].items() if k.startswith("x_"))
        rows.append({"name": names[tuple(r["case"])], "kind": r["case"][0], "saved_pct": max(best, r["variants"]["policy"]["saved_pct"]),
                     "note": "best of tuned and fixed plans (exploratory)"})
    g2 = load(RES / "experiments/G2-training-confirm/results/g2.json")
    rows.append({"name": "MLP stack training (fwd+bwd), batch 4-8", "kind": "training", "saved_pct": g2["geomean"], "note": "confirmatory, held-out shapes"})
    for m in load(RES / "experiments/G7-non-llm-models/results/g7.json")["models"]:
        b = {x["model"]: x for x in load(RES / "experiments/G7b-hooks/results/explore.json")}.get(m["model"], {})
        best = max(m["saved_pct"], b.get("hooks", {}).get("saved", -100))
        rows.append({"name": m["model"].replace("-like", ""), "kind": "end-to-end", "saved_pct": best, "note": "best of per-layer and per-submodule"})
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = {"regime": regime(), "heatmap": heatmap(), "heldout": heldout(), "training": training(),
            "decode": decode(), "attention": attention(), "non_llm": non_llm(),
            "beyond_llm": beyond_llm()}
    target = OUT / "results.json"
    target.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    sources = sorted(str(p.relative_to(LAB)) for p in RES.rglob("*.json") if "results" in p.parts or p.parent.name == "data")
    manifest = {"generated_from": "https://github.com/waybarrios/klab (research/l2-prefetch)",
                "results_sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "source_files": sources}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"wrote {target} ({target.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    main()
