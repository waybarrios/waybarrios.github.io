// Plotly charts for "Testing small vision models on risky scenes". Every value comes from data/results.json,
// exported from the project's result tables by the project's export script.
(() => {
  const INK = "#333", MUTED = "#606060", GRID = "#e8e8e8", ACCENT = "#23617d", LOSS = "#9b3b2a", LIGHT = "#a8a8a8";
  const FONT = { family: 'Consolas, "Liberation Mono", Menlo, monospace', size: 13, color: INK };
  const CONFIG = { displayModeBar: false, responsive: true };
  // Phones get smaller tick labels, shorter titles and tighter margins (charts re-render when this flips).
  const narrow = () => (document.querySelector(".plot")?.clientWidth || 640) < 480;
  const fs = () => (narrow() ? 10 : 12);
  const small = (text, short) => ({ text: narrow() && short ? short : text, font: { ...FONT, size: fs() } });

  const base = (extra = {}) => ({
    font: FONT,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    margin: { l: 8, r: 12, t: 28, b: 44 },
    hoverlabel: { font: FONT, bgcolor: "#fff", bordercolor: "#b9b9b9" },
    legend: { orientation: "h", x: 0, xanchor: "left", y: 1.02, yanchor: "bottom", font: { ...FONT, size: fs() } },
    xaxis: { gridcolor: GRID, linecolor: "#b1b1b1", tickfont: { ...FONT, size: fs(), color: MUTED }, automargin: true },
    yaxis: { gridcolor: "#fff", linecolor: "#b1b1b1", tickfont: { ...FONT, size: fs(), color: INK }, automargin: true },
    bargap: 0.3,
    ...extra,
  });

  const draw = (id, traces, layout) => {
    const el = document.getElementById(id);
    if (el) Plotly.react(el, traces, layout, CONFIG);
  };
  const chanceLine = (x) => ({ type: "line", x0: x, x1: x, yref: "paper", y0: 0, y1: 1, line: { color: "#999", width: 1, dash: "dot" } });
  const chanceNote = (x) => ({ x, y: 1, yref: "paper", yanchor: "bottom", text: "coin flip", showarrow: false, font: { ...FONT, size: fs() - 1, color: MUTED } });

  function shortcut(d) {
    const sel = document.getElementById("shortcut-split");
    const render = () => {
      const key = sel.value;
      const rows = [...d.shortcut].sort((a, b) => a[key] - b[key]);
      draw("chart-shortcut", [{
        type: "bar", orientation: "h", y: rows.map((r) => (r.rule && narrow() ? "Size rule (>640px)" : r.name)), x: rows.map((r) => r[key]),
        marker: { color: rows.map((r) => (r.rule ? LOSS : LIGHT)) },
        text: rows.map((r) => `${r[key].toFixed(1)}%`), textposition: "outside", cliponaxis: false,
        textfont: { ...FONT, size: fs(), color: MUTED },
        hovertemplate: "%{y}<br>%{x:.1f}% correct<extra></extra>",
      }], base({ showlegend: false, margin: { l: 8, r: 48, t: 22, b: 40 },
                 shapes: [chanceLine(50)], annotations: [chanceNote(50)],
                 xaxis: { ...base().xaxis, range: [0, 100], title: small("accuracy on the chat cases (%)", "accuracy (%)") } }));
    };
    sel.addEventListener("change", render);
    return render;
  }

  function gap(d) {
    return () => gapRender(d);
  }

  function gapRender(d) {
    const rows = [...d.gap].sort((a, b) => a.ranked - b.ranked);
    const y = rows.map((r) => r.model);
    const links = {
      type: "scatter", mode: "lines", showlegend: false, hoverinfo: "skip", line: { color: "#cfcfcf", width: 2 },
      x: rows.flatMap((r) => [r.both_labelled, r.ranked, null]), y: rows.flatMap((r) => [r.model, r.model, null]),
    };
    const dots = (key, name, color) => ({
      type: "scatter", mode: "markers", name, x: rows.map((r) => r[key]), y,
      marker: { color, size: 9, line: { color: "#fff", width: 1 } },
      hovertemplate: `%{y}<br>${name}: %{x:.1f}%<extra></extra>`,
    });
    draw("chart-gap", [links, dots("both_labelled", "labels both scenes right", LOSS), dots("ranked", "puts more risk on the unsafe scene", ACCENT)],
      base({ margin: { l: 8, r: 16, t: 12, b: 44 },
             xaxis: { ...base().xaxis, range: [0, 100], title: small("share of safe/unsafe pairs (%)", "share of pairs (%)") } }));
  }

  function situation(d) {
    return () => situationRender(d);
  }

  function situationRender(d) {
    const rows = d.situation.filter((r) => r.model !== "Two-model average").sort((a, b) => a.own_query - b.own_query);
    const y = rows.map((r) => r.model);
    const dots = (key, name, color, symbol) => ({
      type: "scatter", mode: "markers", name, x: rows.map((r) => r[key]), y,
      marker: { color, size: 9, symbol, line: { color: "#fff", width: 1 } },
      hovertemplate: `%{y}<br>${name}: %{x:.1f}%<extra></extra>`,
    });
    draw("chart-situation", [
      dots("direct", "plain answer", LIGHT, "circle"),
      dots("shuffled", "random groups of 6", "#6a6a6a", "diamond"),
      dots("own_query", "same-request groups of 6", ACCENT, "circle"),
    ], base({ margin: { l: 8, r: 16, t: 12, b: 44 },
              shapes: [chanceLine(50)],
              xaxis: { ...base().xaxis, range: [40, 95], title: small("balanced accuracy (%)") } }));
  }

  function family(d) {
    const sel = document.getElementById("family-bench");
    sel.add(new Option("Mean of six benchmarks", "mean"));
    d.benchmarks.forEach((b) => sel.add(new Option(b, b)));
    const render = () => {
      const key = sel.value;
      const rows = [...d.auroc].sort((a, b) => a[key] - b[key]);
      draw("chart-family", [{
        // Bars start at 0.5 (a coin flip), so their length is how far the model is above chance.
        type: "bar", orientation: "h", y: rows.map((r) => r.model), base: 0.5, x: rows.map((r) => r[key] - 0.5),
        marker: { color: rows.map((r) => (r.model.startsWith("Qwen") ? ACCENT : LIGHT)) },
        customdata: rows.map((r) => r[key]), text: rows.map((r) => r[key].toFixed(3)), textposition: "outside", cliponaxis: false,
        textfont: { ...FONT, size: fs(), color: MUTED },
        hovertemplate: "%{y}<br>AUROC %{customdata:.3f}<extra></extra>",
      }], base({ showlegend: false, margin: { l: 8, r: 48, t: 22, b: 40 },
                 shapes: [chanceLine(0.5)], annotations: [chanceNote(0.5)],
                 xaxis: { ...base().xaxis, range: [0.3, 0.95], title: small("AUROC of the UNSAFE probability", "AUROC") } }));
    };
    sel.addEventListener("change", render);
    return render;
  }

  async function main() {
    try {
      const d = await (await fetch("data/results.json")).json();
      const renders = [shortcut, gap, family, situation].map((f) => f(d));
      renders.forEach((r) => r());
      let wasNarrow = narrow();
      window.addEventListener("resize", () => {
        if (narrow() !== wasNarrow) { wasNarrow = narrow(); renders.forEach((r) => r()); }
      });
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
