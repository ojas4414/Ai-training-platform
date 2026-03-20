import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';

import {
  createAnalysisJob,
  createExportJob,
  getApiErrorMessage,
  listDatasets,
  listModels,
  predictModel,
  uploadDataset,
  uploadModel,
  waitForJob,
} from '../api';
import { LoadingPanel } from './LoadingPanel';
import { Reveal } from './Reveal';
import type {
  DatasetFile,
  ModelAnalysis,
  ModelFile,
  OnnxComparison,
  PredictionResponse,
} from '../types';

function withProgress(message: string | null, progress?: number | null) {
  if (!message) {
    return null;
  }

  if (progress == null) {
    return message;
  }

  return `${message} (${progress.toFixed(0)}%)`;
}

function FileSize({ mb }: { mb: number }) {
  return <span className="mono">{mb.toFixed(2)} MB</span>;
}

function SelectedFileMeta({ file, emptyLabel }: { file: File | null; emptyLabel: string }) {
  return (
    <div className={`upload-selection ${file ? 'has-file' : ''}`}>
      <div>
        <div className="upload-selection-label">Selected file</div>
        <div className="upload-selection-file">{file?.name ?? emptyLabel}</div>
      </div>
      {file && <span className="upload-selection-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>}
    </div>
  );
}

function Latency({ ms }: { ms: number }) {
  const color = ms < 1 ? 'var(--accent-success)' : ms < 5 ? 'var(--accent-warning)' : 'var(--accent-danger)';
  return (
    <span className="mono" style={{ color }}>
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
        background: 'var(--bg-panel-muted)',
        border: '1px solid var(--border-soft)',
        borderRadius: 16,
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
              background: `rgba(103, 232, 249, ${Math.max(0.08, Math.min(value, 1))})`,
            }}
          />
        )),
      )}
    </div>
  );
}

export const ModelsTab: React.FC = () => {
  const modelInputId = useId();
  const datasetInputId = useId();
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const datasetInputRef = useRef<HTMLInputElement | null>(null);
  const [models, setModels] = useState<ModelFile[]>([]);
  const [datasets, setDatasets] = useState<DatasetFile[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [modelUploadFile, setModelUploadFile] = useState<File | null>(null);
  const [datasetUploadFile, setDatasetUploadFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [onnxResult, setOnnxResult] = useState<OnnxComparison | null>(null);
  const [analysis, setAnalysis] = useState<ModelAnalysis | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number | null>(null);

  const refreshAssets = async () => {
    const [modelResponse, datasetResponse] = await Promise.all([listModels(), listDatasets()]);
    setModels(modelResponse.models);
    setDatasets(datasetResponse.datasets);
  };

  useEffect(() => {
    void refreshAssets()
      .catch((requestError: unknown) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoadingAssets(false));
  }, []);

  const resetDerivedState = () => {
    setOnnxResult(null);
    setAnalysis(null);
    setPrediction(null);
  };

  const selectModel = (filename: string) => {
    setSelectedModel(filename);
    resetDerivedState();
  };

  const handleModelUpload = async () => {
    if (!modelUploadFile) {
      return;
    }

    setUploadingModel(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await uploadModel(modelUploadFile);
      setSuccessMessage(response.message);
      setSelectedModel(response.model.filename);
      setModelUploadFile(null);
      if (modelInputRef.current) {
        modelInputRef.current.value = '';
      }
      await refreshAssets();
      resetDerivedState();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setUploadingModel(false);
    }
  };

  const handleDatasetUpload = async () => {
    if (!datasetUploadFile) {
      return;
    }

    setUploadingDataset(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await uploadDataset(datasetUploadFile);
      setSuccessMessage(response.message);
      setDatasetUploadFile(null);
      if (datasetInputRef.current) {
        datasetInputRef.current.value = '';
      }
      await refreshAssets();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setUploadingDataset(false);
    }
  };

  const handleExport = async () => {
    if (!selectedModel) {
      return;
    }

    setExporting(true);
    setError(null);
    setOnnxResult(null);
    setJobMessage(null);
    setJobProgress(null);

    try {
      const queuedJob = await createExportJob(selectedModel);
      setJobMessage(queuedJob.message);
      setJobProgress(queuedJob.progress ?? null);

      const finalJob = await waitForJob<OnnxComparison>(queuedJob.job_id, {
        onUpdate: nextJob => {
          setJobMessage(nextJob.message);
          setJobProgress(nextJob.progress ?? null);
        },
      });

      if (finalJob.status === 'failed') {
        throw new Error(finalJob.error || 'Export job failed');
      }

      if (!finalJob.result) {
        throw new Error('Export job finished without a result payload');
      }

      setOnnxResult(finalJob.result);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setExporting(false);
      setJobMessage(null);
      setJobProgress(null);
    }
  };

  const handleAnalyse = async () => {
    if (!selectedModel) {
      return;
    }

    setAnalysing(true);
    setError(null);
    setAnalysis(null);
    setJobMessage(null);
    setJobProgress(null);

    try {
      const queuedJob = await createAnalysisJob(selectedModel);
      setJobMessage(queuedJob.message);
      setJobProgress(queuedJob.progress ?? null);

      const finalJob = await waitForJob<ModelAnalysis>(queuedJob.job_id, {
        onUpdate: nextJob => {
          setJobMessage(nextJob.message);
          setJobProgress(nextJob.progress ?? null);
        },
      });

      if (finalJob.status === 'failed') {
        throw new Error(finalJob.error || 'Analysis job failed');
      }

      if (!finalJob.result) {
        throw new Error('Analysis job finished without a result payload');
      }

      setAnalysis(finalJob.result);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setAnalysing(false);
      setJobMessage(null);
      setJobProgress(null);
    }
  };

  const handlePredict = async () => {
    if (!selectedModel) {
      return;
    }

    setPredicting(true);
    setError(null);
    setPrediction(null);

    try {
      const response = await predictModel(selectedModel, {
        sample_index: sampleIndex,
        split: 'test',
        top_k: 3,
      });
      setPrediction(response);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setPredicting(false);
    }
  };

  return (
      <div className="tab-content">
      <div className="page-header">
        <div>
          <div className="page-kicker">Asset operations</div>
          <h1 className="page-title">Assets Lab</h1>
          <p className="page-subtitle">
            Upload checkpoints and datasets, inspect model structure, run a sample prediction, and export portable
            artifacts.
          </p>
        </div>
      </div>

      <div className="status-stack">
        <AnimatePresence initial={false}>
          {error && (
            <m.div
              key="models-error"
              className="alert alert-error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              Request failed: {error}
            </m.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {successMessage && (
            <m.div
              key="models-success"
              className="alert alert-success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {successMessage}
            </m.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {jobMessage && (
            <m.div
              key="models-job"
              className="alert alert-info"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {withProgress(jobMessage, jobProgress)}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <Reveal delay={0.04}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Asset intake</span>
            <span className="badge badge-blue">Models and datasets</span>
          </div>

          <div className="card-body">
            <div className="asset-grid">
              <div className="comparison-col">
                <div className="upload-intake-kicker">Checkpoint intake</div>
                <div className="comparison-col-header">Upload a model checkpoint</div>
                <p className="asset-intake-note">
                  Add a project-compatible <span className="mono">.pt</span> or <span className="mono">.pth</span> file
                  so it can be analysed, exported, and used for inference in this workspace.
                </p>
                <div className="form-group section-gap">
                  <label className="form-label" htmlFor={modelInputId}>Checkpoint file</label>
                  <input
                    ref={modelInputRef}
                    id={modelInputId}
                    className="upload-input-hidden"
                    type="file"
                    accept=".pt,.pth"
                    onChange={event => setModelUploadFile(event.target.files?.[0] ?? null)}
                  />
                  <label className="upload-surface" htmlFor={modelInputId}>
                    <span className="upload-surface-kicker">Model asset</span>
                    <span className="upload-surface-title">Choose checkpoint</span>
                    <span className="upload-surface-text">
                      Designed for quick analysis, export, and sample inference from the assets workspace.
                    </span>
                    <span className="upload-surface-meta">Supports .pt and .pth files</span>
                  </label>
                  <SelectedFileMeta file={modelUploadFile} emptyLabel="No model file selected yet." />
                </div>
                <button className="btn btn-primary" onClick={handleModelUpload} disabled={!modelUploadFile || uploadingModel}>
                  {uploadingModel ? 'Uploading model' : 'Upload model'}
                </button>
              </div>

              <div className="comparison-col">
                <div className="upload-intake-kicker">Dataset intake</div>
                <div className="comparison-col-header">Upload a dataset</div>
                <p className="asset-intake-note">
                  Add a reusable dataset asset as <span className="mono">.csv</span>, <span className="mono">.tsv</span>,{' '}
                  <span className="mono">.json</span>, or <span className="mono">.zip</span>. The backend stores preview
                  metadata so the dataset can be inspected later.
                </p>
                <div className="form-group section-gap">
                  <label className="form-label" htmlFor={datasetInputId}>Dataset file</label>
                  <input
                    ref={datasetInputRef}
                    id={datasetInputId}
                    className="upload-input-hidden"
                    type="file"
                    accept=".csv,.tsv,.json,.zip"
                    onChange={event => setDatasetUploadFile(event.target.files?.[0] ?? null)}
                  />
                  <label className="upload-surface upload-surface-secondary" htmlFor={datasetInputId}>
                    <span className="upload-surface-kicker">Dataset asset</span>
                    <span className="upload-surface-title">Choose dataset</span>
                    <span className="upload-surface-text">
                      Bring CSV, TSV, JSON, or ZIP data into the platform with preview metadata ready for reuse.
                    </span>
                    <span className="upload-surface-meta">Supports .csv, .tsv, .json, and .zip files</span>
                  </label>
                  <SelectedFileMeta file={datasetUploadFile} emptyLabel="No dataset file selected yet." />
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleDatasetUpload}
                  disabled={!datasetUploadFile || uploadingDataset}
                >
                  {uploadingDataset ? 'Uploading dataset' : 'Upload dataset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal className="section-gap" delay={0.08}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Uploaded datasets</span>
            <span className="badge badge-amber">{datasets.length} assets</span>
          </div>

          <div className="table-wrapper">
            {loadingAssets ? (
              <LoadingPanel
                kicker="Dataset assets"
                title="Loading uploaded datasets"
                text="Rebuilding the asset library view with preview metadata and reusable dataset details."
                compact
              />
            ) : datasets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">DS</div>
                <div className="empty-state-kicker">Reusable data</div>
                <div className="empty-state-title">No datasets uploaded yet</div>
                <div className="empty-state-text">
                  Upload a CSV, TSV, JSON, or ZIP dataset to start building a reusable asset library.
                </div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map(dataset => (
                    <tr key={dataset.filename}>
                      <td><span className="mono">{dataset.filename}</span></td>
                      <td><span className="badge badge-purple">{dataset.extension}</span></td>
                      <td><FileSize mb={dataset.size_mb} /></td>
                      <td>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <span>{dataset.preview?.summary ?? 'Preview unavailable'}</span>
                          {dataset.preview?.columns && dataset.preview.columns.length > 0 && (
                            <div className="asset-preview-list">
                              {dataset.preview.columns.slice(0, 5).map(column => (
                                <span className="asset-preview-pill" key={column}>
                                  {column}
                                </span>
                              ))}
                            </div>
                          )}
                          {dataset.preview?.entries && dataset.preview.entries.length > 0 && (
                            <div className="asset-preview-list">
                              {dataset.preview.entries.slice(0, 3).map(entry => (
                                <span className="asset-preview-pill" key={entry}>
                                  {entry}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal className="section-gap" delay={0.12}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Saved checkpoints</span>
            <span className="badge badge-blue">{models.length} files</span>
          </div>

          <div className="table-wrapper">
            {loadingAssets ? (
              <LoadingPanel
                kicker="Checkpoint library"
                title="Loading saved checkpoints"
                text="Preparing the active model list so analysis, prediction, and export actions can unlock."
                compact
              />
            ) : models.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">CK</div>
                <div className="empty-state-kicker">Checkpoint library</div>
                <div className="empty-state-title">No checkpoints yet</div>
                <div className="empty-state-text">
                  Train a model or upload a checkpoint to unlock analysis, prediction, and export actions.
                </div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Last modified</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(model => (
                    <tr
                      key={model.filename}
                      onClick={() => selectModel(model.filename)}
                      style={{
                        cursor: 'pointer',
                        background: selectedModel === model.filename ? 'rgba(103, 232, 249, 0.06)' : undefined,
                      }}
                    >
                      <td>
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: `2px solid ${selectedModel === model.filename ? 'var(--accent-primary)' : 'rgba(140, 170, 210, 0.34)'}`,
                            background: selectedModel === model.filename ? 'var(--accent-primary)' : 'transparent',
                            margin: '0 auto',
                          }}
                        />
                      </td>
                      <td><span className="mono">{model.filename}</span></td>
                      <td><FileSize mb={model.size_mb} /></td>
                      <td>{new Date(model.modified * 1000).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <AnimatePresence initial={false}>
            {selectedModel && (
              <m.div
                key={selectedModel}
                className="selection-tray"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="selection-tray-summary">
                  <div className="selection-tray-kicker">Selected checkpoint</div>
                  <div className="selection-tray-title mono">{selectedModel}</div>
                  <div className="selection-tray-text">
                    Run prediction, inspect the architecture, or export a portable ONNX artifact from this active asset.
                  </div>
                </div>
                <div className="form-group selection-tray-field">
                  <label className="form-label">MNIST sample index</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    value={sampleIndex}
                    onChange={event => setSampleIndex(Math.max(0, event.target.valueAsNumber || 0))}
                    disabled={predicting}
                  />
                  <p className="form-hint">Runs the currently selected checkpoint against the test split.</p>
                </div>
                <div className="asset-actions">
                  <button className="btn btn-primary btn-sm" onClick={handlePredict} disabled={predicting}>
                    {predicting ? 'Running prediction' : 'Run sample prediction'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleAnalyse} disabled={analysing}>
                    {analysing ? 'Analysing model' : 'Analyse architecture'}
                  </button>
                  <button className="btn btn-outline-green btn-sm" onClick={handleExport} disabled={exporting}>
                    {exporting ? 'Exporting artifact' : 'Export to ONNX'}
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      {prediction && (
        <Reveal className="section-gap" delay={0.08}>
          <div className="card">
          <div className="card-header">
            <span className="card-title">Prediction result</span>
            <span className={`badge ${prediction.matches_label ? 'badge-green' : 'badge-amber'}`}>
              {prediction.matches_label ? 'Prediction matches label' : 'Prediction differs from label'}
            </span>
          </div>

          <div className="card-body">
            <div className="comparison-row">
              <div className="comparison-col">
                <DigitPreview pixels={prediction.image_pixels} />
                <div className="metric-sub" style={{ marginTop: 12 }}>
                  Sample #{prediction.sample_index} from the {prediction.split} split
                </div>
              </div>
              <div className="comparison-col">
                <div className="metric-item" style={{ marginBottom: 12 }}>
                  <div className="metric-label">Predicted label</div>
                  <div className="metric-value">{prediction.predicted_label}</div>
                </div>
                <div className="metric-item" style={{ marginBottom: 12 }}>
                  <div className="metric-label">True label</div>
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
          </div>
        </div>
        </Reveal>
      )}

      {analysis && (
        <Reveal className="section-gap" delay={0.1}>
          <div className="card">
          <div className="card-header">
            <span className="card-title">Architecture profile for {analysis.model_class}</span>
            <span className="badge badge-purple">{analysis.total_params.toLocaleString()} parameters</span>
          </div>

          <div className="card-body">
            <div className="model-stats-grid">
              <div className="metric-item">
                <div className="metric-label">Total parameters</div>
                <div className="metric-value">{analysis.total_params.toLocaleString()}</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">Trainable parameters</div>
                <div className="metric-value">{analysis.trainable_params.toLocaleString()}</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">CPU latency</div>
                <div className="metric-value" style={{ fontSize: 18 }}>
                  <Latency ms={analysis.inference_latency_ms} />
                </div>
              </div>
              {analysis.file_size_mb && (
                <div className="metric-item">
                  <div className="metric-label">File size</div>
                  <div className="metric-value"><FileSize mb={analysis.file_size_mb} /></div>
                </div>
              )}
              <div className="metric-item">
                <div className="metric-label">Input shape</div>
                <div className="metric-value" style={{ fontSize: 15 }}>[{analysis.input_shape.join(' x ')}]</div>
              </div>
            </div>

            <div className="table-wrapper" style={{ marginTop: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Type</th>
                    <th>Parameters</th>
                    <th>Shape</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.layers.map((layer, index) => (
                    <tr key={`${layer.name}-${index}`}>
                      <td><span className="mono">{layer.name}</span></td>
                      <td><span className="badge badge-purple">{layer.type}</span></td>
                      <td><span className="mono">{layer.params.toLocaleString()}</span></td>
                      <td>
                        <span className="mono" style={{ color: '#6b7b8f', fontSize: 12 }}>
                          {'in_features' in layer ? `${layer.in_features} -> ${layer.out_features}` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </Reveal>
      )}

      {onnxResult && (
        <Reveal className="section-gap" delay={0.12}>
          <div className="card">
          <div className="card-header">
            <span className="card-title">Portable artifact report</span>
            <span className="badge badge-green">{onnxResult.comparison.latency_speedup_x}x ONNX speedup</span>
          </div>

          <div className="card-body">
            <div className="alert alert-success">
              ONNX export complete. The portable artifact was saved to <span className="inline-code">{onnxResult.onnx_path}</span>.
            </div>

            <div className={`comparison-row ${onnxResult.quantised ? 'comparison-row-three' : ''}`}>
              <div className="comparison-col pytorch">
                <div className="comparison-col-header">PyTorch checkpoint</div>
                <div className="metric-item" style={{ marginBottom: 10 }}>
                  <div className="metric-label">File size</div>
                  <div className="metric-value"><FileSize mb={onnxResult.pytorch.file_size_mb} /></div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">CPU latency</div>
                  <div className="metric-value"><Latency ms={onnxResult.pytorch.inference_latency_ms} /></div>
                </div>
              </div>

              <div className="comparison-col onnx">
                <div className="comparison-col-header">ONNX runtime artifact</div>
                <div className="metric-item" style={{ marginBottom: 10 }}>
                  <div className="metric-label">File size</div>
                  <div className="metric-value"><FileSize mb={onnxResult.onnx.file_size_mb} /></div>
                  <div className="metric-sub">-{onnxResult.comparison.size_reduction_pct}% smaller than the original checkpoint</div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">CPU latency</div>
                  <div className="metric-value"><Latency ms={onnxResult.onnx.inference_latency_ms} /></div>
                  <div className="metric-sub">{onnxResult.comparison.latency_speedup_x}x faster than the original checkpoint</div>
                </div>
              </div>

              {onnxResult.quantised && (
                <div className="comparison-col">
                  <div className="comparison-col-header">INT8 quantised artifact</div>
                  <div className="metric-item" style={{ marginBottom: 10 }}>
                    <div className="metric-label">File size</div>
                    <div className="metric-value"><FileSize mb={onnxResult.quantised.file_size_mb} /></div>
                    <div className="metric-sub">
                      -{onnxResult.comparison.int8_size_reduction_pct ?? 0}% smaller than the original checkpoint
                    </div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">CPU latency</div>
                    <div className="metric-value"><Latency ms={onnxResult.quantised.inference_latency_ms} /></div>
                    <div className="metric-sub">
                      {onnxResult.comparison.int8_latency_speedup_x ?? 0}x faster than the original checkpoint
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="alert alert-info" style={{ marginTop: 16 }}>
              This comparison is part of the platform&apos;s hardware-aware story: the same trained model can be inspected
              for portability, size, and inference speed trade-offs.
            </div>
          </div>
        </div>
        </Reveal>
      )}
    </div>
  );
};
