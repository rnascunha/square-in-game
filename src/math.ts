import { Square } from './types';
import { CONFIG } from './config';

export type Point = { x: number; y: number };

export function getCorners(sq: Square): Point[] {
    const half = 0.5;
    const corners = [
        { x: -half, y: -half },
        { x: half, y: -half },
        { x: half, y: half },
        { x: -half, y: half }
    ];
    const c = Math.cos(sq.angle);
    const s = Math.sin(sq.angle);
    return corners.map(pt => ({
        x: (pt.x * c - pt.y * s) + sq.x,
        y: (pt.x * s + pt.y * c) + sq.y
    }));
}

function getAxes(corners: Point[]): Point[] {
    const axes: Point[] = [];
    for (let i = 0; i < 2; i++) {
        const p1 = corners[i]!;
        const p2 = corners[i + 1]!;
        const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
        const length = Math.hypot(edge.x, edge.y);
        axes.push({ x: -edge.y / length, y: edge.x / length });
    }
    return axes;
}

function project(corners: Point[], axis: Point): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    for (const pt of corners) {
        const dot = pt.x * axis.x + pt.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
}

export function isOverlapping(sq1: Square, sq2: Square): boolean {
    const c1 = getCorners(sq1);
    const c2 = getCorners(sq2);
    const axes = [...getAxes(c1), ...getAxes(c2)];
    for (const axis of axes) {
        const p1 = project(c1, axis);
        const p2 = project(c2, axis);
        if (p1.max <= p2.min + CONFIG.MATH.SAT_TOLERANCE || 
            p2.max <= p1.min + CONFIG.MATH.SAT_TOLERANCE) {
            return false;
        }
    }
    return true;
}

export function validatePuzzle(squares: Square[]): [number, number][] {
    const overlaps: [number, number][] = [];
    for (let i = 0; i < squares.length; i++) {
        for (let j = i + 1; j < squares.length; j++) {
            const sq1 = squares[i]!;
            const sq2 = squares[j]!;
            if (isOverlapping(sq1, sq2)) {
                overlaps.push([sq1.square_id, sq2.square_id]);
            }
        }
    }
    return overlaps;
}

export function computeBoundingBoxRect(squares: Square[]): { minX: number, minY: number, L: number } {
    if (squares.length === 0) return { minX: 0, minY: 0, L: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sq of squares) {
        const corners = getCorners(sq);
        for (const pt of corners) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        }
    }
    return { minX, minY, L: Math.max(maxX - minX, maxY - minY) };
}

export function computeBoundingBox(squares: Square[]): number {
    return computeBoundingBoxRect(squares).L;
}
