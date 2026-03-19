// src/components/TrainTab.tsx
import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { getApiErrorMessage, trainModel } from '../api';
import type { TrainRequest, TrainResponse } from '../types';

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

  const set = <K extends keyof TrainRequest>(k: K, v: TrainRequest[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleTrain = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await trainModel(form);
      setResult(res);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Build chart data from history
  const chartData = result
    ? Array.from({ length: result.history.train_loss.length }, (_, i) => ({
        epoch: i + 1,
        'Train Loss': Number(result.history.train_loss[i].toFixed(4)),
        'Val Loss': Number(result.history.val_loss[i].toFixed(4)),
        'Train Acc': Number(result.history.train_accuracy[i].toFixed(2)),
        'Val Acc': Number(result.history.val_accuracy[i].toFixed(2)),
      }))
    : [];

  return (
    <div className="tab-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Train a Model</h1>
          <p className="page-subtitle">Launch a single training run — logged to MLflow automatically</p>
        </div>
      </div>

      <div className="train-grid">
        {/* Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚙️ Training Config</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Learning Rate</label>
              <input type="number" className="form-input" step="0.0001"
                value={form.learning_rate}
                onChange={e => set('learning_rate', parseFloat(e.target.value))}
                disabled={loading} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch Size</label>
              <select className="form-input"
                value={form.batch_size}
                onChange={e => set('batch_size', parseInt(e.target.value))}
                disabled={loading}>
                {[16, 32, 64, 128, 256].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Epochs</label>
              <input type="number" className="form-input" min={1} max={100}
                value={form.epochs}
                onChange={e => set('epochs', parseInt(e.target.value))}
                disabled={loading} />
            </div>
            <div className="form-group">
              <label className="form-label">Optimizer</label>
              <select className="form-input"
                value={form.optimizer}
                onChange={e => set('optimizer', e.target.value as 'adam' | 'sgd')}
                disabled={loading}>
                <option value="adam">Adam</option>
                <option value="sgd">SGD (with momentum)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Experiment Name</label>
              <input type="text" className="form-input"
                value={form.experiment_name}
                onChange={e => set('experiment_name', e.target.value)}
                disabled={loading} />
              <p className="form-hint">Groups runs in MLflow UI</p>
            </div>

            <button className="btn btn-primary btn-full"
              onClick={handleTrain} disabled={loading} id="start-train-btn">
              {loading ? <><div className="spinner" /> Training…</> : '▶ Start Training'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div>
          {error && <div className="alert alert-error">❌ {error}</div>}

          {result && (
            <>
              <div className="alert alert-success">
                ✅ Training complete — Best val accuracy: <strong>{result.best_val_accuracy.toFixed(2)}%</strong>
                <span style={{ marginLeft: 12, opacity: 0.7 }}>Saved: {result.checkpoint_path}</span>
              </div>

              {/* Loss curves */}
              <div className="card section-gap">
                <div className="card-header">
                  <span className="card-title">📉 Loss Curves</span>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                      <XAxis dataKey="epoch" tick={{ fill: '#8b9ab8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#8b9ab8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#141c2e', border: '1px solid #2a3d62', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ color: '#8b9ab8' }} />
                      <Line type="monotone" dataKey="Train Loss" stroke="#4f8ef7" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Val Loss" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Accuracy curves */}
              <div className="card section-gap">
                <div className="card-header">
                  <span className="card-title">📈 Accuracy Curves</span>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                      <XAxis dataKey="epoch" tick={{ fill: '#8b9ab8', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#8b9ab8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#141c2e', border: '1px solid #2a3d62', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ color: '#8b9ab8' }} />
                      <Line type="monotone" dataKey="Train Acc" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Val Acc" stroke="#a78bfa" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {!result && !loading && (
            <div className="empty-state" style={{ paddingTop: 40 }}>
              <div className="empty-state-icon">⚡</div>
              <div className="empty-state-title">Ready to train</div>
              <div className="empty-state-text">Configure and launch a run to see loss and accuracy curves here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
