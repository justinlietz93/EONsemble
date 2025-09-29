import unittest
from typing import List

from src.void_dynamics.manager import VoidMemoryManager


class VoidMemoryManagerFailureInjectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = VoidMemoryManager(
            capacity=48,
            base_ttl=96,
            decay_half_life=12,
            prune_sample=32,
            prune_target_ratio=0.25,
            seed=13,
            diffusion_interval=8,
            condensation_boredom=0.2,
            condensation_conf=0.3,
            condensation_mass=1.4,
        )
        self.memory_ids = [
            "void-alpha",
            "void-beta",
            "void-gamma",
            "void-delta",
            "void-epsilon",
            "void-zeta",
        ]
        self.texts = [
            "Coherent field interactions shaping pressure gradients across void lattices.",
            "Phase space perturbations under resonant forcing of collaborative agents.",
            "Entropy-minimizing control loop for distributed void reinforcement cycles.",
            "Boundary layer dynamics within hybrid memory manifolds under churn.",
            "Observability envelope diagnostics for multi-agent rehearsal states.",
            "Refractive signature catalog for vacuum fluctuation compensation routines.",
        ]
        self.manager.register_chunks(ids=self.memory_ids, raw_texts=self.texts)

    def _reinforcement_payload(self) -> dict:
        ids_rows: List[List[str]] = []
        dist_rows: List[List[float]] = []
        for offset in range(3):
            ids_rows.append([
                self.memory_ids[(offset + index) % len(self.memory_ids)]
                for index in range(4)
            ])
            dist_rows.append([0.08 + 0.05 * index for index in range(4)])
        return {"ids": ids_rows, "distances": dist_rows}

    def test_failure_injection_backpressure_recovery(self) -> None:
        batches: List[List[str]] = []
        summaries: List[str] = []

        def condense_callback(texts: List[str]):
            batches.append(list(texts))
            if len(batches) < 2:
                return None
            summary_id = f"condense-summary-{len(batches)}"
            summaries.append(summary_id)
            combined = " ".join(texts)
            return summary_id, combined

        self.manager.set_condense_callback(condense_callback)

        payload = self._reinforcement_payload()
        self.manager.reinforce(results=payload, heat_gain=1.5, ttl_boost=120)
        snapshot_after_first = self.manager.to_dict()
        baseline_heat = snapshot_after_first["mem"][self.memory_ids[0]]["heat"]

        stalled_ids = self.memory_ids[:4]
        self.manager.degrade(ids=stalled_ids, ttl_floor=3)
        self.manager.degrade(ids=stalled_ids, ttl_floor=3)

        self.manager.register_chunks(
            ids=["queue-backlog-control"],
            raw_texts=[
                "Backpressure flush memo coordinating decay passes across the cohort.",
            ],
        )

        snapshot_after_register = self.manager.to_dict()
        decayed_heat = snapshot_after_register["mem"][self.memory_ids[0]]["heat"]
        for memory_id in stalled_ids:
            self.assertLessEqual(snapshot_after_register["mem"][memory_id]["ttl"], 2)
        self.assertLess(decayed_heat, baseline_heat)

        self.manager.reinforce(results=payload, heat_gain=1.0, ttl_boost=96)
        self.manager.degrade(ids=stalled_ids, ttl_floor=3)
        self.manager.reinforce(results=payload, heat_gain=0.9, ttl_boost=72)

        snapshot_final = self.manager.to_dict()
        events = self.manager.consume_events()

        self.assertGreaterEqual(len(batches), 2)
        self.assertGreaterEqual(len(summaries), 1)
        for summary_id in summaries:
            self.assertIn(summary_id, snapshot_final["mem"])

        self.assertIn("queue-backlog-control", snapshot_final["mem"])
        for memory_id in self.memory_ids:
            self.assertIn(memory_id, snapshot_final["mem"])

        self.assertGreater(snapshot_final["reward_ema"], 0.0)
        self.assertTrue(any(event["type"] == "degrade" for event in events))
        self.assertTrue(any(event["type"] == "reinforce" for event in events))
        self.assertTrue(all(batch for batch in batches))

        condense_targets = [
            memory_id
            for memory_id, state in snapshot_final["mem"].items()
            if state.get("pending_condense")
        ]
        self.assertFalse(
            condense_targets,
            "pending condensation queue should be cleared after callback execution",
        )


if __name__ == "__main__":
    unittest.main()
