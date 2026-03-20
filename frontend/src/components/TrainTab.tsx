import React, { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { createTrainJob, getApiErrorMessage, listDatasets, waitForJob } from '../api';
import { Reveal } from './Reveal';
import type { DatasetFile, JobStatus, TrainRequest, TrainResponse } from '../types';

function formatJobMessage(job: JobStatus<TrainResponse> | null): string | null {
  if (!job) {
    return null;
  }

  if (job.progress == null) {
    return job.message;
  }

  return `${job.message} (${job.progress.toFixed(0)}%)`;
}

export const TrainTab: React.FC = () => {
  const [form, setForm] = useState<TrainRequest>({
    learning_rate: 0.001,
    batch_size: 64,
    epochs: 10,
    optimizer: 'adam',
    experiment_name: 'ai-training-platform',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetFile[]>([]);
  const [job, setJob] = useState<JobStatus<TrainResponse> | null>(null);

  useEffect(() => {
    void listDatasets()
      .then(response => setDatasets(response.datasets.filter(dataset => dataset.extension !== '.zip')))
      .catch(() => undefined);
  }, []);

  const setField = <K extends keyof TrainRequest>(key: K, value: TrainRequest[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const handleTrain = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setJob(null);

    try {
      const queuedJob = await createTrainJob(form);
      setJob(queuedJob);

      const finalJob = await waitForJob<TrainResponse>(queuedJob.job_id, {
        onUpdate: nextJob => setJob(nextJob),
      });

      if (finalJob.status === 'failed') {
        throw new Error(finalJob.error || 'Training job failed');
      }

      if (!finalJob.result) {
        throw new Error('Training job finished without a result payload');
      }

      setResult(finalJob.result);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? Array.from({ length: result.history.train_loss.length }, (_, index) => ({
        epoch: index + 1,
        trainLoss: Number(result.history.train_loss[index].toFixed(4)),
        valLoss: Number(result.history.val_loss[index].toFixed(4)),
        trainAcc: Number(result.history.train_accuracy[index].toFixed(2)),
        valAcc: Number(result.history.val_accuracy[index].toFixed(2)),
      }))
    : [];

  return (
    <div className="tab-content">
      <div className="page-header">
        <div>
          <div className="page-kicker">Training orchestration</div>
          <h1 className="page-title">Experiment Builder</h1>
          <p className="page-subtitle">
            Configure one run, launch it through the backend, and review the training curves in place.
          </p>
        </div>
      </div>

      <div className="train-grid">
        <Reveal delay={0.04}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Training configuration</span>
              <span className="badge badge-blue">{form.dataset_name ? 'Uploaded dataset' : 'MNIST baseline'}</span>
            </div>

            <div className="card-body">
              <div className="alert alert-info">
                Start with the defaults if you are exploring. Lower learning rates are safer; higher ones can converge
                faster but may destabilize training.
              </div>

              <div className="form-group">
                <label className="form-label">Dataset</label>
                <select
                  className="form-input"
                  value={form.dataset_name ?? 'mnist'}
                  onChange={event => setField('dataset_name', event.target.value === 'mnist' ? undefined : event.target.value)}
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
                  Uploaded CSV, TSV, and JSON datasets are trainable. ZIP datasets stay in the asset library but are not
                  trainable yet.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Learning rate</label>
                <input
                  type="number"
                  className="form-input"
                  step="0.0001"
                  value={form.learning_rate}
                  onChange={event => setField('learning_rate', parseFloat(event.target.value))}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Batch size</label>
                <select
                  className="form-input"
                  value={form.batch_size}
                  onChange={event => setField('batch_size', parseInt(event.target.value, 10))}
                  disabled={loading}
                >
                  {[16, 32, 64, 128, 256].map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Epochs</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={100}
                  value={form.epochs}
                  onChange={event => setField('epochs', parseInt(event.target.value, 10))}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Optimizer</label>
                <select
                  className="form-input"
                  value={form.optimizer}
                  onChange={event => setField('optimizer', event.target.value as 'adam' | 'sgd')}
                  disabled={loading}
                >
                  <option value="adam">Adam</option>
                  <option value="sgd">SGD with momentum</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Experiment name</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.experiment_name}
                  onChange={event => setField('experiment_name', event.target.value)}
                  disabled={loading}
                />
                <p className="form-hint">This groups the run inside MLflow and the dashboard views.</p>
              </div>

              <button className="btn btn-primary btn-full" onClick={handleTrain} disabled={loading} id="start-train-btn">
                {loading ? (
                  <>
                    <div className="spinner spinner-accent" />
                    {formatJobMessage(job) ?? 'Launching training run'}
                  </>
                ) : (
                  'Start training run'
                )}
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <div className="status-stack">
              <AnimatePresence initial={false}>
                {error && (
                  <m.div
                    key="train-error"
                    className="alert alert-error"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    Training request failed: {error}
                  </m.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {loading && job && (
                  <m.div
                    key="train-job"
                    className="alert alert-info"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {formatJobMessage(job)}
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
                  Training finished with a best validation accuracy of <strong>{result.best_val_accuracy.toFixed(2)}%</strong>.
                  <span style={{ marginLeft: 8 }}>
                    Dataset: {result.dataset_name ?? 'mnist'} | Checkpoint saved to {result.checkpoint_path}
                  </span>
                </m.div>

                <Reveal className="section-gap" delay={0.08}>
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Loss curves</span>
                      <span className="badge badge-blue">{chartData.length} epochs</span>
                    </div>

                    <div className="card-body">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis dataKey="epoch" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                          <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--chart-tooltip-bg)',
                              border: '1px solid var(--chart-tooltip-border)',
                              borderRadius: 16,
                            }}
                          />
                          <Legend wrapperStyle={{ color: 'var(--chart-axis)' }} />
                          <Line type="monotone" dataKey="trainLoss" stroke="var(--chart-violet)" strokeWidth={3} dot={false} name="Train loss" />
                          <Line type="monotone" dataKey="valLoss" stroke="var(--chart-orange)" strokeWidth={3} dot={false} strokeDasharray="6 6" name="Validation loss" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Reveal>

                <Reveal className="section-gap" delay={0.12}>
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Accuracy curves</span>
                      <span className="badge badge-green">{result.best_val_accuracy.toFixed(2)}% peak</span>
                    </div>

                    <div className="card-body">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis dataKey="epoch" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--chart-tooltip-bg)',
                              border: '1px solid var(--chart-tooltip-border)',
                              borderRadius: 16,
                            }}
                          />
                          <Legend wrapperStyle={{ color: 'var(--chart-axis)' }} />
                          <Line type="monotone" dataKey="trainAcc" stroke="var(--chart-cyan)" strokeWidth={3} dot={false} name="Train accuracy" />
                          <Line type="monotone" dataKey="valAcc" stroke="var(--chart-orange)" strokeWidth={3} dot={false} strokeDasharray="6 6" name="Validation accuracy" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Reveal>
              </>
            )}

            {!result && !loading && (
              <div className="empty-state" style={{ paddingTop: 40 }}>
                <div className="empty-state-icon">RUN</div>
                <div className="empty-state-kicker">Training output</div>
                <div className="empty-state-title">Ready to launch an experiment</div>
                <div className="empty-state-text">
                  Set the training knobs on the left and run one experiment to populate this workspace.
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
};
