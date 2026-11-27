import { useEffect, useRef } from 'react';
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler,
} from 'chart.js';
import { fmtDateShort, fmtDate, fmtKg } from '../format.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const METRICS = [
  { key: 'maxKg', title: 'Carga máxima', unit: 'kg' },
  { key: 'volume', title: 'Volume (kg × reps)', unit: 'kg' },
  { key: 'e1rm', title: '1RM estimado (Epley)', unit: 'kg' },
];

/** Gráficos de evolução de um exercício. Carregado sob demanda (Chart.js só baixa quando usado). */
export default function ProgressCharts({ history }) {
  const best = key => Math.max(...history.map(h => h[key]));
  return (
    <>
      {METRICS.map(m => (
        <section className="card chart-card" key={m.key}>
          <div className="chart-head">
            <h2>{m.title}</h2>
            <span className="muted small">recorde {fmtKg(Math.round(best(m.key) * 10) / 10)} {m.unit}</span>
          </div>
          <LineChart history={history} metric={m} />
        </section>
      ))}
    </>
  );
}

function LineChart({ history, metric }) {
  const ref = useRef();
  useEffect(() => {
    const accent = css('--accent'), muted = css('--muted'), border = css('--border');
    const chart = new Chart(ref.current, {
      type: 'line',
      data: {
        labels: history.map(h => fmtDateShort(h.date)),
        datasets: [{
          data: history.map(h => Math.round(h[metric.key] * 10) / 10),
          borderColor: accent, backgroundColor: accent + '22', pointBackgroundColor: accent,
          fill: true, tension: 0.25, pointRadius: history.length > 30 ? 0 : 3, pointHitRadius: 12, borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: items => fmtDate(history[items[0].dataIndex].date),
              label: item => `${fmtKg(item.parsed.y)} ${metric.unit}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false }, border: { color: border } },
          y: { ticks: { color: muted, maxTicksLimit: 5, callback: v => fmtKg(v) }, grid: { color: border }, border: { display: false } },
        },
      },
    });
    return () => chart.destroy();
  }, [history, metric]);
  return <div className="chart-box"><canvas ref={ref} /></div>;
}
