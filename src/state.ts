import { Square, AppState } from './types';
import { validatePuzzle, computeBoundingBoxRect } from './math';

export class StateManager {
    public state: AppState;
    private listeners: ((state: AppState) => void)[] = [];

    constructor(initialN: number = 5) {
        this.state = {
            n: initialN,
            squares: this.generateTrivialPacking(initialN),
            selectedSquareId: null,
            isValid: true,
            computedBoundingBox: 0,
            computedBoundingBoxRect: { minX: 0, minY: 0, L: 0 },
            puzzleName: `puzzle-${initialN}`
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

    public setN(n: number) {
        this.state.n = n;
        this.state.puzzleName = `puzzle-${n}`;
        this.state.squares = this.generateTrivialPacking(n);
        this.state.selectedSquareId = null;
        this.updateDerivedState();
    }

    public setSquares(squares: Square[]) {
        this.state.squares = squares;
        this.updateDerivedState();
    }

    public updateSquare(id: number, updates: Partial<Square>) {
        const sq = this.state.squares.find(s => s.square_id === id);
        if (sq) {
            Object.assign(sq, updates);
            this.updateDerivedState();
        }
    }

    public selectSquare(id: number | null) {
        this.state.selectedSquareId = id;
        this.notify();
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
