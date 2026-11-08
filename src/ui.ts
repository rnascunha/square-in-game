import { AppState } from "./types";
import { validatePuzzle } from "./math";
import { store } from "./state";

export function renderDashboard(state: AppState) {
  (document.getElementById("ui-name") as HTMLInputElement).value =
    state.puzzleName;
  (document.getElementById("ui-n") as HTMLInputElement).value =
    state.n.toString();

  const statusEl = document.getElementById("ui-status")!;
  if (state.isValid) {
    statusEl.textContent = "Valid";
    statusEl.className = "valid";
  } else {
    statusEl.textContent = "Overlap";
    statusEl.className = "invalid";
  }

  document.getElementById("ui-bounds")!.textContent =
    state.computedBoundingBox.toFixed(8);
  const score = state.computedBoundingBox / Math.sqrt(state.n) - 1;
  document.getElementById("ui-score")!.textContent = score.toFixed(8);

  const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
  if (btnUndo) btnUndo.disabled = state.past.length === 0;

  const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
  if (btnRedo) btnRedo.disabled = state.future.length === 0;

  const warningEl = document.getElementById("warning-overlay");
  if (warningEl) {
    if (state.warningMessage) {
      warningEl.textContent = state.warningMessage;
      warningEl.classList.add("show");
    } else {
      warningEl.classList.remove("show");
    }
  }
}

export function renderTable(
  state: AppState,
  onUpdate: (id: number, field: string, val: number) => void,
) {
  const tbody = document.getElementById("table-body")!;
  tbody.innerHTML = "";

  for (const sq of state.squares) {
    const tr = document.createElement("tr");
    tr.id = `row-${sq.square_id}`;

    if (state.selectedSquareId === sq.square_id) {
      tr.classList.add("selected");
    }

    const createInput = (field: string, val: number, step: string = "0.01") => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = step;
      input.value =
        field === "angleDeg"
          ? ((val * 180) / Math.PI).toFixed(4)
          : val.toFixed(4);
      input.onfocus = () => store.commitHistory();
      input.onchange = (e) => {
        let num = parseFloat((e.target as HTMLInputElement).value);
        if (!isNaN(num)) {
          if (field === "angleDeg") {
            onUpdate(sq.square_id, "angle", (num * Math.PI) / 180);
          } else {
            onUpdate(sq.square_id, field, num);
          }
        }
      };
      return input;
    };

    const tdId = document.createElement("td");
    tdId.textContent = sq.square_id.toString();

    const tdX = document.createElement("td");
    tdX.appendChild(createInput("x", sq.x));

    const tdY = document.createElement("td");
    tdY.appendChild(createInput("y", sq.y));

    const tdRad = document.createElement("td");
    tdRad.appendChild(createInput("angle", sq.angle));

    const tdDeg = document.createElement("td");
    tdDeg.appendChild(createInput("angleDeg", sq.angle));

    tr.appendChild(tdId);
    tr.appendChild(tdX);
    tr.appendChild(tdY);
    tr.appendChild(tdRad);
    tr.appendChild(tdDeg);

    tr.onclick = (e) => {
      if ((e.target as HTMLElement).tagName !== "INPUT") {
        const customEvent = new CustomEvent("square-selected", {
          detail: { id: sq.square_id },
        });
        window.dispatchEvent(customEvent);
      }
    };

    tr.onmouseenter = () => {
      tr.classList.add("hover");
      document.getElementById(`rect-${sq.square_id}`)?.classList.add("hover");
    };
    tr.onmouseleave = () => {
      tr.classList.remove("hover");
      document
        .getElementById(`rect-${sq.square_id}`)
        ?.classList.remove("hover");
    };

    tbody.appendChild(tr);
  }
}

export function renderSVG(state: AppState) {
  const svgGrp = document.getElementById("squares-group")!;
  svgGrp.innerHTML = "";

  const overlaps = validatePuzzle(state.squares);
  const overlappingIds = new Set<number>();
  for (const pair of overlaps) {
    overlappingIds.add(pair[0]);
    overlappingIds.add(pair[1]);
  }

  const { minX, minY, L } = state.computedBoundingBoxRect || {
    minX: 0,
    minY: 0,
    L: 1,
  };
  const pad = Math.max(1.0, L * 0.1);
  const svg = document.getElementById("canvas")!;

  const vbX = minX - pad;
  const vbY = -(minY + L + pad);
  const vbW = L + pad * 2;
  const vbH = L + pad * 2;

  svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);

  const bboxRect = document.getElementById("bounding-box")!;
  bboxRect.setAttribute("x", minX.toString());
  bboxRect.setAttribute("y", (-(minY + L)).toString());
  bboxRect.setAttribute("width", L.toString());
  bboxRect.setAttribute("height", L.toString());

  const toggleBtn = document.getElementById("btn-toggle-numbers");
  if (toggleBtn) {
    if (state.showNumbers) {
      toggleBtn.style.background = "#e2e8f0";
      toggleBtn.style.color = "#0f172a";
    } else {
      toggleBtn.style.background = "#ffffff";
      toggleBtn.style.color = "#334155";
    }
  }

  for (const sq of state.squares) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const deg = ((-sq.angle * 180) / Math.PI).toFixed(4);
    const cy = -sq.y;
    const cx = sq.x;

    const rx = cx - 0.5;
    const ry = cy - 0.5;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.id = `rect-${sq.square_id}`;
    rect.setAttribute("x", rx.toString());
    rect.setAttribute("y", ry.toString());
    rect.setAttribute("width", "1");
    rect.setAttribute("height", "1");
    rect.setAttribute("class", "sq-poly");
    rect.setAttribute("transform", `rotate(${deg} ${cx} ${cy})`);

    if (state.selectedSquareId === sq.square_id) rect.classList.add("selected");
    if (overlappingIds.has(sq.square_id)) rect.classList.add("overlap");

    g.appendChild(rect);

    if (state.showNumbers) {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("x", cx.toString());
      text.setAttribute("y", cy.toString());
      text.setAttribute("class", "sq-number");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.textContent = sq.square_id.toString();
      g.appendChild(text);
    }

    g.onmousedown = (e) => {
      const customEvent = new CustomEvent("square-mousedown", {
        detail: { id: sq.square_id, event: e },
      });
      window.dispatchEvent(customEvent);
    };

    g.onmouseenter = () => {
      rect.classList.add("hover");
      document.getElementById(`row-${sq.square_id}`)?.classList.add("hover");
    };
    g.onmouseleave = () => {
      rect.classList.remove("hover");
      document.getElementById(`row-${sq.square_id}`)?.classList.remove("hover");
    };

    svgGrp.appendChild(g);
  }
}
