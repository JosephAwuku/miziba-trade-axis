"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ST as stageConfig } from '@/lib/data';

interface StageBarChartProps {
  data: Record<string, number>;
}

type StageTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string; color: string };
  }>;
};

function StageBarChartTooltip({ active, payload }: StageTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fff',
        padding: '8px 12px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '2px' }}>{payload[0].payload.name}</div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: payload[0].payload.color }}>
          {payload[0].value} {payload[0].value === 1 ? 'Deal' : 'Deals'}
        </div>
      </div>
    );
  }
  return null;
}

const StageBarChart: React.FC<StageBarChartProps> = ({ data }) => {
  const chartData = Object.keys(data)
    .filter(key => data[key] > 0)
    .map(key => ({
      name: stageConfig[key]?.l || key,
      count: data[key],
      color: stageConfig[key]?.c || '#6B7280',
    }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F3F4F6" />
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            axisLine={false}
            tickLine={false}
            fontSize={10}
            fontWeight={600}
            width={120}
          />
          <Tooltip content={<StageBarChartTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StageBarChart;
