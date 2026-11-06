export interface Square {
    square_id: number;
    x: number;
    y: number;
    angle: number;
}

export interface PuzzlePacking {
    n: number;
    squares: Square[];
    s_exact?: string;
    s_numeric: number;
    proven_by?: string;
    rule_category?: string;
}

export interface SubmissionEngine {
    solutions: Record<number, PuzzlePacking>;
}

export interface AppState {
    n: number;
    squares: Square[];
    selectedSquareId: number | null;
    isValid: boolean;
    computedBoundingBox: number;
    computedBoundingBoxRect: { minX: number; minY: number; L: number };
    puzzleName: string;
}
