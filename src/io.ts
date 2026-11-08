import { PuzzlePacking, Square } from "./types";
import { CONFIG } from "./config";

export async function fetchProvenDatabase(): Promise<
  Record<number, PuzzlePacking>
> {
  try {
    const response = await fetch(CONFIG.PATHS.PROVEN_DATA);
    if (!response.ok) throw new Error("Failed to fetch proven database");
    const data = await response.json();
    return data.solutions || {};
  } catch (error) {
    console.warn(
      "Could not load proven.json. Operating without proven fallbacks.",
      error,
    );
    return {};
  }
}

export function parseImportedJSON(jsonData: any): PuzzlePacking[] {
  // Handles flat array (single packing) or SubmissionEngine nested dictionary
  if (Array.isArray(jsonData)) {
    if (jsonData.length > 0 && jsonData[0].square_id !== undefined) {
      const n = jsonData[0].n || jsonData.length;
      return [
        {
          n: n,
          squares: jsonData as Square[],
          s_numeric: 0, // To be computed by state
        },
      ];
    }
  } else if (jsonData.solutions) {
    return Object.values(jsonData.solutions);
  }
  return [];
}

export function exportToJSON(
  n: number,
  squares: Square[],
  puzzleName: string,
  computedL: number,
) {
  const payload = {
    solutions: {
      [n.toString()]: {
        n: n,
        squares: squares,
        s_numeric: computedL,
        rule_category: puzzleName,
      },
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${puzzleName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
