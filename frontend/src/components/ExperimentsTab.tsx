import React, { useEffect, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getApiErrorMessage, getExperiments, getMlflowRuns } from '../api';
import { AnimatedNumber } from './AnimatedNumber';
import { LoadingPanel } from './LoadingPanel';
import { Reveal } from './Reveal';
import type { ExperimentsResponse, MlflowRun } from '../types';

function AccuracyCell({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div className="accuracy-cell">
      <div className="accuracy-bar-wrap">
        <m.div
          className="accuracy-bar-fill"
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, amount: 0.8 }}
          transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="accuracy-value">
        <AnimatedNumber value={value} decimals={2} suffix="%" grouping={false} />
      </span>
    </div>
  );
}

export const ExperimentsTab: React.FC = () => {
  const [data, setData] = useState<ExperimentsResponse | null>(null);
  const [mlflowRuns, setMlflowRuns] = useState<MlflowRun[]>([]);
  const [mlflowTotal, setMlflowTotal] = useState(0);
  const [mlflowHasMore, setMlflowHasMore] = useState(false);
  const [mlflowLoading, setMlflowLoading] = useState(false);
  const [mlflowLoaded, setMlflowLoaded] = useState(false);
  const [mlflowError, setMlflowError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getExperiments()
      .then(experiments => {
        setData(experiments);
      })
      .catch((requestError: unknown) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const loadMlflowPage = async (reset = false) => {
    setMlflowLoading(true);
    setMlflowError(null);

    try {
      const offset = reset ? 0 : mlflowRuns.length;
      const response = await getMlflowRuns(12, offset);
      setMlflowTotal(response.total);
      setMlflowHasMore(response.has_more);
      setMlflowRuns(current => (reset ? response.runs : [...current, ...response.runs]));
      setMlflowLoaded(true);
    } catch (requestError: unknown) {
      setMlflowError(getApiErrorMessage(requestError));
    } finally {
      setMlflowLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingPanel
        kicker="Experiment history"
        title="Loading command center data"
        text="Pulling manual runs, HPO output, and MLflow metadata from the backend before rendering the dashboard."
      />
    );
  }

  if (error) {
    return <div className="alert alert-error">Unable to load experiments: {error}</div>;
  }

  const manual = data?.manual_experiments ?? [];
  const hpo = data?.hpo_results;
  const rankedManual = [...manual].sort((left, right) => right.best_accuracy - left.best_accuracy);
  const chartRuns = mlflowRuns.slice(0, 8);
  const bestAccuracy = Math.max(0, ...manual.map(run => run.best_accuracy), ...(hpo ? [hpo.best_val_accuracy] : []));
  const totalRuns = manual.length + (hpo?.all_trials.length ?? 0);
  const featuredScore = hpo?.best_val_accuracy ?? rankedManual[0]?.best_accuracy ?? 0;
  const featuredTitle = hpo
    ? `Optuna Trial #${hpo.best_trial}`
    : rankedManual[0]
      ? `Manual Run Leader`
      : 'Command center ready';
  const featuredSummary = hpo
    ? `Search studio currently leads with ${hpo.best_params.optimizer ?? 'the selected'} optimizer and ${hpo.best_params.batch_size ?? 'tuned'} batch sizing.`
    : rankedManual[0]
      ? `The strongest manual run used learning rate ${rankedManual[0].learning_rate} with batch size ${rankedManual[0].batch_size}.`
      : 'Launch a training run or an HPO search to surface a featured result here.';
  const featuredPills = [
    mlflowLoaded ? `${mlflowRuns.length}/${mlflowTotal} MLflow runs loaded` : 'MLflow available on demand',
    `${manual.length} manual runs`,
    `${hpo?.all_trials.length ?? 0} HPO trials`,
  ];

  return (
    <div className="tab-content">
      <div className="page-header">
        <div>
          <div className="page-kicker">Editorial briefing</div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            Review manual runs, HPO output, and MLflow results from one control surface.
          </p>
        </div>
      </div>

      <Reveal delay={0.04}>
        <div className="command-briefing-grid">
          <div className="briefing-card">
            <div className="briefing-eyebrow">Featured outcome</div>
            <div className="briefing-title">{featuredTitle}</div>
            <div className="briefing-value">
              <AnimatedNumber value={featuredScore} decimals={1} suffix="%" grouping={false} />
            </div>
            <div className="briefing-label">{featuredScore > 0 ? 'Highest observed validation accuracy' : 'Awaiting first tracked result'}</div>
            <p className="briefing-text">{featuredSummary}</p>
            <div className="briefing-pills">
              {featuredPills.map(pill => (
                <span className="briefing-pill" key={pill}>
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-icon">Runs</div>
              <div className="stat-value"><AnimatedNumber value={totalRuns} /></div>
              <div className="stat-label">Tracked experiment records</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon">Best</div>
              <div className="stat-value">
                <AnimatedNumber value={bestAccuracy > 0 ? bestAccuracy : 0} decimals={1} suffix="%" grouping={false} />
              </div>
              <div className="stat-label">Top validation accuracy</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon">MLflow</div>
              <div className="stat-value">{mlflowLoaded ? `${mlflowRuns.length}/${mlflowTotal}` : 'On demand'}</div>
              <div className="stat-label">Loaded tracking runs</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon">Search</div>
              <div className="stat-value"><AnimatedNumber value={hpo?.all_trials.length ?? 0} /></div>
              <div className="stat-label">Optuna trials recorded</div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Manual experiments</span>
            <span className="badge badge-blue">{manual.length} runs</span>
          </div>

          <div className="table-wrapper">
            {manual.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">RUN</div>
                <div className="empty-state-kicker">Training results</div>
                <div className="empty-state-title">No manual experiments yet</div>
                <div className="empty-state-text">
                  Launch a training run from the Experiment Builder to populate this view.
                </div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Learning rate</th>
                    <th>Batch size</th>
                    <th>Epochs</th>
                    <th>Validation accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {[...manual]
                    .sort((left, right) => right.best_accuracy - left.best_accuracy)
                    .map((experiment, index) => (
                      <tr key={`${experiment.learning_rate}-${experiment.batch_size}-${index}`}>
                        <td><span className="badge badge-blue">{index + 1}</span></td>
                        <td><span className="mono">{experiment.learning_rate}</span></td>
                        <td><span className="mono">{experiment.batch_size}</span></td>
                        <td><span className="mono">{experiment.epochs}</span></td>
                        <td><AccuracyCell value={experiment.best_accuracy} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Reveal>

      {hpo && (
        <Reveal className="section-gap" delay={0.12}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Search studio output</span>
              <div className="chip-row">
                <span className="badge badge-green">{hpo.best_val_accuracy.toFixed(2)}% best score</span>
                {hpo.execution_mode && (
                  <span className={`badge ${hpo.execution_mode === 'parallel' ? 'badge-blue' : 'badge-amber'}`}>
                    {hpo.execution_mode}
                  </span>
                )}
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Trial</th>
                    <th>Learning rate</th>
                    <th>Batch</th>
                    <th>Optimizer</th>
                    <th>Hidden</th>
                    <th>Layers</th>
                    <th>Epochs</th>
                    <th>Validation accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {hpo.all_trials.slice(0, 20).map(trial => (
                    <tr key={trial.trial}>
                      <td>
                        {trial.trial === hpo.best_trial ? (
                          <span className="badge badge-green">Best #{trial.trial}</span>
                        ) : (
                          <span className="badge badge-blue">#{trial.trial}</span>
                        )}
                      </td>
                      <td><span className="mono">{Number(trial.learning_rate).toExponential(2)}</span></td>
                      <td><span className="mono">{trial.batch_size}</span></td>
                      <td><span className="badge badge-purple">{trial.optimizer}</span></td>
                      <td><span className="mono">{trial.hidden_size}</span></td>
                      <td><span className="mono">{trial.n_layers}</span></td>
                      <td><span className="mono">{trial.epochs}</span></td>
                      <td><AccuracyCell value={trial.val_accuracy} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal className="section-gap" delay={0.16}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tracked accuracy trend</span>
            <div className="chip-row">
              <span className="badge badge-purple">{mlflowLoaded ? `${mlflowRuns.length} loaded` : 'Lazy loaded'}</span>
              {mlflowLoaded && <span className="badge badge-blue">{mlflowTotal} total runs</span>}
            </div>
          </div>

          <div className="card-body">
            {!mlflowLoaded && (
              <div className="empty-state">
                <div className="empty-state-icon">ML</div>
                <div className="empty-state-kicker">Tracking history</div>
                <div className="empty-state-title">MLflow history loads on demand</div>
                <div className="empty-state-text">
                  Manual experiment results are shown immediately. Load tracked runs only when you need the MLflow view.
                </div>
                {mlflowError && <div className="alert alert-error">{mlflowError}</div>}
                <button className="btn btn-secondary" onClick={() => void loadMlflowPage(true)} disabled={mlflowLoading}>
                  {mlflowLoading ? 'Loading MLflow history' : 'Load MLflow history'}
                </button>
              </div>
            )}

            {mlflowLoaded && chartRuns.length > 0 && (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartRuns.map((run, index) => ({
                      name: run.run_name || `Run ${index + 1}`,
                      accuracy: run.metrics.best_val_accuracy ?? 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--chart-tooltip-bg)',
                        border: '1px solid var(--chart-tooltip-border)',
                        borderRadius: 16,
                        color: 'var(--text-inverse)',
                      }}
                      labelStyle={{ color: 'var(--text-inverse)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="var(--chart-cyan)"
                      strokeWidth={3}
                      dot={{ fill: 'var(--chart-violet)', strokeWidth: 0, r: 4 }}
                      name="Validation accuracy"
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="table-wrapper" style={{ marginTop: 20 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Run</th>
                        <th>Experiment</th>
                        <th>Status</th>
                        <th>Best accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlflowRuns.map((run, index) => (
                        <tr key={run.run_id}>
                          <td><span className="mono">{run.run_name || `Run ${index + 1}`}</span></td>
                          <td>{run.experiment}</td>
                          <td><span className="badge badge-purple">{run.status}</span></td>
                          <td><AccuracyCell value={run.metrics.best_val_accuracy ?? 0} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {mlflowError && <div className="alert alert-error" style={{ marginTop: 16 }}>{mlflowError}</div>}

                {(mlflowHasMore || mlflowLoading) && (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-secondary" onClick={() => void loadMlflowPage(false)} disabled={mlflowLoading}>
                      {mlflowLoading ? 'Loading more runs' : 'Load more runs'}
                    </button>
                  </div>
                )}
              </>
            )}

            {mlflowLoaded && chartRuns.length === 0 && !mlflowLoading && (
              <div className="empty-state">
                <div className="empty-state-icon">LOG</div>
                <div className="empty-state-kicker">Tracking history</div>
                <div className="empty-state-title">No MLflow runs available</div>
                <div className="empty-state-text">Tracked runs will appear here after training or HPO jobs complete.</div>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
};
