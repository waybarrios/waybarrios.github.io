const ns = "http://www.w3.org/2000/svg";
const colors = ["#333333", "#686868", "#959595"];
const $ = id => document.getElementById(id);
const shapeKey = shape => shape.join("×");
const number = (value, digits = 2) => value == null ? "unavailable" : value.toFixed(digits);

function el(name, attrs = {}, text = null) {
  const node = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== null) node.textContent = text;
  return node;
}

function detail(row, checkpoint) {
  const caseName = checkpoint ? row.tensor : `${row.dtype.toUpperCase()} ${shapeKey(row.shape)}`;
  return `${caseName}; seed ${row.seed}. Vendor ${number(row.baseline_us)} µs, custom ${number(row.custom_us)} µs, ` +
    `saved ${number(row.saved_us)} µs (${number(row.gain)}%). Paired 95% CI ${number(row.low, 3)} to ${number(row.high, 3)}%. ` +
    `Vendor: ${row.vendor || "none eligible"}; A/A ${number(row.aa, 3)}%. ` +
    `Process checks ${row.case_passed ? "pass" : "fail"}.` +
    (checkpoint ? "" : ` Three-process shape ${row.shape_passed ? "qualifies" : "remains unqualified"}.`);
}

function html(name, className, text = "") {
  const node = document.createElement(name); node.className = className; node.textContent = text; return node;
}

function tooltipContent(row, checkpoint) {
  const nodes = [];
  const label = checkpoint ? `Layer ${row.layer} · ${row.tensor.split(".").at(-2)}` : `${row.dtype.toUpperCase()} · ${shapeKey(row.shape)}`;
  nodes.push(html("div", "tooltip-title", `${label} · seed ${row.seed}`));
  nodes.push(html("div", "tooltip-gain", `${number(row.gain)}% latency saved`));
  nodes.push(html("div", "tooltip-ci", `95% CI: ${number(row.low, 3)} to ${number(row.high, 3)}%`));
  const metrics = html("dl", "tooltip-metrics");
  const time = value => value == null ? "unavailable" : value >= 1000 ? `${number(value / 1000, 3)} ms` : `${number(value, 3)} µs`;
  for (const [label, value] of [["Vendor", time(row.baseline_us)], ["Custom CUDA", time(row.custom_us)],
    ["Time saved", time(row.saved_us)], ["Vendor A/A", `${number(row.aa, 3)}%`]]) {
    metrics.append(html("dt", "", label), html("dd", "", value));
  }
  nodes.push(metrics, html("div", "tooltip-vendor", `Vendor route: ${row.vendor || "none eligible"}`));
  const qualifies = checkpoint ? row.case_passed : row.shape_passed;
  nodes.push(html("div", "tooltip-status", checkpoint ? (qualifies ? "Case checks pass" : "Case remains unqualified") :
    (qualifies ? "Shape qualifies in all three processes" : "Shape does not pass all three processes")));
  nodes.push(html("div", "tooltip-hint", "Click to pin. Escape clears. Arrow keys inspect nearby points."));
  return nodes;
}

function niceStep(span, count) {
  const raw = Math.max(span / count, .01);
  const base = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(factor => factor * base).find(step => step >= raw);
}

function drawPlot(target, rows, { seeds, checkpoint = false, output }) {
  const labels = [...new Map(rows.map(row => {
    const key = checkpoint ? row.tensor : shapeKey(row.shape);
    return [key, row];
  })).entries()];
  const width = Math.max(250, Math.round(target.getBoundingClientRect().width));
  const compact = width < 400;
  const left = compact ? 94 : 138, right = 18, top = 18, bottom = 47;
  const rowHeight = checkpoint ? 43 : 52;
  const height = top + labels.length * rowHeight + bottom;
  const valid = rows.filter(row => row.gain !== null && row.low !== null && row.high !== null);
  const observedLow = valid.length ? Math.min(...valid.map(row => Math.min(row.low, row.gain))) : 0;
  const observedHigh = valid.length ? Math.max(...valid.map(row => Math.max(row.high, row.gain))) : 10;
  const step = niceStep(Math.max(2, observedHigh - (checkpoint ? observedLow : Math.min(0, observedLow))), compact ? 3 : 5);
  const low = Math.floor(((checkpoint ? observedLow : Math.min(0, observedLow)) - step * .15) / step) * step;
  const high = Math.ceil((Math.max(observedHigh, checkpoint ? observedHigh : 10) + step * .15) / step) * step;
  const scale = value => left + (value - low) / (high - low) * (width - left - right);
  const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "group",
    "aria-label": checkpoint ? "Held-out checkpoint projection latency and paired confidence intervals" :
      "Native projection latency and paired confidence intervals" });
  svg.append(el("title", {}, "Latency saved (%), with one paired 95% interval per process"));
  const highlight = el("rect", { x: left - 5, y: top, width: width - left - right + 10,
    height: rowHeight - 3, class: "row-highlight", visibility: "hidden" });
  svg.append(highlight);
  const plotBottom = top + labels.length * rowHeight;
  for (let tick = low; tick <= high + step / 10; tick += step) {
    const x = scale(tick);
    svg.append(el("line", { x1: x, x2: x, y1: top - 4, y2: plotBottom, class: "grid-line" }));
    svg.append(el("text", { x, y: plotBottom + 18, "text-anchor": "middle", class: "tick" }, String(Math.round(tick * 100) / 100)));
  }
  if (low <= 0 && high >= 0) svg.append(el("line", { x1: scale(0), x2: scale(0), y1: top - 4, y2: plotBottom, class: "zero-line" }));
  if (low <= 10 && high >= 10) svg.append(el("line", { x1: scale(10), x2: scale(10), y1: top - 4, y2: plotBottom, class: "threshold" }));
  svg.append(el("text", { x: (left + width - right) / 2, y: height - 7, "text-anchor": "middle", class: "tick" }, "Latency saved (%)"));
  const guide = el("line", { x1: left, x2: left, y1: top - 4, y2: plotBottom, class: "hover-guide", visibility: "hidden" });
  svg.append(guide);
  const tooltip = html("div", "chart-tooltip");
  tooltip.id = `${target.id}-tooltip`; tooltip.setAttribute("role", "tooltip"); tooltip.hidden = true;
  const focusPoints = [];
  let active = null, pinned = false;
  function position(group, event) {
    const bounds = target.getBoundingClientRect(), anchor = group.getBoundingClientRect();
    const px = event?.clientX ?? anchor.left + anchor.width / 2;
    const py = event?.clientY ?? anchor.top + anchor.height / 2;
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    let x = px - bounds.left + 14;
    if (x + tw > bounds.width) x = px - bounds.left - tw - 14;
    x = Math.max(0, Math.min(x, bounds.width - tw));
    let y = py - bounds.top - th - 12;
    if (py - th - 12 < 12) y = py - bounds.top + 14;
    y = Math.max(12 - bounds.top, Math.min(y, window.innerHeight - bounds.top - th - 12));
    tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
  }
  function clear() {
    if (active) { active.classList.remove("is-active"); active.removeAttribute("aria-describedby"); active.setAttribute("aria-pressed", "false"); }
    active = null; tooltip.hidden = true; target.classList.remove("has-active");
    highlight.setAttribute("visibility", "hidden"); guide.setAttribute("visibility", "hidden");
  }
  function activate(group, row, y, event) {
    if (active && active !== group) { active.classList.remove("is-active"); active.setAttribute("aria-pressed", "false"); active.removeAttribute("aria-describedby"); }
    active = group; group.classList.add("is-active"); group.setAttribute("aria-describedby", tooltip.id);
    group.setAttribute("aria-pressed", String(pinned)); target.classList.add("has-active");
    tooltip.replaceChildren(...tooltipContent(row, checkpoint)); tooltip.hidden = false;
    highlight.setAttribute("y", y - rowHeight / 2 + 1.5); highlight.setAttribute("visibility", "visible");
    guide.setAttribute("x1", scale(row.gain)); guide.setAttribute("x2", scale(row.gain)); guide.setAttribute("visibility", "visible");
    output.textContent = detail(row, checkpoint); position(group, event);
  }
  for (const [index, [key, representative]] of labels.entries()) {
    const y = top + (index + .5) * rowHeight;
    const label = el("text", { x: left - 12, y: y - 2, "text-anchor": "end", class: "shape-label" });
    if (checkpoint) {
      const kind = representative.tensor.split(".").at(-2).replace("_proj", "");
      label.append(el("tspan", { x: left - 12 }, `Layer ${representative.layer}`));
      label.append(el("tspan", { x: left - 12, dy: 14 }, kind));
    } else {
      label.append(el("tspan", { x: left - 12 }, `M=${representative.shape[0]}`));
      label.append(el("tspan", { x: left - 12, dy: 14 }, `${representative.shape[1]}×${representative.shape[2]}`));
    }
    svg.append(label);
    for (const row of rows.filter(item => (checkpoint ? item.tensor : shapeKey(item.shape)) === key)) {
      const seedIndex = seeds.indexOf(row.seed);
      const pointY = y + (seedIndex - 1) * 8;
      if (row.gain === null) {
        svg.append(el("text", { x: left + 5, y: pointY, class: "tick" }, "no eligible vendor"));
        continue;
      }
      const color = colors[seedIndex];
      const group = el("g", { class: "chart-point", tabindex: focusPoints.length ? -1 : 0,
        role: "button", "aria-pressed": "false", "aria-label": detail(row, checkpoint) });
      focusPoints.push(group);
      group.append(el("title", {}, detail(row, checkpoint)));
      group.append(el("line", { x1: scale(row.low), x2: scale(row.high), y1: pointY, y2: pointY,
        stroke: color, class: "interval" }));
      const x = scale(row.gain);
      const qualifies = checkpoint ? row.case_passed : row.shape_passed;
      if (qualifies) group.append(el("circle", { cx: x, cy: pointY, r: 3.5, fill: color, class: "point-marker" }));
      else group.append(el("path", { d: `M${x - 3.5},${pointY - 3.5}l7,7m0,-7l-7,7`, stroke: color, "stroke-width": 1.3, fill: "none", class: "point-marker" }));
      group.append(el("circle", { cx: x, cy: pointY, r: 9, fill: "transparent", class: "point-hit" }));
      group.addEventListener("mouseenter", event => { if (!pinned) activate(group, row, y, event); });
      group.addEventListener("mousemove", event => { if (!pinned && active === group) position(group, event); });
      group.addEventListener("focus", () => {
        for (const point of focusPoints) point.setAttribute("tabindex", point === group ? "0" : "-1");
        activate(group, row, y);
      });
      const pin = event => {
        if (pinned && active === group) { pinned = false; clear(); }
        else { pinned = true; activate(group, row, y, event); }
      };
      group.addEventListener("click", pin);
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pin(); }
        const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: seeds.length, ArrowUp: -seeds.length };
        if (event.key in deltas) {
          event.preventDefault(); pinned = false;
          const index = (focusPoints.indexOf(group) + deltas[event.key] + focusPoints.length) % focusPoints.length;
          focusPoints[index].focus();
        }
        if (event.key === "Escape") { event.preventDefault(); pinned = false; clear(); }
      });
      svg.append(group);
    }
  }
  target.replaceChildren(svg, tooltip);
  target.classList.remove("has-active");
  target.addEventListener("mouseleave", () => { if (!pinned) clear(); });
  svg.addEventListener("click", event => { if (!event.target.closest(".chart-point")) { pinned = false; clear(); } });
  svg.addEventListener("focusout", event => { if (!pinned && !svg.contains(event.relatedTarget)) clear(); });
  target.setAttribute("aria-busy", "false");
}

function grid(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = shapeKey(row.shape);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const tbody = $("checkpoint-grid").querySelector("tbody");
  tbody.replaceChildren();
  const sorted = [...groups].sort((a, b) => a[1][0].shape[0] - b[1][0].shape[0] ||
    a[1][0].shape[1] - b[1][0].shape[1] || a[1][0].shape[2] - b[1][0].shape[2]);
  for (const [key, cases] of sorted) {
    const values = cases.map(row => row.gain).filter(value => value !== null);
    const tr = document.createElement("tr");
    const cells = [key, values.length ? `${number(Math.min(...values))} to ${number(Math.max(...values))}%` : "unavailable",
      `${cases.filter(row => row.case_passed).length}/${cases.length}`, cases.every(row => row.shape_passed) ? "yes" : "no"];
    for (const value of cells) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
    tbody.append(tr);
  }
}

async function main() {
  const response = await fetch(new URL("./data/results.json", import.meta.url));
  if (!response.ok) throw new Error(`Measurements returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.schema !== 1 || data.gpu_state !== "stock") throw new Error("Unexpected experiment snapshot");
  if (data.native_profiles.includes("battery")) {
    const option = document.createElement("option"); option.value = "battery"; option.textContent = "Battery profile (AC)";
    $("native-profile").append(option);
  }
  const renderNative = () => {
    const dtype = $("native-dtype").value, profile = $("native-profile").value;
    const rows = data.native.filter(row => row.dtype === dtype && row.profile === profile);
    drawPlot($("native-chart"), rows, { seeds: [971, 977, 983], output: $("native-detail") });
    const shapes = [...new Map(rows.map(row => [shapeKey(row.shape), row.shape_passed])).values()];
    $("native-summary").textContent = `${shapes.filter(Boolean).length}/${shapes.length} shapes qualify across all three processes. ` +
      `${profile === "battery" ? "Battery" : "Performance"} profile on AC; native ${dtype.toUpperCase()} inputs/weights, FP32 accumulation and output.`;
    $("native-detail").textContent = "Focus or hover over a point for its timing, vendor and confidence interval.";
  };
  const renderCheckpoint = () => {
    const output = $("checkpoint-output").value;
    const all = data.checkpoint.filter(row => row.dtype === output);
    const rows = all.filter(row => row.primary);
    drawPlot($("checkpoint-chart"), rows, { seeds: [919, 929, 937], checkpoint: true, output: $("checkpoint-detail") });
    const passing = rows.filter(row => row.case_passed).length;
    $("checkpoint-summary").textContent = `${passing}/${rows.length} primary cases pass. ` +
      (passing === rows.length ? "The BF16-output kernel milestone qualifies." : "The FP32-output combined milestone remains unaccepted.") +
      ` All ${all.length} cases remain in the full grid and downloads.`;
    $("checkpoint-detail").textContent = "Focus or hover over a point to inspect the held-out case.";
    grid(all);
  };
  for (const id of ["native-dtype", "native-profile"]) $(id).addEventListener("change", renderNative);
  $("checkpoint-output").addEventListener("change", renderCheckpoint);
  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => { renderNative(); renderCheckpoint(); }, 120); });
  renderNative(); renderCheckpoint();
}

main().catch(error => {
  for (const id of ["native-chart", "checkpoint-chart"]) {
    $(id).replaceChildren(document.createTextNode(`The chart could not load: ${error.message}. The downloadable CSV remains available.`));
    $(id).setAttribute("aria-busy", "false");
  }
});
