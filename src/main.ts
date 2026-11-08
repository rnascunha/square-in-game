import { store } from './state';
import { renderDashboard, renderTable, renderSVG } from './ui';
import { fetchProvenDatabase, exportToJSON, parseImportedJSON } from './io';
import { CONFIG } from './config';
import { PuzzlePacking } from './types';
import { saveGameToDB, loadGameFromDB, deleteGameFromDB, clearAllGamesDB, getAllGameKeys } from './db';

let provenDatabase: Record<number, PuzzlePacking> = {};
let importedPuzzles: PuzzlePacking[] = [];

// --- Interaction State ---
let isDragging = false;
let startMousePt = { x: 0, y: 0 };
let startSqPt = { x: 0, y: 0 };
let startL = 0;
let autosaveTimeout: any;

let numberBuffer = "";
let numberTimeout: any = null;

function getSVGPoint(e: MouseEvent) {
    const svg = document.getElementById('canvas') as any as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}

async function refreshDBDropdown() {
    const keys = await getAllGameKeys();
    const select = document.getElementById('db-select') as HTMLSelectElement;
    select.innerHTML = '<option value="">-- Select Game --</option>';
    keys.forEach(k => {
        if (k !== '_autosave_') {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            select.appendChild(opt);
        }
    });
}

async function init() {
    provenDatabase = await fetchProvenDatabase();
    
    const saved = await loadGameFromDB('_autosave_');
    if (saved) {
        store.loadFullState(saved);
    } else {
        store.setN(5); 
    }
    
    updateProvenButtonState(store.state.n);
    await refreshDBDropdown();

    store.subscribe((state) => {
        renderDashboard(state);
        renderTable(state, (id, field, val) => store.updateSquare(id, { [field]: val }, false));
        renderSVG(state);
        
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => {
            saveGameToDB('_autosave_', state);
        }, 500);
    });

    store.selectSquare(store.state.selectedSquareId);
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
    
    document.getElementById('btn-db-save')!.addEventListener('click', async () => {
        const name = store.state.puzzleName.trim();
        if (!name) { alert("Please provide a name."); return; }
        await saveGameToDB(name, store.state);
        await refreshDBDropdown();
        alert(`Saved successfully as '${name}'`);
    });

    document.getElementById('btn-db-load')!.addEventListener('click', async () => {
        const select = document.getElementById('db-select') as HTMLSelectElement;
        const name = select.value;
        if (!name) return;
        const state = await loadGameFromDB(name);
        if (state) {
            store.loadFullState(state);
            updateProvenButtonState(state.n);
        }
    });

    document.getElementById('btn-db-delete')!.addEventListener('click', async () => {
        const select = document.getElementById('db-select') as HTMLSelectElement;
        const name = select.value;
        if (!name) return;
        if (confirm(`Are you sure you want to delete '${name}'?`)) {
            await deleteGameFromDB(name);
            await refreshDBDropdown();
        }
    });

    document.getElementById('btn-db-clear')!.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to clear all saved games? This cannot be undone.`)) {
            await clearAllGamesDB();
            await refreshDBDropdown();
        }
    });
    
    document.getElementById('btn-toggle-numbers')!.addEventListener('click', () => store.toggleNumbers());
    document.getElementById('btn-undo')!.addEventListener('click', () => store.undo());
    document.getElementById('btn-redo')!.addEventListener('click', () => store.redo());

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

    const helpModal = document.getElementById('modal-help');
    const infoModal = document.getElementById('modal-info');
    
    if (document.getElementById('btn-help') && helpModal) {
        document.getElementById('btn-help')!.addEventListener('click', () => { helpModal.classList.add('show'); });
        document.getElementById('close-help')!.addEventListener('click', () => { helpModal.classList.remove('show'); });
    }
    
    if (document.getElementById('btn-info') && infoModal) {
        document.getElementById('btn-info')!.addEventListener('click', () => { infoModal.classList.add('show'); });
        document.getElementById('close-info')!.addEventListener('click', () => { infoModal.classList.remove('show'); });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal?.classList.remove('show');
        if (e.target === infoModal) infoModal?.classList.remove('show');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z') { e.preventDefault(); store.undo(); return; }
            if (e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }
        }

        const activeEl = document.activeElement;
        const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'SELECT';

        if (e.key === 'Tab') {
            if (isInput) return;
            e.preventDefault();
            
            const total = store.state.n;
            if (total === 0) return;
            
            let current = store.state.selectedSquareId;
            if (current === null) {
                current = e.shiftKey ? total : -1;
            }
            
            let next = e.shiftKey ? current - 1 : current + 1;
            if (next < 0) next = total - 1;
            if (next >= total) next = 0;
            
            store.selectSquare(next);
            return;
        }

        // Feature 1: Number typing to select
        if (!isInput && e.key >= '0' && e.key <= '9') {
            numberBuffer += e.key;
            clearTimeout(numberTimeout);
            numberTimeout = setTimeout(() => { numberBuffer = ""; }, 800);
            
            const targetId = parseInt(numberBuffer);
            if (!isNaN(targetId) && targetId < store.state.n) {
                store.selectSquare(targetId);
            }
            return;
        }

        const id = store.state.selectedSquareId;
        if (id === null) return;
        if (isInput) return;

        const sq = store.state.squares.find(s => s.square_id === id);
        if (!sq) return;

        const transStep = e.shiftKey ? CONFIG.MATH.TRANSLATE_STEP_SMALL : CONFIG.MATH.TRANSLATE_STEP;
        const rotStep = e.shiftKey ? CONFIG.MATH.ROTATE_STEP_SMALL : CONFIG.MATH.ROTATE_STEP;
        const constrain = e.ctrlKey || e.metaKey;

        const moveKeys = ['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'];
        if (moveKeys.includes(e.key.toLowerCase())) {
            if (!e.repeat) store.commitHistory();

            switch (e.key.toLowerCase()) {
                case 'w': case 'arrowup':
                    store.updateSquare(id, { y: sq.y + transStep }, constrain);
                    break;
                case 's': case 'arrowdown':
                    store.updateSquare(id, { y: sq.y - transStep }, constrain);
                    break;
                case 'a': case 'arrowleft':
                    store.updateSquare(id, { x: sq.x - transStep }, constrain);
                    break;
                case 'd': case 'arrowright':
                    store.updateSquare(id, { x: sq.x + transStep }, constrain);
                    break;
                case 'q':
                    store.updateSquare(id, { angle: sq.angle + rotStep }, constrain);
                    break;
                case 'e':
                    store.updateSquare(id, { angle: sq.angle - rotStep }, constrain);
                    break;
            }
            e.preventDefault();
        }
    });

    window.addEventListener('square-selected', ((e: CustomEvent) => {
        store.selectSquare(e.detail.id);
    }) as EventListener);

    window.addEventListener('square-mousedown', ((e: CustomEvent) => {
        store.selectSquare(e.detail.id);
        const sq = store.state.squares.find(s => s.square_id === e.detail.id);
        if (sq) {
            store.commitHistory(); 
            isDragging = true;
            startMousePt = getSVGPoint(e.detail.event);
            startSqPt = { x: sq.x, y: sq.y };
            startL = store.state.computedBoundingBox;
        }
    }) as EventListener);

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || store.state.selectedSquareId === null) return;
        const id = store.state.selectedSquareId;
        
        const pt = getSVGPoint(e);
        const dx = pt.x - startMousePt.x;
        const dy = pt.y - startMousePt.y; 
        const constrain = e.ctrlKey || e.metaKey;
        
        store.updateSquare(id, {
            x: startSqPt.x + dx,
            y: startSqPt.y - dy 
        }, constrain, startL);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

window.onload = init;
