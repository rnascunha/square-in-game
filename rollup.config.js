import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "dist/main.js", // Read the compiled TS output
  output: {
    file: "build/bundle.js", // Output a single bundle
    format: "iife", // Immediately Invoked Function Expression (standard for browsers)
    name: "SquaresSolver",
  },
  plugins: [resolve()],
};
