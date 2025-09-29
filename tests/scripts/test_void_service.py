"""Unit tests for the stdio bridge exposed in ``scripts/void_service.py``."""

from __future__ import annotations

import io
import json
import unittest
from unittest.mock import MagicMock, patch

import scripts.void_service as void_service


class VoidServiceBridgeTest(unittest.TestCase):
    """Exercise the streaming command loop and config caching helpers."""

    def test_iter_requests_skips_blank_lines(self) -> None:
        stream = io.StringIO("register\n\n  refresh  \n")

        with patch.object(void_service.sys, "stdin", stream):
            requests = list(void_service.iter_requests())

        self.assertEqual(requests, ["register", "refresh"])

    def test_ensure_manager_reuses_cached_instance(self) -> None:
        config = {"capacity": 1}
        replacement = MagicMock(name="manager")

        with patch("scripts.void_service.load_manager", return_value=replacement) as load_mock:
            manager, digest = void_service.ensure_manager(None, None, config)
            self.assertIs(manager, replacement)
            self.assertTrue(digest)

            reused_manager, reused_digest = void_service.ensure_manager(manager, digest, dict(config))

        self.assertIs(reused_manager, replacement)
        self.assertEqual(reused_digest, digest)
        load_mock.assert_called_once()

    def test_main_emits_error_responses_for_invalid_payloads(self) -> None:
        command_stream = io.StringIO(
            "not-json\n" "{\"command\": \"register\"}\n" "{\"command\": \"__shutdown__\"}\n"
        )
        output_stream = io.StringIO()

        with patch.object(void_service.sys, "stdin", command_stream), patch.object(
            void_service.sys, "stdout", output_stream
        ):
            void_service.main()

        lines = [json.loads(line) for line in output_stream.getvalue().splitlines() if line.strip()]

        self.assertGreaterEqual(len(lines), 3)
        self.assertIn("Invalid JSON payload", lines[0]["error"])
        self.assertEqual(lines[1]["error"], "Missing manager configuration")
        self.assertTrue(lines[2]["ok"])


if __name__ == "__main__":
    unittest.main()
