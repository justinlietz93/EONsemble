import unittest
from typing import Dict, List

from src.void_dynamics.manager import VoidMemoryManager


class VoidMemoryManagerLearningSignalsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = VoidMemoryManager(
            capacity=64,
            base_ttl=120,
            decay_half_life=32,
            prune_sample=32,
            prune_target_ratio=0.2,
            seed=7,
            diffusion_interval=12,
        )

        self.sample_ids = ["mem-alpha", "mem-beta", "mem-gamma"]
        self.sample_texts = [
            "Energy conservation within coupled harmonic oscillators and resonant exchange.",
            "Tensor formulation clarifying stress-energy flow through curved spacetime sections.",
            "Quantum field vacuum fluctuations influencing effective mass renormalisation terms.",
        ]

        self.manager.register_chunks(ids=self.sample_ids, raw_texts=self.sample_texts)

    def _run_reinforcement(self) -> Dict[str, List[List[float]]]:
        reinforcement = {
            "ids": [["mem-alpha", "mem-beta"], ["mem-beta", "mem-gamma"]],
            "distances": [[0.05, 0.15], [0.08, 0.35]],
        }
        self.manager.reinforce(results=reinforcement, heat_gain=0.8, ttl_boost=180)
        return reinforcement

    def test_learning_signals_strengthen_after_reinforcement(self) -> None:
        baseline_stats = self.manager.stats()
        self.assertEqual(baseline_stats["count"], 3.0)
        self.assertAlmostEqual(baseline_stats["avg_confidence"], 0.35, delta=1e-6)

        reinforcement = self._run_reinforcement()

        updated_stats = self.manager.stats()
        self.assertGreater(updated_stats["avg_confidence"], baseline_stats["avg_confidence"])
        self.assertGreater(updated_stats["avg_mass"], baseline_stats["avg_mass"])
        self.assertGreater(updated_stats["avg_boredom"], baseline_stats["avg_boredom"])

        snapshot = self.manager.to_dict()
        self.assertGreater(snapshot["reward_ema"], 0.05)

        events = self.manager.consume_events()
        reinforce_events = [event for event in events if event["type"] == "reinforce"]
        self.assertTrue(reinforce_events, "reinforcement should generate lifecycle events")
        self.assertTrue(all(event["count"] >= 1 for event in reinforce_events))

        top_ranked = self.manager.top(2)
        self.assertEqual(len(top_ranked), 2)
        self.assertTrue(all(score > 0.0 for _, score in top_ranked))

        # ensure embeddings contribute deterministically to territory assignment
        territories = {
            memory_id: data["territory_id"]
            for memory_id, data in snapshot["mem"].items()
        }
        self.assertEqual(len(set(territories.values())), 3)

        # check similarity transformation was bounded correctly
        for row in reinforcement["distances"]:
            for distance in row:
                self.assertGreaterEqual(1.0 - distance, 0.0)

    def test_engram_registration_increases_member_attention_controls(self) -> None:
        self._run_reinforcement()

        registered = self.manager.register_engram(
            summary_id="engram-core",
            member_ids=self.sample_ids[:2],
            text="Composite summary of resonant stress-energy exchange",
        )
        self.assertTrue(registered)

        snapshot = self.manager.to_dict()
        engram = snapshot["engrams"].get("engram-core")
        self.assertEqual(len(engram or []), 2)

        for member_id in self.sample_ids[:2]:
            state = snapshot["mem"][member_id]
            self.assertGreaterEqual(state["boredom"], 0.05)
            self.assertGreaterEqual(state["inhibition"], 0.05)

    def test_degrade_caps_ttl_and_increases_boredom(self) -> None:
        self._run_reinforcement()
        self.manager.degrade(ids=self.sample_ids, ttl_floor=30)

        snapshot = self.manager.to_dict()
        for state in snapshot["mem"].values():
            self.assertLessEqual(state["ttl"], 30)
            self.assertGreaterEqual(state["boredom"], 0.1)


if __name__ == "__main__":
    unittest.main()
