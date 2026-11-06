export const CONFIG = {
    PATHS: {
        PROVEN_DATA: './data/proven.json',
    },
    MATH: {
        SAT_TOLERANCE: 1e-7,
        TRANSLATE_STEP: 0.1,
        TRANSLATE_STEP_SMALL: 0.01,
        ROTATE_STEP: Math.PI / 36, // 5 degrees
        ROTATE_STEP_SMALL: Math.PI / 180, // 1 degree
    },
    UI: {
        COLORS: {
            OVERLAP: '#dc2626', // Red
            SELECTED: '#fde047', // Yellow
            DEFAULT: '#86efac', // Green
            HOVER: '#fef08a' // Light Yellow
        }
    }
};
