// src/components/HPOTab.tsx
import React, { useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { MetricCard } from './MetricCard';
import {
  Settings, Rocket, Hourglass, XCircle,
  Trophy, BarChart2, Search
} from 'lucide-react';
import { getApiErrorMessage, runHpo } from '../api';
import type { HpoResult } from '../types';

export const HPOTab: React.FC = () => {
  const [nTrials, setNTrials] = useState(15);
  const [nJobs, setNJobs] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HpoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const effectiveWorkers = Math.max(1, Math.min(nJobs, nTrials));
  const estimatedMinutes = Math.max(1, Math.ceil((nTrials * 30) / effectiveWorkers / 60));

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsedMs(null);
    const start = Date.now();
    try {
      const res = await runHpo(nTrials, nJobs);
      setResult(res);
      setElapsedMs(Date.now() - start);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const scatterData = result?.all_trials.map(t => ({
    lr: Math.log10(t.learning_rate),
    accuracy: t.val_accuracy,
    trial: t.trial,
    z: t.batch_size,
  })) ?? [];

  return (
    <div className="tab-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hyperparameter Optimisation</h1>
          <p className="page-subtitle">Bayesian search via Optuna TPE — all trials logged to MLflow</p>
        </div>
      </div>

      <div className="hpo-grid">
        {/* Control Panel */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={16} /> Search Configuration</span>
          </div>
          <div className="card-body">
            <div className="alert alert-info">
              Search space: LR ∈ [1e-4, 0.1], batch ∈ {'{'}32,64,128{'}'}, optimizer ∈ {'{'}adam,sgd{'}'}, hidden ∈ {'{'}128,256,512{'}'}, layers 1–3, dropout 0.1–0.5, epochs 5–15
            </div>

            <div className="form-group">
              <label className="form-label">Number of Trials</label>
              <input
                type="number"
                className="form-input"
                min={3} max={50}
                value={nTrials}
                onChange={e => setNTrials(Number(e.target.value))}
                disabled={loading}
              />
              <p className="form-hint">
                {nTrials} total trials in the search study
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Parallel Workers</label>
              <input
                type="number"
                className="form-input"
                min={1} max={4}
                value={nJobs}
                onChange={e => setNJobs(Number(e.target.value))}
                disabled={loading}
              />
              <p className="form-hint">
                Estimated wall time: ~{estimatedMinutes} minute{estimatedMinutes === 1 ? '' : 's'} with {effectiveWorkers} worker{effectiveWorkers === 1 ? '' : 's'}
              </p>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleRun}
              disabled={loading}
              id="run-hpo-btn"
            >
              {loading ? (
                <><div className="spinner" /> Running {nTrials} trials…</>
              ) : <><Rocket size={18} /> Run HPO Search</>}
            </button>

            {loading && (
              <div className="alert alert-warning" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Hourglass size={16} /> This runs up to {effectiveWorkers} training trial{effectiveWorkers === 1 ? '' : 's'} at the same time. Each trial still logs to MLflow automatically.
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div>
          {error && <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={16} /> {error}</div>}

          {result && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <MetricCard title="Best Accuracy" value={`${result.best_val_accuracy.toFixed(1)}%`} valueColor="#1D9E75" />
                <MetricCard title="Best Trial" value={`#${result.best_trial}`} valueColor="#A061D1" />
                <MetricCard title="Wall Time" value={`${elapsedMs ? (elapsedMs / 1000).toFixed(0) : '—'}s`} valueColor="#F59E0B" />
                <MetricCard title="Workers" value={result.n_jobs ?? effectiveWorkers} valueColor="#FFFFFF" />
              </div>

              {/* Best params */}
              <div className="card section-gap">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={16} /> Best Trial Parameters</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {result.execution_mode && (
                      <span className={`badge ${result.execution_mode === 'parallel' ? 'badge-blue' : 'badge-amber'}`}>
                        {result.execution_mode}
                      </span>
                    )}
                    <span className="badge badge-green">{result.best_val_accuracy.toFixed(2)}%</span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="model-stats-grid">
                    {result.n_jobs && (
                      <div className="metric-item">
                        <div className="metric-label">Workers Used</div>
                        <div className="metric-value" style={{ fontSize: 16 }}>{result.n_jobs}</div>
                      </div>
                    )}
                    {Object.entries(result.best_params).map(([k, v]) => (
                      <div className="metric-item" key={k}>
                        <div className="metric-label">{k.replace(/_/g, ' ')}</div>
                        <div className="metric-value" style={{ fontSize: 16 }}>
                          {typeof v === 'number' && v < 0.01 ? Number(v).toExponential(2) : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scatter: log(LR) vs accuracy */}
              {scatterData.length > 2 && (
                <div className="card section-gap">
                  <div className="card-header">
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={16} /> log₁₀(LR) vs Val Accuracy</span>
                    <span className="badge badge-blue">Bubble size = batch size</span>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={280}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis dataKey="lr" name="log₁₀(LR)" type="number" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                          label={{ value: 'log₁₀(LR)', position: 'insideBottom', offset: -4, fill: 'var(--chart-axis)', fontSize: 12 }} />
                        <YAxis dataKey="accuracy" name="Val Acc" type="number" domain={[0, 100]}
                          tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                          label={{ value: 'Val Accuracy %', angle: -90, position: 'insideLeft', fill: 'var(--chart-axis)', fontSize: 12 }} />
                        <ZAxis dataKey="z" range={[40, 200]} />
                        <Tooltip
                          contentStyle={{ 
                            background: 'var(--chart-tooltip-bg)', 
                            border: '1px solid var(--chart-tooltip-border)', 
                            borderRadius: 8 
                          }}
                          cursor={{ strokeDasharray: '3 3' }}
                        />
                        <Scatter data={scatterData} fill="var(--accent-primary)" fillOpacity={0.75} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="empty-state" style={{ paddingTop: 40 }}>
              <div className="empty-state-icon"><Search size={48} opacity={0.5} /></div>
              <div className="empty-state-title">No results yet</div>
              <div className="empty-state-text">Configure and launch a search to see results here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
