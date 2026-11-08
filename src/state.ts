import { Square, AppState } from './types';
import { validatePuzzle, computeBoundingBoxRect } from './math';

export class StateManager {
    public state: AppState;
    private listeners: ((state: AppState) => void)[] = [];
    private warningTimeout: any = null;

    constructor(initialN: number = 5) {
        this.state = {
            n: initialN,
            squares: this.generateTrivialPacking(initialN),
            selectedSquareId: null,
            isValid: true,
            computedBoundingBox: 0,
            computedBoundingBoxRect: { minX: 0, minY: 0, L: 0 },
            puzzleName: `puzzle-${initialN}`,
            showNumbers: true,
            past: [],
            future: [],
            warningMessage: null
        };
        this.updateDerivedState();
    }

    public subscribe(listener: (state: AppState) => void) {
        this.listeners.push(listener);
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    private updateDerivedState() {
        const rect = computeBoundingBoxRect(this.state.squares);
        this.state.computedBoundingBoxRect = rect;
        this.state.computedBoundingBox = rect.L;
        this.state.isValid = validatePuzzle(this.state.squares).length === 0;
        this.notify();
    }

    public setWarning(msg: string) {
        this.state.warningMessage = msg;
        this.notify();
        clearTimeout(this.warningTimeout);
        this.warningTimeout = setTimeout(() => {
            this.state.warningMessage = null;
            this.notify();
        }, 2500);
    }

    public loadFullState(newState: AppState) {
        this.state = newState;
        this.updateDerivedState();
    }

    public setN(n: number) {
        this.commitHistory();
        this.state.n = n;
        this.state.puzzleName = `puzzle-${n}`;
        this.state.squares = this.generateTrivialPacking(n);
        this.state.selectedSquareId = null;
        this.updateDerivedState();
    }

    public setSquares(squares: Square[]) {
        this.commitHistory();
        this.state.squares = squares;
        this.updateDerivedState();
    }

    public updateSquare(id: number, updates: Partial<Square>, constrain: boolean = false, maxL?: number) {
        const sq = this.state.squares.find(s => s.square_id === id);
        if (!sq) return;

        if (constrain) {
            const currentL = this.state.computedBoundingBox;
            const limitL = maxL !== undefined ? maxL : currentL;
            
            const check = (testSq: Square) => {
                const testSquares = this.state.squares.map(s => s.square_id === id ? testSq : s);
                if (validatePuzzle(testSquares).length > 0) return false;
                if (computeBoundingBoxRect(testSquares).L > limitL + 1e-7) return false;
                return true;
            };

            const oldSq = { ...sq };
            
            // If it's already invalid, we just apply it (we only constrain moves starting from a valid state)
            if (check(oldSq)) {
                const targetSq = { ...oldSq, ...updates };
                if (check(targetSq)) {
                    Object.assign(sq, updates);
                } else {
                    // Binary search for the maximum allowed valid movement
                    let low = 0, high = 1, lastValid = oldSq;
                    for (let i = 0; i < 8; i++) {
                        let mid = (low + high) / 2;
                        let midSq = { ...oldSq };
                        if (updates.x !== undefined) midSq.x = oldSq.x + (updates.x - oldSq.x) * mid;
                        if (updates.y !== undefined) midSq.y = oldSq.y + (updates.y - oldSq.y) * mid;
                        if (updates.angle !== undefined) midSq.angle = oldSq.angle + (updates.angle - oldSq.angle) * mid;
                        
                        if (check(midSq)) {
                            low = mid;
                            lastValid = midSq;
                        } else {
                            high = mid;
                        }
                    }
                    
                    if (low > 0.001) {
                        Object.assign(sq, { x: lastValid.x, y: lastValid.y, angle: lastValid.angle });
                    }
                    this.setWarning("Movement limited by bounds or collision.");
                }
            } else {
                Object.assign(sq, updates);
            }
        } else {
            Object.assign(sq, updates);
        }
        
        this.updateDerivedState();
    }

    public selectSquare(id: number | null) {
        this.state.selectedSquareId = id;
        this.notify();
    }

    public toggleNumbers() {
        this.state.showNumbers = !this.state.showNumbers;
        this.notify();
    }

    public commitHistory() {
        this.state.past.push(JSON.parse(JSON.stringify(this.state.squares)));
        if (this.state.past.length > 30) this.state.past.shift();
        this.state.future = [];
    }

    public undo() {
        if (this.state.past.length === 0) return;
        this.state.future.push(JSON.parse(JSON.stringify(this.state.squares)));
        this.state.squares = this.state.past.pop()!;
        this.updateDerivedState();
    }

    public redo() {
        if (this.state.future.length === 0) return;
        this.state.past.push(JSON.parse(JSON.stringify(this.state.squares)));
        this.state.squares = this.state.future.pop()!;
        this.updateDerivedState();
    }

    public generateTrivialPacking(n: number): Square[] {
        const size = Math.ceil(Math.sqrt(n));
        const squares: Square[] = [];
        let id = 0;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (id < n) {
                    squares.push({
                        square_id: id,
                        x: col + 0.5,
                        y: row + 0.5,
                        angle: 0
                    });
                    id++;
                }
            }
        }
        return squares;
    }
}
export const store = new StateManager();
