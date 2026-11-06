import { store } from './state';
import { renderDashboard, renderTable, renderSVG } from './ui';
import { fetchProvenDatabase, exportToJSON, parseImportedJSON } from './io';
import { CONFIG } from './config';
import { PuzzlePacking } from './types';

let provenDatabase: Record<number, PuzzlePacking> = {};
let importedPuzzles: PuzzlePacking[] = [];

// --- Interaction State ---
let isDragging = false;
let startMousePt = { x: 0, y: 0 };
let startSqPt = { x: 0, y: 0 };

function getSVGPoint(e: MouseEvent) {
    const svg = document.getElementById('canvas') as any as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}

async function init() {
    provenDatabase = await fetchProvenDatabase();
    updateProvenButtonState(store.state.n);

    // Initial render
    store.subscribe((state) => {
        renderDashboard(state);
        renderTable(state, (id, field, val) => store.updateSquare(id, { [field]: val }));
        renderSVG(state);
    });

    // Fire initial state
    store.setN(5); 
    setupEventListeners();
}

function updateProvenButtonState(n: number) {
    const btn = document.getElementById('btn-proven') as HTMLButtonElement;
    if (provenDatabase[n]) {
        btn.disabled = false;
        btn.title = `Proven by: ${provenDatabase[n].proven_by || 'Unknown'}`;
    } else {
        btn.disabled = true;
        btn.title = 'No proven configuration found for this N.';
    }
}

function loadPuzzleFromIndex(idx: number) {
    const targetPuzzle = importedPuzzles[idx];
    if (!targetPuzzle) return;
    
    (document.getElementById('ui-n') as HTMLInputElement).value = targetPuzzle.n.toString();
    store.setN(targetPuzzle.n);
    store.setSquares(targetPuzzle.squares);
    
    if (targetPuzzle.rule_category) {
        store.state.puzzleName = targetPuzzle.rule_category;
    } else {
        store.state.puzzleName = `imported-${targetPuzzle.n}`;
    }
    (document.getElementById('ui-name') as HTMLInputElement).value = store.state.puzzleName;
    updateProvenButtonState(targetPuzzle.n);
}

function setupEventListeners() {
    // Top bar inputs
    document.getElementById('ui-n')!.addEventListener('change', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        if (!isNaN(val) && val > 0) {
            store.setN(val);
            updateProvenButtonState(val);
        }
    });

    document.getElementById('ui-name')!.addEventListener('input', (e) => {
        store.state.puzzleName = (e.target as HTMLInputElement).value;
    });

    // Buttons
    document.getElementById('btn-trivial')!.addEventListener('click', () => {
        store.setSquares(store.generateTrivialPacking(store.state.n));
    });

    document.getElementById('btn-random')!.addEventListener('click', () => {
        const L = Math.ceil(Math.sqrt(store.state.n));
        const randomSquares = store.state.squares.map(sq => ({
            ...sq,
            x: 0.5 + Math.random() * (L - 1),
            y: 0.5 + Math.random() * (L - 1),
            angle: Math.random() * Math.PI / 2
        }));
        store.setSquares(randomSquares);
    });

    document.getElementById('btn-proven')!.addEventListener('click', () => {
        const p = provenDatabase[store.state.n];
        if (p) store.setSquares(p.squares);
    });

    document.getElementById('btn-export')!.addEventListener('click', () => {
        exportToJSON(store.state.n, store.state.squares, store.state.puzzleName, store.state.computedBoundingBox);
    });

    // Import Event & Dropdown
    document.getElementById('file-import')!.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = parseImportedJSON(JSON.parse(event.target?.result as string));
                    if (parsed.length > 0) {
                        importedPuzzles = parsed;
                        const selectEl = document.getElementById('ui-loaded-puzzles') as HTMLSelectElement;
                        
                        selectEl.innerHTML = '<option value="">-- Select Puzzle --</option>';
                        parsed.forEach((p, idx) => {
                            const opt = document.createElement('option');
                            opt.value = idx.toString();
                            opt.textContent = `n=${p.n} (${p.rule_category || 'Imported'})`;
                            selectEl.appendChild(opt);
                        });
                        
                        selectEl.style.display = 'inline-block';
                        selectEl.value = "0";
                        loadPuzzleFromIndex(0); 
                    }
                } catch (err) {
                    alert("Failed to parse JSON.");
                }
            };
            reader.readAsText(file);
        }
    });

    document.getElementById('ui-loaded-puzzles')!.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLSelectElement).value);
        if (!isNaN(idx)) {
            loadPuzzleFromIndex(idx);
        }
    });

    // Modal Listeners
    const helpModal = document.getElementById('modal-help')!;
    const aboutModal = document.getElementById('modal-about')!;
    
    document.getElementById('btn-help')!.addEventListener('click', () => {
        helpModal.classList.add('show');
    });
    
    document.getElementById('btn-about')!.addEventListener('click', () => {
        aboutModal.classList.add('show');
    });
    
    document.getElementById('close-help')!.addEventListener('click', () => {
        helpModal.classList.remove('show');
    });
    
    document.getElementById('close-about')!.addEventListener('click', () => {
        aboutModal.classList.remove('show');
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.classList.remove('show');
        if (e.target === aboutModal) aboutModal.classList.remove('show');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        const id = store.state.selectedSquareId;
        if (id === null) return;
        if ((e.target as HTMLElement).tagName === 'INPUT') return;

        const sq = store.state.squares.find(s => s.square_id === id);
        if (!sq) return;

        const transStep = e.shiftKey ? CONFIG.MATH.TRANSLATE_STEP_SMALL : CONFIG.MATH.TRANSLATE_STEP;
        const rotStep = e.shiftKey ? CONFIG.MATH.ROTATE_STEP_SMALL : CONFIG.MATH.ROTATE_STEP;

        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup':
                store.updateSquare(id, { y: sq.y + transStep });
                break;
            case 's': case 'arrowdown':
                store.updateSquare(id, { y: sq.y - transStep });
                break;
            case 'a': case 'arrowleft':
                store.updateSquare(id, { x: sq.x - transStep });
                break;
            case 'd': case 'arrowright':
                store.updateSquare(id, { x: sq.x + transStep });
                break;
            case 'q':
                store.updateSquare(id, { angle: sq.angle + rotStep });
                break;
            case 'e':
                store.updateSquare(id, { angle: sq.angle - rotStep });
                break;
            default:
                handled = false;
        }
        if (handled) e.preventDefault();
    });

    // Custom Event Listeners
    window.addEventListener('square-selected', ((e: CustomEvent) => {
        store.selectSquare(e.detail.id);
    }) as EventListener);

    window.addEventListener('square-mousedown', ((e: CustomEvent) => {
        store.selectSquare(e.detail.id);
        const sq = store.state.squares.find(s => s.square_id === e.detail.id);
        if (sq) {
            isDragging = true;
            startMousePt = getSVGPoint(e.detail.event);
            startSqPt = { x: sq.x, y: sq.y };
        }
    }) as EventListener);

    // Global drag handling
    window.addEventListener('mousemove', (e) => {
        if (!isDragging || store.state.selectedSquareId === null) return;
        const id = store.state.selectedSquareId;
        
        const pt = getSVGPoint(e);
        const dx = pt.x - startMousePt.x;
        const dy = pt.y - startMousePt.y; 
        
        store.updateSquare(id, {
            x: startSqPt.x + dx,
            y: startSqPt.y - dy 
        });
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

window.onload = init;
