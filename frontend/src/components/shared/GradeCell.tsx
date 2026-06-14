// GradeCell.tsx
const COLORS: Record<string, string> = {
  A: "text-[#1B6B3A] font-bold",
  B: "text-blue-700 font-bold",
  C: "text-[#8B5A00] font-bold",
  D: "text-orange-600 font-bold",
  F: "text-[#8B1A1A] font-bold",
};

function getGradeLetter(score: number): string {
  if (score >= 95) return "A";
  if (score >= 85) return "B";
  if (score >= 78) return "C";
  if (score >= 70) return "D";
  return "F";
}

export function GradeCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-[#8A9ABB] text-xs">—</span>;
  }
  const letter = getGradeLetter(value);
  return (
    <span className={`font-mono text-sm ${COLORS[letter] ?? ""}`}>
      {value.toFixed(1)}
    </span>
  );
}

export function GradeBadge({ letter }: { letter: string | null }) {
  if (!letter) return <span className="text-[#8A9ABB] text-xs">—</span>;
  return (
    <span className={`font-mono text-sm font-bold ${COLORS[letter] ?? ""}`}>
      {letter}
    </span>
  );
}
