// Plotly charts for "Making small PyTorch ops faster on a laptop GPU". Every value comes from data/results.json,
// exported from the klab result files by scripts/export_l2_blog_data.py.
(() => {
  const INK = "#333", MUTED = "#606060", GRID = "#e8e8e8", ACCENT = "#23617d", LOSS = "#9b3b2a";
  const GREYS = ["#2f2f2f", "#6a6a6a", "#9a9a9a", ACCENT];
  const FONT = { family: 'Consolas, "Liberation Mono", Menlo, monospace', size: 11, color: INK };
  const CONFIG = { displayModeBar: false, responsive: true };

  const base = (extra = {}) => ({
    font: FONT,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    margin: { l: 56, r: 12, t: 28, b: 64 },
    hoverlabel: { font: FONT, bgcolor: "#fff", bordercolor: "#b9b9b9" },
    legend: { orientation: "h", x: 0, y: 1.12, font: { ...FONT, size: 10 } },
    xaxis: { gridcolor: GRID, linecolor: "#b1b1b1", tickfont: { ...FONT, size: 10, color: MUTED }, automargin: true },
    yaxis: { gridcolor: GRID, zerolinecolor: "#999", linecolor: "#b1b1b1", tickfont: { ...FONT, size: 10, color: MUTED }, automargin: true },
    bargap: 0.25,
    ...extra,
  });

  const draw = (id, traces, layout) => {
    const el = document.getElementById(id);
    if (el) Plotly.react(el, traces, layout, CONFIG);
  };
  const pct = (v) => (v === null || v === undefined ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

  function regime(d) {
    const sel = document.getElementById("regime-dtype");
    const render = () => {
      const rows = d.regime.kernels.filter((r) => r.dtype === sel.value);
      const x = rows.map((r) => r.shape);
      draw("chart-regime", [
        { type: "bar", name: "daemon running (P5, 810 MHz)", x, y: rows.map((r) => r.p5_custom_us), marker: { color: "#9a9a9a" },
          hovertemplate: "%{x}<br>%{y:.2f} µs<extra>P5</extra>" },
        { type: "bar", name: "daemon stopped (P0, 6001 MHz)", x, y: rows.map((r) => r.p0_custom_us), marker: { color: ACCENT },
          customdata: rows.map((r) => r.p5_custom_us / r.p0_custom_us),
          hovertemplate: "%{x}<br>%{y:.2f} µs, %{customdata:.1f}x faster<extra>P0</extra>" },
      ], base({ barmode: "group", yaxis: { ...base().yaxis, type: "log", title: { text: "µs per call (log)", font: { ...FONT, size: 10 } } },
                xaxis: { ...base().xaxis, title: { text: "M x N x K", font: { ...FONT, size: 10 } } } }));
    };
    sel.addEventListener("change", render);
    render();
  }

  function heatmap(d) {
    const h = d.heatmap;
    const y = h.d.map((v, i) => `${v}² (${h.mib[i].toFixed(h.mib[i] < 1 ? 2 : 1)} MiB)`);
    const x = h.m.map((m) => `M=${m}`);
    const text = h.best_saved_pct.map((row) => row.map((v) => pct(v).replace(/0%$/, "%")));
    draw("chart-heatmap", [{
      type: "heatmap", x, y, z: h.best_saved_pct, text, texttemplate: "%{text}", textfont: { ...FONT, size: 11 },
      zmid: 0, zmin: -20, zmax: 20, xgap: 2, ygap: 2,
      colorscale: [[0, LOSS], [0.5, "#ffffff"], [1, ACCENT]],
      colorbar: { thickness: 8, outlinewidth: 0, tickfont: { ...FONT, size: 9, color: MUTED }, ticksuffix: "%" },
      hovertemplate: "%{y}, %{x}<br>best saving %{z:.1f}%<extra></extra>",
    }], base({ margin: { l: 120, r: 10, t: 10, b: 36 }, yaxis: { ...base().yaxis, autorange: "reversed", gridcolor: "#fff" },
               xaxis: { ...base().xaxis, side: "top", gridcolor: "#fff" } }));
  }

  function heldout(d) {
    const names = Object.keys(d.heldout.runs);
    const traces = names.map((name, i) => {
      const r = d.heldout.runs[name];
      return {
        type: "bar", name: `${name} (${r.geomean.toFixed(2)}%)`, x: d.heldout.shapes, y: r.saved_pct,
        marker: { color: r.kept.map((k) => (k ? GREYS[i] : "#d4d4d4")) },
        error_y: { type: "data", symmetric: false, array: r.ci95.map((c, j) => c[1] - r.saved_pct[j]),
                   arrayminus: r.ci95.map((c, j) => r.saved_pct[j] - c[0]), thickness: 0.8, width: 0, color: "#777" },
        hovertemplate: `%{x}<br>${name}: %{y:.2f}%<extra></extra>`,
      };
    });
    draw("chart-heldout", traces, base({ barmode: "group", bargap: 0.18, margin: { l: 48, r: 10, t: 30, b: 96 },
      yaxis: { ...base().yaxis, title: { text: "latency saved (%)", font: { ...FONT, size: 10 } } },
      xaxis: { ...base().xaxis, tickangle: -50 } }));
  }

  function training(d) {
    const t = d.training;
    draw("chart-training", [{
      type: "bar", x: t.shapes, y: t.saved_pct, marker: { color: ACCENT },
      error_y: { type: "data", symmetric: false, array: t.ci95.map((c, j) => c[1] - t.saved_pct[j]),
                 arrayminus: t.ci95.map((c, j) => t.saved_pct[j] - c[0]), thickness: 0.8, width: 0, color: "#777" },
      hovertemplate: "%{x}<br>fwd+bwd saved %{y:.2f}%<extra></extra>",
    }], base({ showlegend: false, margin: { l: 48, r: 10, t: 16, b: 72 },
               title: { text: `geometric mean ${t.geomean.toFixed(2)}%, gradients bit-identical`, font: { ...FONT, size: 10, color: MUTED }, x: 0, y: 0.99 },
               yaxis: { ...base().yaxis, title: { text: "saved (%)", font: { ...FONT, size: 10 } } }, xaxis: { ...base().xaxis, tickangle: -35 } }));
  }

  function versions(d) {
    const order = ["PyTorch copy+SDPA", "v1", "v2", "v3", "v4"];
    const traces = Object.entries(d.attention.versions_kv512).map(([heads, v], i) => ({
      type: "bar", name: heads, x: order, y: order.map((k) => v[k]), marker: { color: i ? "#9a9a9a" : ACCENT },
      hovertemplate: `%{x}, ${heads}<br>%{y:.2f} µs<extra></extra>`,
    }));
    draw("chart-versions", traces, base({ barmode: "group", margin: { l: 48, r: 10, t: 30, b: 40 },
      yaxis: { ...base().yaxis, title: { text: "µs per call", font: { ...FONT, size: 10 } } } }));
  }

  function decode(d) {
    const sel = document.getElementById("decode-run");
    Object.entries(d.decode.runs).forEach(([name, r]) => sel.add(new Option(`${name} · ${r.geomean_full.toFixed(2)}%`, name)));
    const render = () => {
      const r = d.decode.runs[sel.value];
      const x = d.decode.configs;
      draw("chart-decode", [
        { type: "bar", name: "attention choice", x, y: r.dispatch_saved, marker: { color: "#6a6a6a" }, customdata: r.pick,
          hovertemplate: "%{x}<br>attention choice: %{y:.2f}% (picked %{customdata})<extra></extra>" },
        { type: "bar", name: "+ prefetch", x, y: r.full_saved, marker: { color: ACCENT }, customdata: r.base_us,
          hovertemplate: "%{x}<br>with prefetch: %{y:.2f}%<br>baseline step %{customdata:.0f} µs<extra></extra>" },
      ], base({ barmode: "group", margin: { l: 48, r: 10, t: 30, b: 110 },
                yaxis: { ...base().yaxis, title: { text: "step latency saved (%)", font: { ...FONT, size: 10 } } },
                xaxis: { ...base().xaxis, tickangle: -50 } }));
    };
    sel.addEventListener("change", render);
    render();
  }

  function flashinfer(d) {
    const sel = document.getElementById("fi-heads");
    const heads = [...new Set(d.attention.flashinfer.map((c) => c.heads))];
    heads.forEach((h) => sel.add(new Option(h, h)));
    const render = () => {
      const cells = d.attention.flashinfer.filter((c) => c.heads === sel.value);
      const x = cells.map((c) => `KV ${c.kv}`);
      const unsupported = cells.every((c) => c.unsupported);
      const layout = base({ barmode: "group", margin: { l: 48, r: 10, t: 30, b: 40 },
                            yaxis: { ...base().yaxis, title: { text: "µs per call", font: { ...FONT, size: 10 } } } });
      if (unsupported) {
        layout.annotations = [{ text: "FlashInfer 0.7.2 rejects a GQA group of 7 (14 query / 2 KV heads)", showarrow: false,
                                x: 0.5, y: 0.5, xref: "paper", yref: "paper", font: { ...FONT, color: MUTED } }];
        draw("chart-flashinfer", [], layout);
        return;
      }
      draw("chart-flashinfer", [
        { type: "bar", name: "PyTorch copy+SDPA", x, y: cells.map((c) => c.sdpa), marker: { color: "#9a9a9a" }, hovertemplate: "%{x}<br>%{y:.2f} µs<extra>SDPA</extra>" },
        { type: "bar", name: "FlashInfer", x, y: cells.map((c) => c.flashinfer), marker: { color: "#4d4d4d" }, hovertemplate: "%{x}<br>%{y:.2f} µs<extra>FlashInfer</extra>" },
        { type: "bar", name: "v4 (klab)", x, y: cells.map((c) => c.v4), marker: { color: ACCENT }, hovertemplate: "%{x}<br>%{y:.2f} µs<extra>v4</extra>" },
      ], layout);
    };
    sel.addEventListener("change", render);
    render();
  }

  function nonllm(d) {
    const rows = d.non_llm;
    const x = rows.map((r) => `${r.model.replace(/ \(.*\)$/, "")}`);
    draw("chart-nonllm", [
      { type: "bar", name: "per layer", x, y: rows.map((r) => r.layer_level), marker: { color: "#9a9a9a" },
        customdata: rows.map((r) => r.weights_mib), hovertemplate: "%{x}<br>per layer: %{y:.2f}%<br>weights %{customdata:.1f} MiB<extra></extra>" },
      { type: "bar", name: "per submodule (hooks)", x, y: rows.map((r) => r.hooks), marker: { color: rows.map((r) => (r.hooks < 0 ? LOSS : ACCENT)) },
        hovertemplate: "%{x}<br>per submodule: %{y:.2f}%<extra></extra>" },
    ], base({ barmode: "group", margin: { l: 48, r: 10, t: 30, b: 70 },
              yaxis: { ...base().yaxis, title: { text: "latency saved (%)", font: { ...FONT, size: 10 } } }, xaxis: { ...base().xaxis, tickangle: -20 } }));
  }

  function beyond(d) {
    const rows = [...d.beyond_llm].reverse();
    draw("chart-beyond", [{
      type: "bar", orientation: "h", y: rows.map((r) => r.name), x: rows.map((r) => r.saved_pct),
      marker: { color: rows.map((r) => (r.saved_pct >= 5 ? ACCENT : "#a8a8a8")) },
      customdata: rows.map((r) => r.note), text: rows.map((r) => pct(r.saved_pct)), textposition: "outside", cliponaxis: false,
      textfont: { ...FONT, size: 10, color: MUTED },
      hovertemplate: "%{y}<br>%{x:.2f}%<br>%{customdata}<extra></extra>",
    }], base({ showlegend: false, margin: { l: 220, r: 48, t: 10, b: 36 },
               xaxis: { ...base().xaxis, title: { text: "latency saved (%)", font: { ...FONT, size: 10 } }, range: [-1, 15] },
               yaxis: { ...base().yaxis, gridcolor: "#fff", tickfont: { ...FONT, size: 10, color: INK } } }));
  }

  async function main() {
    try {
      const d = await (await fetch("data/results.json")).json();
      [regime, heatmap, heldout, training, beyond, versions, decode, flashinfer, nonllm].forEach((f) => f(d));
    } catch (err) {
      document.querySelectorAll(".plot").forEach((el) => {
        const p = document.createElement("p");
        const a = document.createElement("a");
        p.className = "plot-error";
        a.href = "data/results.json";
        a.textContent = "results.json";
        p.append("This chart could not load. The numbers are in ", a, ".");
        el.replaceChildren(p);
      });
      console.error(err);
    }
  }

  if (window.Plotly) main();
  else window.addEventListener("load", main);
})();
