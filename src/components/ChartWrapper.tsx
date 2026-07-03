import dynamic from 'next/dynamic';
import React from 'react';

// Lazy load heavy chart component
const HeavyChart = dynamic(() => import('./HeavyChartPlaceholder'), { ssr: false, loading: () => <p>Loading chart...</p> });

export const ChartWrapper = () => {
  return <div><HeavyChart /></div>;
};
