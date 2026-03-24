// src/components/ExperimentsTab.tsx
import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  AlertTriangle, Trophy, ClipboardList, 
  Microscope, Target, TrendingUp 
} from 'lucide-react';
import { getExperiments, getMlflowRuns } from '../api';
import type { ExperimentsResponse, MlflowRun } from '../types';
import { AnimatedNumber } from './AnimatedNumber';
import { MetricCard } from './MetricCard';




function AccuracyCell({ value }: { value: number }) {
  return (
    <div className="accuracy-cell">
      <div className="accuracy-bar-wrap">
        <div className="accuracy-bar-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="accuracy-value">{value.toFixed(2)}%</span>
    </div>
  );
}

export const ExperimentsTab: React.FC = () => {
  const [data, setData] = useState<ExperimentsResponse | null>(null);
  const [mlflowRuns, setMlflowRuns] = useState<MlflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getExperiments(), getMlflowRuns()])
      .then(([exp, mf]) => {
        setData(exp);
        setMlflowRuns(mf.runs);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (error) return <div className="alert alert-error"><AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {error} — Is the backend running?</div>;

  const manual = data?.manual_experiments ?? [];
  const hpo = data?.hpo_results;

  const totalRuns = manual.length + (hpo?.all_trials.length || 0);
  const bestManual = manual.length > 0 ? Math.max(...manual.map(m => m.best_accuracy)) : 0;
  const bestHpo = hpo ? hpo.best_val_accuracy : 0;
  const bestAccuracy = Math.max(bestManual, bestHpo);

  // Build chart data from MLflow runs
  const chartRuns = mlflowRuns.slice(0, 6);

  return (
    <div className="tab-content tab-content-active">
      <div className="page-header">
        <div>
          <h1 className="page-title">Experiment Dashboard</h1>
          <p className="page-subtitle">All training runs tracked with MLflow</p>
        </div>
      </div>

      {/* Stats - Giant Numbers Treatment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '60px' }}>
        <MetricCard title="Total Runs" value={<AnimatedNumber value={totalRuns} />} valueColor="#FFFFFF" />
        <MetricCard title="Best Accuracy" value={<>{bestAccuracy > 0 ? bestAccuracy.toFixed(1) : '—'}%</>} valueColor="#1D9E75" />
        <MetricCard title="MLflow Runs" value={<AnimatedNumber value={mlflowRuns.length} />} valueColor="#A061D1" />
        <MetricCard title="HPO Trials" value={<AnimatedNumber value={hpo?.all_trials.length ?? 0} />} valueColor="#F59E0B" />
      </div>

      {/* Manual experiments table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={16} /> Manual Experiments</span>
          <span className="badge badge-blue">{manual.length} runs</span>
        </div>
        <div className="table-wrapper">
          {manual.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Microscope size={48} opacity={0.5} /></div>
              <div className="empty-state-title">No manual experiments yet</div>
              <div className="empty-state-text">Run scripts/run_experiments.py or use the Train tab</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Learning Rate</th>
                  <th>Batch Size</th>
                  <th>Epochs</th>
                  <th>Val Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {[...manual]
                  .sort((a, b) => b.best_accuracy - a.best_accuracy)
                  .map((exp, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-blue">{i + 1}</span></td>
                    <td><span className="mono">{exp.learning_rate}</span></td>
                    <td><span className="mono">{exp.batch_size}</span></td>
                    <td><span className="mono">{exp.epochs}</span></td>
                    <td><AccuracyCell value={exp.best_accuracy} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* HPO trials table */}
      {hpo && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={16} /> HPO Trials (Optuna)</span>
            <span className="badge badge-green">Best: {hpo.best_val_accuracy.toFixed(2)}%</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Trial</th>
                  <th>LR</th>
                  <th>Batch</th>
                  <th>Opt</th>
                  <th>Hidden</th>
                  <th>Layers</th>
                  <th>Epochs</th>
                  <th>Val Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {hpo.all_trials.slice(0, 20).map((t, i) => (
                  <tr key={i}>
                    <td>
                      {t.trial === hpo.best_trial
                        ? <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trophy size={12} /> #{t.trial}</span>
                        : <span className="badge badge-blue">#{t.trial}</span>}
                    </td>
                    <td><span className="mono">{Number(t.learning_rate).toExponential(2)}</span></td>
                    <td><span className="mono">{t.batch_size}</span></td>
                    <td><span className="badge badge-purple">{t.optimizer}</span></td>
                    <td><span className="mono">{t.hidden_size}</span></td>
                    <td><span className="mono">{t.n_layers}</span></td>
                    <td><span className="mono">{t.epochs}</span></td>
                    <td><AccuracyCell value={t.val_accuracy} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MLflow runs chart */}
      {chartRuns.length > 0 && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} /> Best Val Accuracy — MLflow Runs</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartRuns.map((r, i) => ({
                name: r.run_name || `Run ${i + 1}`,
                accuracy: r.metrics['best_val_accuracy'] ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ 
                    background: 'var(--chart-tooltip-bg)', 
                    border: '1px solid var(--chart-tooltip-border)', 
                    borderRadius: 8 
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="accuracy" stroke="var(--accent-primary)" strokeWidth={2} dot={{ fill: 'var(--accent-primary)' }} name="Val Accuracy %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
