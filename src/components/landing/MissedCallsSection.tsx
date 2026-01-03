import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * MissedCallsSection - Interactive conversion visualization
 * Shows how response time affects lead conversion with an interactive graph
 */

interface DataPoint {
  time: number;
  rate: number;
  label: string;
  message: string;
}

const dataPoints: DataPoint[] = [
  { time: 0, rate: 78, label: 'Instant', message: 'Maximum conversion potential' },
  { time: 1, rate: 74, label: '1 min', message: 'Still in the golden window' },
  { time: 5, rate: 62, label: '5 min', message: 'End of optimal response time' },
  { time: 10, rate: 47, label: '10 min', message: 'Significant drop begins' },
  { time: 15, rate: 35, label: '15 min', message: 'Half your leads are gone' },
  { time: 30, rate: 23, label: '30 min', message: 'Only 23% chance remains' },
  { time: 60, rate: 16, label: '1 hour', message: 'Most opportunity lost' },
  { time: 120, rate: 8, label: '2 hours', message: 'Nearly impossible to convert' },
];

// SVG dimensions
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 300;
const PADDING = { top: 50, right: 50, bottom: 50, left: 50 };
const GRAPH_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
const GRAPH_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;
const MAX_MINUTES = 120;
const MAX_RATE = 78; // Maximum conversion rate (top of graph)

function xScale(minutes: number): number {
  return PADDING.left + (minutes / MAX_MINUTES) * GRAPH_WIDTH;
}

function yScale(rate: number): number {
  return PADDING.top + ((MAX_RATE - rate) / MAX_RATE) * GRAPH_HEIGHT;
}

function getColorForRate(rate: number): string {
  if (rate >= 60) return '#22c55e';
  if (rate >= 40) return '#eab308';
  if (rate >= 20) return '#f97316';
  return '#ef4444';
}

function getColorClass(rate: number): string {
  if (rate >= 60) return 'good';
  if (rate >= 40) return 'warning';
  if (rate >= 20) return 'danger';
  return 'critical';
}

function formatTime(minutes: number): string {
  if (minutes < 1) return 'Instant (0 min)';
  if (minutes < 60) return Math.round(minutes) + ' min';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return hours + ' hour' + (hours > 1 ? 's' : '');
  return hours + 'h ' + mins + 'm';
}

function generatePath(points: DataPoint[]): string {
  if (points.length < 2) return '';

  let path = `M ${xScale(points[0].time)} ${yScale(points[0].rate)}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const cp1x = xScale(prev.time) + (xScale(curr.time) - xScale(prev.time)) / 3;
    const cp1y = yScale(prev.rate);
    const cp2x = xScale(curr.time) - (xScale(curr.time) - xScale(prev.time)) / 3;
    const cp2y = yScale(curr.rate);

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${xScale(curr.time)} ${yScale(curr.rate)}`;
  }

  return path;
}

function generateAreaPath(points: DataPoint[]): string {
  const linePath = generatePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${linePath} L ${xScale(lastPoint.time)} ${SVG_HEIGHT - PADDING.bottom} L ${xScale(firstPoint.time)} ${SVG_HEIGHT - PADDING.bottom} Z`;
}

function interpolateRate(minutes: number): number {
  for (let i = 1; i < dataPoints.length; i++) {
    if (minutes <= dataPoints[i].time) {
      const prev = dataPoints[i - 1];
      const curr = dataPoints[i];
      const t = (minutes - prev.time) / (curr.time - prev.time);
      return prev.rate + (curr.rate - prev.rate) * t;
    }
  }
  return dataPoints[dataPoints.length - 1].rate;
}

function getActiveZone(minutes: number): string {
  if (minutes <= 5) return 'green';
  if (minutes <= 15) return 'yellow';
  if (minutes <= 30) return 'orange';
  return 'red';
}

export function MissedCallsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const minutes = (sliderValue / 100) * MAX_MINUTES;
  const rate = Math.round(interpolateRate(minutes));
  const leadsLost = 100 - rate;
  const activeZone = getActiveZone(minutes);
  const converted = Math.round((rate / 100) * 70 * 0.5 + (rate / 100) * 30 * 0.1);

  const stopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle drag on graph
  const handleDrag = useCallback((clientX: number) => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const svgWidth = rect.width;

    // Calculate position relative to the graph area (5% padding on each side)
    const relativeX = (clientX - rect.left) / svgWidth;
    const graphStart = 0.05; // 5% = 50/1000
    const graphEnd = 0.95;   // 95% = 950/1000

    // Map to slider value (0-100)
    const normalized = (relativeX - graphStart) / (graphEnd - graphStart);
    const newValue = Math.max(0, Math.min(100, normalized * 100));

    stopAutoPlay();
    setSliderValue(newValue);
  }, [stopAutoPlay]);

  // Mouse/touch event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    handleDrag(e.clientX);
  }, [handleDrag]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handleDrag(e.clientX);
    }
  }, [isDragging, handleDrag]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    handleDrag(e.touches[0].clientX);
  }, [handleDrag]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging && e.touches.length > 0) {
      handleDrag(e.touches[0].clientX);
    }
  }, [isDragging, handleDrag]);

  // Add/remove global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);


  // Observe section visibility - reset to start when becoming visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible;
        const nowVisible = entry.isIntersecting;

        if (nowVisible && !wasVisible) {
          // Section just became visible - reset to start and enable auto-play
          setSliderValue(0);
          setIsAutoPlaying(true);
        }

        setIsVisible(nowVisible);
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  // Auto-play animation - stops at 1 hour (50%)
  useEffect(() => {
    if (!isAutoPlaying || !isVisible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSliderValue((prev) => {
        // Stop at 1 hour (50% of 120 minutes = 60 minutes)
        if (prev >= 50) {
          setIsAutoPlaying(false);
          return 50;
        }
        return prev + 0.5;
      });
    }, 50);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoPlaying, isVisible]);

  const linePath = generatePath(dataPoints);
  const areaPath = generateAreaPath(dataPoints);

  return (
    <section ref={sectionRef} className="interactive-section">
      <style>{`
        .interactive-section {
          min-height: 100vh;
          padding: 80px 24px 60px;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          position: relative;
          overflow: hidden;
        }

        .mc-container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .section-header {
          text-align: center;
          margin-bottom: 48px;
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: hsl(var(--primary) / 0.15);
          border: 1px solid hsl(var(--primary) / 0.3);
          border-radius: 100px;
          font-size: 14px;
          font-weight: 500;
          color: hsl(var(--primary));
          margin-bottom: 20px;
        }

        .section-title {
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .section-title .highlight {
          background: linear-gradient(135deg, #f87171 0%, #fb923c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .section-subtitle {
          font-size: 18px;
          color: hsl(var(--muted-foreground));
          max-width: 600px;
          margin: 0 auto;
        }

        .graph-container {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          padding: 40px;
          margin-bottom: 40px;
        }

        .graph-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .graph-title {
          font-size: 20px;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .graph-description {
          font-size: 14px;
          color: hsl(var(--muted-foreground));
          margin-top: 4px;
        }

        .current-stats {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .stat-box {
          text-align: right;
        }

        .stat-box-label {
          font-size: 12px;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-box-value {
          font-size: 32px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          transition: color 0.3s ease;
        }

        .stat-box-value.good { color: #4ade80; }
        .stat-box-value.warning { color: #fbbf24; }
        .stat-box-value.danger { color: #f87171; }
        .stat-box-value.critical { color: #dc2626; }

        .graph-wrapper {
          position: relative;
          margin-bottom: 24px;
        }

        .graph-svg {
          width: 100%;
          height: 300px;
          overflow: visible;
        }

        .grid-line {
          stroke: hsl(var(--border));
          stroke-width: 1;
        }

        .axis-label {
          fill: hsl(var(--muted-foreground));
          font-size: 12px;
        }

        .position-line {
          stroke: hsl(var(--foreground));
        }

        .graph-line {
          fill: none;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .data-point {
          cursor: pointer;
          transition: r 0.2s ease, filter 0.2s ease;
        }

        .data-point:hover {
          filter: drop-shadow(0 0 12px currentColor);
        }

        .graph-hint {
          text-align: center;
          font-size: 13px;
          color: hsl(var(--muted-foreground));
          margin-top: 12px;
        }

        .zones-container {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 32px;
        }

        .zone-card {
          background: hsl(var(--card) / 0.5);
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          transition: all 0.3s ease;
          opacity: 0.5;
        }

        .zone-card.active {
          opacity: 1;
          transform: translateY(-2px);
        }

        .zone-card.green { border-color: rgba(34, 197, 94, 0.3); }
        .zone-card.green.active { background: rgba(34, 197, 94, 0.1); box-shadow: 0 4px 20px rgba(34, 197, 94, 0.2); }

        .zone-card.yellow { border-color: rgba(234, 179, 8, 0.3); }
        .zone-card.yellow.active { background: rgba(234, 179, 8, 0.1); box-shadow: 0 4px 20px rgba(234, 179, 8, 0.2); }

        .zone-card.orange { border-color: rgba(249, 115, 22, 0.3); }
        .zone-card.orange.active { background: rgba(249, 115, 22, 0.1); box-shadow: 0 4px 20px rgba(249, 115, 22, 0.2); }

        .zone-card.red { border-color: rgba(239, 68, 68, 0.3); }
        .zone-card.red.active { background: rgba(239, 68, 68, 0.1); box-shadow: 0 4px 20px rgba(239, 68, 68, 0.2); }

        .zone-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .zone-time {
          font-size: 13px;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin-bottom: 4px;
        }

        .zone-label {
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .funnel-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-bottom: 48px;
        }

        .funnel-card {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 16px;
          padding: 32px;
        }

        .funnel-title {
          font-size: 16px;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .funnel-title svg {
          width: 20px;
          height: 20px;
        }

        .funnel-visual {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .funnel-bar {
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.5s ease;
          position: relative;
          overflow: hidden;
        }

        .funnel-bar::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transform: translateX(-100%);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        .funnel-bar.incoming {
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          width: 100%;
        }

        .funnel-bar.answered {
          background: linear-gradient(90deg, #22c55e, #16a34a);
        }

        .funnel-bar.missed {
          background: linear-gradient(90deg, #ef4444, #dc2626);
        }

        .funnel-bar.converted {
          background: linear-gradient(90deg, #8b5cf6, #7c3aed);
        }

        .funnel-bar-label {
          color: white;
          z-index: 1;
        }

        .funnel-bar-value {
          color: white;
          font-weight: 700;
          z-index: 1;
        }

        .comparison-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 24px;
          align-items: center;
          margin-bottom: 48px;
        }

        .comparison-card {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 16px;
          padding: 32px;
          text-align: center;
        }

        .comparison-card.bad {
          border-color: rgba(239, 68, 68, 0.2);
        }

        .comparison-card.good {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .comparison-label {
          font-size: 12px;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }

        .comparison-value {
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .comparison-card.bad .comparison-value { color: #f87171; }
        .comparison-card.good .comparison-value { color: #4ade80; }

        .comparison-text {
          font-size: 14px;
          color: hsl(var(--muted-foreground));
        }

        .comparison-arrow {
          font-size: 32px;
          color: hsl(var(--primary));
        }

        .cta-section {
          text-align: center;
          padding: 48px;
          background: linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(260 84% 55% / 0.1) 100%);
          border: 1px solid hsl(var(--primary) / 0.2);
          border-radius: 20px;
        }

        .cta-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .cta-text {
          font-size: 18px;
          color: hsl(var(--muted-foreground));
          margin-bottom: 32px;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta-text .emphasis {
          color: #4ade80;
          font-weight: 600;
        }

        .cta-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 16px 32px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          border: none;
        }

        .cta-button.primary {
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(217 91% 50%) 100%);
          color: white;
          box-shadow: 0 4px 14px hsl(var(--primary) / 0.4);
        }

        .cta-button.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px hsl(var(--primary) / 0.5);
        }

        .cta-button.secondary {
          background: hsl(var(--card) / 0.5);
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
        }

        .cta-button.secondary:hover {
          background: hsl(var(--card));
        }

        .cta-button svg {
          width: 20px;
          height: 20px;
        }

        .footnote {
          font-size: 0.6em;
          vertical-align: super;
          color: hsl(var(--muted-foreground));
          text-decoration: none;
          margin-left: 1px;
          transition: color 0.2s ease;
        }

        .footnote:hover {
          color: hsl(var(--primary));
        }

        .footnotes-section {
          text-align: center;
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid hsl(var(--border));
        }

        .footnotes-list {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
        }

        .footnote-item {
          font-size: 11px;
          color: hsl(var(--muted-foreground));
        }

        .footnote-num {
          color: hsl(var(--muted-foreground));
        }

        .footnote-item a {
          color: hsl(var(--muted-foreground));
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footnote-item a:hover {
          color: hsl(var(--primary));
          text-decoration: underline;
        }

        @media (max-width: 900px) {
          .funnel-section {
            grid-template-columns: 1fr;
          }

          .comparison-row {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .comparison-arrow {
            transform: rotate(90deg);
          }
        }

        @media (max-width: 768px) {
          .interactive-section {
            padding: 40px 16px;
          }

          .graph-container {
            padding: 24px;
          }

          .graph-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .current-stats {
            width: 100%;
            justify-content: space-between;
          }

          .stat-box {
            text-align: left;
          }

          .zones-container {
            grid-template-columns: repeat(2, 1fr);
          }

          .graph-svg {
            height: 220px;
          }

          .cta-section {
            padding: 32px 24px;
          }

          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }

          .cta-button {
            width: 100%;
            max-width: 280px;
            justify-content: center;
          }
        }
      `}</style>

      <div className="mc-container">
        {/* Header */}
        <header className="section-header">
          <h2 className="section-title">
            Missed Calls Cost You More Than You Think
          </h2>
          <p className="section-subtitle">
            Research shows leads contacted within 5 minutes are <strong>9x more likely to convert</strong><a href="https://www.leadresponsemanagement.org/lrm_study" target="_blank" rel="noopener noreferrer" className="footnote">[1]</a>.
            Wait longer, and most callers never try again.
          </p>
        </header>

        {/* Main Interactive Graph */}
        <div className="graph-container">
          <div className="graph-header">
            <div>
              <h3 className="graph-title">Lead Conversion Rate vs Response Time</h3>
              <p className="graph-description">Based on Lead Response Management Study<a href="https://www.leadresponsemanagement.org/lrm_study" target="_blank" rel="noopener noreferrer" className="footnote">[1]</a></p>
            </div>
            <div className="current-stats">
              <div className="stat-box">
                <div className="stat-box-label">Response Time</div>
                <div className={`stat-box-value ${getColorClass(rate)}`}>{formatTime(minutes)}</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Conversion Rate</div>
                <div className={`stat-box-value ${getColorClass(rate)}`}>{rate}%</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Leads Lost</div>
                <div className={`stat-box-value ${leadsLost > 50 ? 'danger' : leadsLost > 20 ? 'warning' : 'good'}`}>{leadsLost}%</div>
              </div>
            </div>
          </div>

          {/* SVG Graph */}
          <div className="graph-wrapper">
            <svg
              ref={svgRef}
              className="graph-svg"
              viewBox="0 0 1000 320"
              preserveAspectRatio="xMidYMid meet"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {/* Grid lines */}
              <g className="grid">
                <line className="grid-line" x1="50" y1="50" x2="950" y2="50"/>
                <line className="grid-line" x1="50" y1="100" x2="950" y2="100"/>
                <line className="grid-line" x1="50" y1="150" x2="950" y2="150"/>
                <line className="grid-line" x1="50" y1="200" x2="950" y2="200"/>
                <line className="grid-line" x1="50" y1="250" x2="950" y2="250"/>
              </g>

              {/* Y-axis labels (percentages) */}
              <g className="y-labels">
                <text className="axis-label" x="45" y="55" textAnchor="end">78%</text>
                <text className="axis-label" x="45" y="105" textAnchor="end">59%</text>
                <text className="axis-label" x="45" y="155" textAnchor="end">39%</text>
                <text className="axis-label" x="45" y="205" textAnchor="end">20%</text>
                <text className="axis-label" x="45" y="255" textAnchor="end">0%</text>
              </g>

              {/* X-axis labels (time) */}
              <g className="x-labels">
                <text className="axis-label" x="50" y="275" textAnchor="middle">0</text>
                <text className="axis-label" x="162" y="275" textAnchor="middle">15m</text>
                <text className="axis-label" x="275" y="275" textAnchor="middle">30m</text>
                <text className="axis-label" x="500" y="275" textAnchor="middle">1hr</text>
                <text className="axis-label" x="725" y="275" textAnchor="middle">1.5hr</text>
                <text className="axis-label" x="950" y="275" textAnchor="middle">2hr</text>
              </g>

              {/* Axis titles */}
              <text
                x="500"
                y="305"
                textAnchor="middle"
                className="axis-label"
                fontSize="12"
              >
                Response Time
              </text>
              <text
                x="-150"
                y="15"
                textAnchor="middle"
                className="axis-label"
                fontSize="12"
                transform="rotate(-90)"
              >
                Conversion Rate
              </text>

              {/* Gradient definitions */}
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 0.2 }}/>
                  <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0 }}/>
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: '#22c55e' }}/>
                  <stop offset="20%" style={{ stopColor: '#eab308' }}/>
                  <stop offset="50%" style={{ stopColor: '#f97316' }}/>
                  <stop offset="100%" style={{ stopColor: '#ef4444' }}/>
                </linearGradient>
                <filter id="lineShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.3"/>
                </filter>
              </defs>

              {/* Area fill */}
              <path fill="url(#areaGradient)" d={areaPath}/>

              {/* Line */}
              <path className="graph-line" stroke="url(#lineGradient)" d={linePath} filter="url(#lineShadow)"/>

              {/* Data points */}
              {dataPoints.map((point, index) => (
                <circle
                  key={index}
                  cx={xScale(point.time)}
                  cy={yScale(point.rate)}
                  r="6"
                  fill={getColorForRate(point.rate)}
                  className="data-point"
                />
              ))}

              {/* Draggable position indicator */}
              <g className="position-indicator">
                {/* Wider invisible hit area for easier dragging */}
                <rect
                  x={xScale(minutes) - 15}
                  y="45"
                  width="30"
                  height="210"
                  fill="transparent"
                  style={{ cursor: 'ew-resize' }}
                />

                {/* Vertical line */}
                <line
                  x1={xScale(minutes)}
                  y1="50"
                  x2={xScale(minutes)}
                  y2="250"
                  className="position-line"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  opacity="0.7"
                />

                {/* Left/right arrow hints on the line */}
                <g transform={`translate(${xScale(minutes)}, 150)`} opacity="0.8">
                  <path d="M-8 -5 L-12 0 L-8 5" className="position-line" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 -5 L12 0 L8 5" className="position-line" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                {/* Data point circle */}
                <circle
                  cx={xScale(minutes)}
                  cy={yScale(rate)}
                  r="10"
                  fill={getColorForRate(rate)}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.6))', cursor: 'ew-resize' }}
                />
              </g>
            </svg>
            <p className="graph-hint">Drag to explore response times</p>
          </div>


          {/* Zone indicators */}
          <div className="zones-container">
            <div className={`zone-card green ${activeZone === 'green' ? 'active' : ''}`}>
              <div className="zone-icon">🟢</div>
              <div className="zone-time">0-5 min</div>
              <div className="zone-label">Golden Window</div>
            </div>
            <div className={`zone-card yellow ${activeZone === 'yellow' ? 'active' : ''}`}>
              <div className="zone-icon">🟡</div>
              <div className="zone-time">5-15 min</div>
              <div className="zone-label">Risky Zone</div>
            </div>
            <div className={`zone-card orange ${activeZone === 'orange' ? 'active' : ''}`}>
              <div className="zone-icon">🟠</div>
              <div className="zone-time">15-30 min</div>
              <div className="zone-label">Danger Zone</div>
            </div>
            <div className={`zone-card red ${activeZone === 'red' ? 'active' : ''}`}>
              <div className="zone-icon">🔴</div>
              <div className="zone-time">30+ min</div>
              <div className="zone-label">Lost Cause</div>
            </div>
          </div>
        </div>

        {/* Lead Funnel Comparison */}
        <div className="funnel-section">
          {/* Without Our Solution */}
          <div className="funnel-card">
            <h3 className="funnel-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              Without AI Receptionist
            </h3>
            <div className="funnel-visual">
              <div className="funnel-bar incoming" style={{ width: '100%' }}>
                <span className="funnel-bar-label">Incoming Leads</span>
                <span className="funnel-bar-value">100</span>
              </div>
              <div className="funnel-bar answered" style={{ width: '70%' }}>
                <span className="funnel-bar-label">Answered</span>
                <span className="funnel-bar-value">70</span>
              </div>
              <div className="funnel-bar missed" style={{ width: '30%' }}>
                <span className="funnel-bar-label">Missed Calls</span>
                <span className="funnel-bar-value">30</span>
              </div>
              <div className="funnel-bar converted" style={{ width: `${converted}%` }}>
                <span className="funnel-bar-label">Converted</span>
                <span className="funnel-bar-value">{converted}</span>
              </div>
            </div>
          </div>

          {/* With Our Solution */}
          <div className="funnel-card">
            <h3 className="funnel-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              With AI Receptionist
            </h3>
            <div className="funnel-visual">
              <div className="funnel-bar incoming" style={{ width: '100%' }}>
                <span className="funnel-bar-label">Incoming Leads</span>
                <span className="funnel-bar-value">100</span>
              </div>
              <div className="funnel-bar answered" style={{ width: '100%' }}>
                <span className="funnel-bar-label">Answered (24/7)</span>
                <span className="funnel-bar-value">100</span>
              </div>
              <div className="funnel-bar missed" style={{ width: '0%', minWidth: '80px', opacity: 0.3 }}>
                <span className="funnel-bar-label">Missed</span>
                <span className="funnel-bar-value">0</span>
              </div>
              <div className="funnel-bar converted" style={{ width: '78%' }}>
                <span className="funnel-bar-label">Converted</span>
                <span className="funnel-bar-value">78</span>
              </div>
            </div>
          </div>
        </div>

        {/* Before/After Comparison */}
        <div className="comparison-row">
          <div className="comparison-card bad">
            <div className="comparison-label">Wait 30+ Minutes</div>
            <div className="comparison-value">-80%</div>
            <div className="comparison-text">Drop in conversion likelihood</div>
          </div>
          <div className="comparison-arrow">→</div>
          <div className="comparison-card good">
            <div className="comparison-label">Respond in 5 Minutes</div>
            <div className="comparison-value">9x</div>
            <div className="comparison-text">More likely to convert</div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
          <h2 className="cta-title">Stop Losing Leads Automatically</h2>
          <p className="cta-text">
            AnswerAfter responds instantly and follows up for you — <span className="emphasis">24/7</span>.
            Stay in the golden window without lifting a finger.
          </p>
          <div className="cta-buttons">
            <a href="/auth?signup=true" className="cta-button primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start Free Trial
            </a>
            <a href="#pricing" className="cta-button secondary">
              View Pricing
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}

export default MissedCallsSection;
