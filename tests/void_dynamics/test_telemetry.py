import unittest

from src.void_dynamics.manager import VoidMemoryManager
from src.void_dynamics.telemetry import (
    AnomalyThresholds,
    TelemetrySample,
    collect_sample,
    drive_manager_for_telemetry,
    generate_report,
    render_markdown_report,
)


class VoidTelemetryProbeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = VoidMemoryManager(
            capacity=32,
            base_ttl=90,
            decay_half_life=10,
            prune_sample=24,
            prune_target_ratio=0.25,
            seed=3,
            diffusion_interval=10,
            condensation_boredom=0.25,
            condensation_conf=0.4,
            condensation_mass=1.2,
        )
        ids = [f"mem-{index}" for index in range(6)]
        texts = [
            "Void-agent cooperative derivations maintain semantic continuity in the lab.",
            "Resonant manifolds propagate focus cues between reasoning cohorts.",
            "Adaptive reinforcement balances boredom and novelty in distributed traces.",
            "Telemetry beacons watch reward EMA drift against expected baselines.",
            "Field notebooks capture territory splits and centroid churn for audits.",
            "Persistence checkpoints enable recovery after catastrophic replay events.",
        ]
        self.manager.register_chunks(ids=ids, raw_texts=texts)

    def test_collect_sample_reports_core_metrics(self) -> None:
        payload = {"ids": [["mem-0", "mem-1"]], "distances": [[0.1, 0.2]]}
        self.manager.reinforce(results=payload, heat_gain=1.0, ttl_boost=120)
        events = self.manager.consume_events()
        sample = collect_sample(
            self.manager,
            label="sanity",
            events=events,
            reinforced_ids=["mem-0", "mem-1"],
        )
        self.assertIsInstance(sample, TelemetrySample)
        self.assertGreater(sample.reward_ema, 0.0)
        self.assertGreater(sample.avg_heat, 0.0)
        self.assertIn("reinforce", sample.events)

    def test_drive_manager_generates_samples(self) -> None:
        samples = drive_manager_for_telemetry(
            self.manager,
            iterations=6,
            batch_size=3,
            degrade_interval=2,
            ttl_floor=12,
            heat_gain=0.9,
            ttl_boost=60,
        )
        self.assertEqual(len(samples), 6)
        for sample in samples:
            self.assertGreaterEqual(sample.count, 1)
            self.assertGreaterEqual(sample.avg_confidence, 0.0)

    def test_generate_report_and_markdown_output(self) -> None:
        report = generate_report(
            self.manager,
            iterations=4,
            batch_size=3,
            degrade_interval=2,
            ttl_floor=16,
            heat_gain=0.8,
            ttl_boost=80,
        )
        self.assertIn("samples", report)
        self.assertIn("summary", report)
        self.assertEqual(report["summary"].get("status"), "ok")
        markdown = render_markdown_report(report)
        self.assertIn("Void Dynamics Nightly Telemetry", markdown)
        self.assertIn("Final reward EMA", markdown)
        self.assertIn("## Anomalies", markdown)

    def test_generate_report_flags_anomalies_when_thresholds_strict(self) -> None:
        thresholds = AnomalyThresholds(min_reward_ema=0.9, max_avg_heat_delta=0.1, max_heat=0.5)
        report = generate_report(
            self.manager,
            iterations=3,
            batch_size=2,
            degrade_interval=2,
            ttl_floor=20,
            heat_gain=0.8,
            ttl_boost=60,
            thresholds=thresholds,
        )
        summary = report["summary"]
        self.assertEqual(summary.get("status"), "alert")
        self.assertGreater(len(summary.get("anomalies", [])), 0)


if __name__ == "__main__":
    unittest.main()
