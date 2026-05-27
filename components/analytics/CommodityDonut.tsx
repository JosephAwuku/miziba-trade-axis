"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { usd } from '@/lib/utils';
import { CMD as commodityConfig } from '@/lib/data';

interface CommodityDonutProps {
  data: Record<string, number>;
}

type DonutTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { color: string };
  }>;
};

function CommodityDonutTooltip({ active, payload }: DonutTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fff',
        padding: '10px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '2px' }}>{payload[0].name}</div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: payload[0].payload.color }}>
          {usd(payload[0].value)}
        </div>
      </div>
    );
  }
  return null;
}

const CommodityDonut: React.FC<CommodityDonutProps> = ({ data }) => {
  const chartData = Object.keys(data).map(key => ({
    name: commodityConfig[key]?.l || key,
    value: data[key],
    color: commodityConfig[key]?.c || '#6B7280',
  })).sort((a, b) => b.value - a.value);

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CommodityDonutTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CommodityDonut;
