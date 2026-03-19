// src/components/ModelsTab.tsx
import React, { useEffect, useState } from 'react';
import {
  analyseModel,
  exportOnnx,
  getApiErrorMessage,
  listModels,
  predictModel,
} from '../api';
import type {
  ModelAnalysis,
  ModelFile,
  OnnxComparison,
  PredictionResponse,
} from '../types';

function FileSize({ mb }: { mb: number }) {
  return <span className="mono">{mb.toFixed(2)} MB</span>;
}

function Latency({ ms }: { ms: number }) {
  return (
    <span className="mono" style={{ color: ms < 1 ? '#10b981' : ms < 5 ? '#f59e0b' : '#ef4444' }}>
      {ms.toFixed(3)} ms
    </span>
  );
}

function DigitPreview({ pixels }: { pixels: number[][] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(28, 7px)',
        gap: 1,
        padding: 10,
        background: '#0f1726',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        width: 'fit-content',
      }}
    >
      {pixels.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => (
          <div
            key={`${rowIndex}-${columnIndex}`}
            style={{
              width: 7,
              height: 7,
              borderRadius: 1,
              background: `rgba(79, 142, 247, ${Math.max(0.06, Math.min(value, 1))})`,
            }}
          />
        )),
      )}
    </div>
  );
}

export const ModelsTab: React.FC = () => {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [onnxResult, setOnnxResult] = useState<OnnxComparison | null>(null);
  const [analysis, setAnalysis] = useState<ModelAnalysis | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listModels()
      .then(response => setModels(response.models))
      .catch((error: unknown) => setError(getApiErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  const resetDerivedState = () => {
    setOnnxResult(null);
    setAnalysis(null);
    setPrediction(null);
  };

  const handleExport = async () => {
    if (!selected) return;
    setExporting(true);
    setOnnxResult(null);
    setError(null);
    try {
      const response = await exportOnnx(selected);
      setOnnxResult(response);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const handleAnalyse = async () => {
    if (!selected) return;
    setAnalysing(true);
    setAnalysis(null);
    setError(null);
    try {
      const response = await analyseModel(selected);
      setAnalysis(response);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error));
    } finally {
      setAnalysing(false);
    }
  };

  const handlePredict = async () => {
    if (!selected) return;
    setPredicting(true);
    setPrediction(null);
    setError(null);
    try {
      const response = await predictModel(selected, {
        sample_index: sampleIndex,
        split: 'test',
        top_k: 3,
      });
      setPrediction(response);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error));
    } finally {
      setPredicting(false);
    }
  };

  const selectModel = (filename: string) => {
    setSelected(filename);
    resetDerivedState();
  };

  return (
    <div className="tab-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Model Lab</h1>
          <p className="page-subtitle">Analyse checkpoints, run a sample prediction, and export to ONNX</p>
        </div>
      </div>

      {error && <div className="alert alert-error">Request failed: {error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Saved Checkpoints</span>
          <span className="badge badge-blue">{models.length} files</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state">
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : models.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No checkpoints yet</div>
              <div className="empty-state-text">Train a model first to see it here</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Last Modified</th>
                </tr>
              </thead>
              <tbody>
                {models.map(model => (
                  <tr
                    key={model.filename}
                    onClick={() => selectModel(model.filename)}
                    style={{
                      cursor: 'pointer',
                      background: selected === model.filename ? 'rgba(79, 142, 247, 0.08)' : undefined,
                    }}
                  >
                    <td>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: `2px solid ${selected === model.filename ? '#4f8ef7' : '#2a3d62'}`,
                          background: selected === model.filename ? '#4f8ef7' : 'transparent',
                          margin: '0 auto',
                        }}
                      />
                    </td>
                    <td><span className="mono">{model.filename}</span></td>
                    <td><FileSize mb={model.size_mb} /></td>
                    <td>
                      <span style={{ color: '#8b9ab8', fontSize: 13 }}>
                        {new Date(model.modified * 1000).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'end',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label className="form-label">MNIST sample index</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={sampleIndex}
                onChange={event => setSampleIndex(Math.max(0, event.target.valueAsNumber || 0))}
                disabled={predicting}
              />
              <p className="form-hint">Runs inference on the test split</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handlePredict} disabled={predicting}>
              {predicting ? 'Running prediction...' : 'Run Sample Prediction'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleAnalyse} disabled={analysing}>
              {analysing ? 'Analysing...' : 'Analyse Architecture'}
            </button>
            <button className="btn btn-outline-green btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export to ONNX'}
            </button>
          </div>
        )}
      </div>

      {prediction && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">Live Prediction</span>
            <span className={`badge ${prediction.matches_label ? 'badge-green' : 'badge-amber'}`}>
              {prediction.matches_label ? 'Correct' : 'Mismatch'}
            </span>
          </div>
          <div className="card-body">
            <div className="comparison-row">
              <div className="comparison-col" style={{ alignItems: 'center' }}>
                <DigitPreview pixels={prediction.image_pixels} />
                <div className="metric-sub" style={{ marginTop: 12 }}>
                  Sample #{prediction.sample_index} from the {prediction.split} split
                </div>
              </div>
              <div className="comparison-col">
                <div className="metric-item" style={{ marginBottom: 12 }}>
                  <div className="metric-label">Predicted Label</div>
                  <div className="metric-value">{prediction.predicted_label}</div>
                </div>
                <div className="metric-item" style={{ marginBottom: 12 }}>
                  <div className="metric-label">True Label</div>
                  <div className="metric-value">{prediction.true_label}</div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Confidence</div>
                  <div className="metric-value">{(prediction.confidence * 100).toFixed(2)}%</div>
                </div>
              </div>
            </div>

            <div className="table-wrapper" style={{ marginTop: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Label</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.top_predictions.map((item, index) => (
                    <tr key={`${item.label}-${index}`}>
                      <td>{index + 1}</td>
                      <td><span className="badge badge-purple">{item.label}</span></td>
                      <td><span className="mono">{(item.confidence * 100).toFixed(2)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="alert alert-info" style={{ marginTop: 16 }}>
              This is the first live serving path in the project: a saved checkpoint is loaded, a model runs inference,
              and the API returns the prediction payload the frontend renders.
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">Architecture: {analysis.model_class}</span>
            <span className="badge badge-purple">{analysis.total_params.toLocaleString()} params</span>
          </div>
          <div className="card-body">
            <div className="model-stats-grid">
              <div className="metric-item">
                <div className="metric-label">Total Parameters</div>
                <div className="metric-value">{analysis.total_params.toLocaleString()}</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Trainable</div>
                <div className="metric-value">{analysis.trainable_params.toLocaleString()}</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">CPU Latency</div>
                <div className="metric-value" style={{ fontSize: 16 }}>
                  <Latency ms={analysis.inference_latency_ms} />
                </div>
              </div>
              {analysis.file_size_mb && (
                <div className="metric-item">
                  <div className="metric-label">File Size</div>
                  <div className="metric-value"><FileSize mb={analysis.file_size_mb} /></div>
                </div>
              )}
              <div className="metric-item">
                <div className="metric-label">Input Shape</div>
                <div className="metric-value" style={{ fontSize: 14 }}>
                  [{analysis.input_shape.join(' x ')}]
                </div>
              </div>
            </div>

            <div className="table-wrapper" style={{ marginTop: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Type</th>
                    <th>Params</th>
                    <th>Shape</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.layers.map((layer, index) => (
                    <tr key={index}>
                      <td><span className="mono">{layer.name}</span></td>
                      <td><span className="badge badge-purple">{layer.type}</span></td>
                      <td><span className="mono">{layer.params.toLocaleString()}</span></td>
                      <td>
                        <span className="mono" style={{ color: '#8b9ab8', fontSize: 12 }}>
                          {'in_features' in layer ? `${layer.in_features} -> ${layer.out_features}` : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {onnxResult && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">ONNX Export Report</span>
            <span className="badge badge-green">{onnxResult.comparison.latency_speedup_x}x faster</span>
          </div>
          <div className="card-body">
            <div className="alert alert-success">
              ONNX export complete. File saved to{' '}
              <code
                style={{
                  fontFamily: 'monospace',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {onnxResult.onnx_path}
              </code>
            </div>

            <div className="comparison-row">
              <div className="comparison-col pytorch">
                <div className="comparison-col-header">PyTorch (.pth)</div>
                <div className="metric-item" style={{ marginBottom: 10 }}>
                  <div className="metric-label">File Size</div>
                  <div className="metric-value"><FileSize mb={onnxResult.pytorch.file_size_mb} /></div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">CPU Latency</div>
                  <div className="metric-value"><Latency ms={onnxResult.pytorch.inference_latency_ms} /></div>
                </div>
              </div>

              <div className="comparison-col onnx">
                <div className="comparison-col-header">ONNX Runtime</div>
                <div className="metric-item" style={{ marginBottom: 10 }}>
                  <div className="metric-label">File Size</div>
                  <div className="metric-value"><FileSize mb={onnxResult.onnx.file_size_mb} /></div>
                  <div className="metric-sub">-{onnxResult.comparison.size_reduction_pct}% smaller</div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">CPU Latency</div>
                  <div className="metric-value"><Latency ms={onnxResult.onnx.inference_latency_ms} /></div>
                  <div className="metric-sub">{onnxResult.comparison.latency_speedup_x}x speedup</div>
                </div>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginTop: 16 }}>
              ECE insight: ONNX gives you a portable model format for edge and accelerator-friendly inference flows.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
