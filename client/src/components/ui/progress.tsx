import React from "react";

interface ProgressProps {
  value: number; // 0-100
}

export const ProgressBar: React.FC<ProgressProps> = ({ value }) => {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded">
      <div
        className="h-full bg-blue-600 rounded transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
