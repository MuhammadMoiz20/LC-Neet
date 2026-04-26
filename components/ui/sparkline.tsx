export type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
};

export function Sparkline({ values, width = 80, height = 22 }: SparklineProps) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const denom = values.length > 1 ? values.length - 1 : 1;
  const pts = values
    .map((v, i) => {
      const x = (i / denom) * width;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="spark-svg">
      <polyline points={pts} className="spark" />
    </svg>
  );
}
