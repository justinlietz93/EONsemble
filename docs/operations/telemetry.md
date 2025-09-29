# Nightly Telemetry Pipeline

The nightly telemetry suite exercises the Void Dynamics learning graph to spot
performance regressions before they reach production. It drives the
`VoidMemoryManager` through reinforcement, decay, and degradation events,
recording the resulting reward, heat, and territory metrics for trend
analysis.

## Goals
- Track reward EMA drift, heat decay, and boredom balance over time.
- Observe territory churn (splits and merges) to detect instability.
- Provide auditable artifacts for every nightly run.

## Execution Flow
1. **Manager preparation** – `scripts/nightly_telemetry.py` loads a persisted
   snapshot if one is provided. Otherwise it boots a deterministic manager and
   seeds it with baseline knowledge traces.
2. **Probe run** – `generate_report` in `src/void_dynamics/telemetry.py` runs the
   manager through a fixed number of reinforcement windows, injects periodic
   degradation, and captures telemetry samples after each window.
3. **Reporting** – the script writes a structured JSON report and a Markdown
   summary table to the `reports/` directory and emits the same files as GitHub
   Actions artifacts.

## Outputs
- `reports/void-telemetry-latest.json` – machine-readable samples and summary
  statistics for dashboards or alerting pipelines.
- `reports/void-telemetry-latest.md` – Markdown table used in manual reviews and
  documentation.

## Automated Anomaly Detection
- `generate_report` now evaluates each probe against configurable
  `AnomalyThresholds` (reward EMA floor, maximum heat delta, and peak heat).
- `scripts/nightly_telemetry.py` exits with a non-zero status if anomalies are
  detected, causing the GitHub Actions workflow to fail and surface the alert.
- Override thresholds using `--reward-floor`, `--max-avg-heat-delta`, and
  `--max-heat` when running the script locally to stress-test alternative
  baselines.

## GitHub Workflow
The `nightly-telemetry.yml` workflow runs every night (and on manual dispatch):
1. Check out the repository.
2. Set up Python 3.12.
3. Execute `python scripts/nightly_telemetry.py` to produce the reports.
4. Upload both report files as build artifacts for retention.

## Investigating Regressions
1. Compare the latest Markdown summary against previous runs using the
   `Final reward EMA` and `Heat average delta` lines.
2. Inspect the JSON report to find the windows where heat or boredom diverged
   sharply.
3. Cross-reference the `reinforced_ids` in each sample with application logs to
   understand the triggering memories.
4. File a regression ticket and attach the JSON artifact along with any
   supporting traces.

## Extending the Probe
- Adjust the probe window via `--iterations` or `--batch-size` to stress larger
  deployments.
- Override `--heat-gain` and `--ttl-boost` to mimic production reinforcement
  parameters.
- Supply `--snapshot path/to/save.json` to run the probe against a live capture
  of production data without mutating the source file.
