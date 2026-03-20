import React, { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { createHpoJob, getApiErrorMessage, listDatasets, waitForJob } from '../api';
import { Reveal } from './Reveal';
import type { DatasetFile, HpoResult, JobStatus } from '../types';

function formatJobMessage(job: JobStatus<HpoResult> | null): string | null {
  if (!job) {
    return null;
  }

  if (job.progress == null) {
    return job.message;
  }

  return `${job.message} (${job.progress.toFixed(0)}%)`;
}

export const HPOTab: React.FC = () => {
  const [nTrials, setNTrials] = useState(15);
  const [nJobs, setNJobs] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HpoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [datasetName, setDatasetName] = useState<string>('mnist');
  const [datasets, setDatasets] = useState<DatasetFile[]>([]);
  const [job, setJob] = useState<JobStatus<HpoResult> | null>(null);

  const effectiveWorkers = Math.max(1, Math.min(nJobs, nTrials));
  const estimatedMinutes = Math.max(1, Math.ceil((nTrials * 30) / effectiveWorkers / 60));

  useEffect(() => {
    void listDatasets()
      .then(response => setDatasets(response.datasets.filter(dataset => dataset.extension !== '.zip')))
      .catch(() => undefined);
  }, []);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsedMs(null);
    setJob(null);
    const startTime = Date.now();

    try {
      const queuedJob = await createHpoJob(
        nTrials,
        nJobs,
        'ai-training-platform',
        datasetName === 'mnist' ? undefined : datasetName,
      );
      setJob(queuedJob);

      const finalJob = await waitForJob<HpoResult>(queuedJob.job_id, {
        onUpdate: nextJob => setJob(nextJob),
      });

      if (finalJob.status === 'failed') {
        throw new Error(finalJob.error || 'HPO job failed');
      }

      if (!finalJob.result) {
        throw new Error('HPO job finished without a result payload');
      }

      setResult(finalJob.result);
      setElapsedMs(Date.now() - startTime);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const scatterData = result?.all_trials.map(trial => ({
    lr: Math.log10(trial.learning_rate),
    accuracy: trial.val_accuracy,
    trial: trial.trial,
    batch: trial.batch_size,
  })) ?? [];

  return (
    <div className="tab-content">
      <div className="page-header">
        <div>
          <div className="page-kicker">Search orchestration</div>
          <h1 className="page-title">Search Studio</h1>
          <p className="page-subtitle">
            Run an Optuna study to search for stronger hyperparameters and compare the winning trial.
          </p>
        </div>
      </div>

      <div className="hpo-grid">
        <Reveal delay={0.04}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Search configuration</span>
              <span className="badge badge-blue">Optuna TPE</span>
            </div>

            <div className="card-body">
              <div className="alert alert-info">
                This study explores learning rate, batch size, optimizer, hidden size, layer count, dropout, and epochs.
                Each trial is logged to MLflow automatically.
              </div>

              <div className="form-group">
                <label className="form-label">Dataset</label>
                <select
                  className="form-input"
                  value={datasetName}
                  onChange={event => setDatasetName(event.target.value)}
                  disabled={loading}
                >
                  <option value="mnist">Built-in MNIST</option>
                  {datasets.map(dataset => (
                    <option key={dataset.filename} value={dataset.filename}>
                      {dataset.filename}
                    </option>
                  ))}
                </select>
                <p className="form-hint">
                  Search can run on the built-in MNIST dataset or on uploaded CSV, TSV, and JSON datasets.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Number of trials</label>
                <input
                  type="number"
                  className="form-input"
                  min={3}
                  max={50}
                  value={nTrials}
                  onChange={event => setNTrials(Number(event.target.value))}
                  disabled={loading}
                />
                <p className="form-hint">{nTrials} total trials will be attempted in this study.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Parallel workers</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={4}
                  value={nJobs}
                  onChange={event => setNJobs(Number(event.target.value))}
                  disabled={loading}
                />
                <p className="form-hint">
                  Estimated wall time: about {estimatedMinutes} minute{estimatedMinutes === 1 ? '' : 's'} with{' '}
                  {effectiveWorkers} worker{effectiveWorkers === 1 ? '' : 's'}.
                </p>
              </div>

              <button className="btn btn-primary btn-full" onClick={handleRun} disabled={loading} id="run-hpo-btn">
                {loading ? (
                  <>
                    <div className="spinner spinner-accent" />
                    {formatJobMessage(job) ?? 'Running search'}
                  </>
                ) : (
                  'Run HPO search'
                )}
              </button>

              <AnimatePresence initial={false}>
                {loading && (
                  <m.div
                    key="hpo-running"
                    className="alert alert-warning"
                    style={{ marginTop: 14 }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {formatJobMessage(job) ?? `Up to ${effectiveWorkers} training trials will run at once while the study is active.`}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <div className="status-stack">
              <AnimatePresence initial={false}>
                {error && (
                  <m.div
                    key="hpo-error"
                    className="alert alert-error"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    Search failed: {error}
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {result && (
              <>
                <m.div
                  className="alert alert-success"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                >
                  Search finished in {elapsedMs ? (elapsedMs / 1000).toFixed(1) : '-'} seconds with{' '}
                  {result.n_jobs ?? effectiveWorkers} worker{(result.n_jobs ?? effectiveWorkers) === 1 ? '' : 's'}.
                  <span style={{ marginLeft: 8 }}>
                    Best validation accuracy: <strong>{result.best_val_accuracy.toFixed(2)}%</strong> on trial #
                    {result.best_trial}. Dataset: {result.dataset_name ?? 'mnist'}.
                  </span>
                </m.div>

                <Reveal className="section-gap" delay={0.08}>
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Winning configuration</span>
                      <div className="chip-row">
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
                            <div className="metric-label">Workers used</div>
                            <div className="metric-value" style={{ fontSize: 18 }}>{result.n_jobs}</div>
                          </div>
                        )}
                        {Object.entries(result.best_params).map(([key, value]) => (
                          <div className="metric-item" key={key}>
                            <div className="metric-label">{key.replace(/_/g, ' ')}</div>
                            <div className="metric-value" style={{ fontSize: 18 }}>
                              {typeof value === 'number' && value < 0.01 ? Number(value).toExponential(2) : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Reveal>

                {scatterData.length > 2 && (
                  <Reveal className="section-gap" delay={0.12}>
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Learning rate vs validation accuracy</span>
                        <span className="badge badge-blue">Bubble size tracks batch size</span>
                      </div>

                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis
                              dataKey="lr"
                              name="log10(learning rate)"
                              type="number"
                              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                              label={{
                                value: 'log10(learning rate)',
                                position: 'insideBottom',
                                offset: -4,
                                fill: 'var(--chart-axis)',
                                fontSize: 12,
                              }}
                            />
                            <YAxis
                              dataKey="accuracy"
                              name="Validation accuracy"
                              type="number"
                              domain={[0, 100]}
                              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                              label={{
                                value: 'Validation accuracy',
                                angle: -90,
                                position: 'insideLeft',
                                fill: 'var(--chart-axis)',
                                fontSize: 12,
                              }}
                            />
                            <ZAxis dataKey="batch" range={[40, 200]} />
                            <Tooltip
                              contentStyle={{
                                background: 'var(--chart-tooltip-bg)',
                                border: '1px solid var(--chart-tooltip-border)',
                                borderRadius: 16,
                              }}
                              cursor={{ strokeDasharray: '3 3' }}
                            />
                            <Scatter data={scatterData} fill="var(--chart-cyan)" fillOpacity={0.8} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Reveal>
                )}
              </>
            )}

            {!result && !loading && (
              <div className="empty-state" style={{ paddingTop: 40 }}>
                <div className="empty-state-icon">HPO</div>
                <div className="empty-state-kicker">Search output</div>
                <div className="empty-state-title">Ready to search for a better run</div>
                <div className="empty-state-text">
                  Configure the study on the left and launch it to compare candidate trials here.
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
};
