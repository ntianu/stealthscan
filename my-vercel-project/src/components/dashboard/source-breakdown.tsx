"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  source: string;
  count: number;
}

interface SourceBreakdownProps {
  data: DataPoint[];
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

interface LabelProps {
  source?: string;
  percent?: number;
}

function renderLabel({ source, percent }: LabelProps) {
  if (!source || !percent || percent <= 0.05) return "";
  return `${source} ${Math.round(percent * 100)}%`;
}

export function SourceBreakdown({ data }: SourceBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No jobs discovered yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="source"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          label={renderLabel}
          labelLine={false}
        >
          {data.map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          formatter={(value) => [
            typeof value === "number" ? value : 0,
            "Jobs",
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
