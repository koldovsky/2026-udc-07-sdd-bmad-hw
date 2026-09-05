#!/usr/bin/env python3
"""TOML date/time values serialize via isoformat(); other types still fail."""
from __future__ import annotations

import io
import json
import sys
import unittest
from datetime import date, datetime, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config_utils import toml_json_default, write_json_stdout  # noqa: E402


class TestTomlJsonDefault(unittest.TestCase):
    def test_temporal_values_use_isoformat(self) -> None:
        payload = {
            "d": date(2026, 9, 4),
            "t": time(19, 40, 0),
            "dt": datetime(2026, 9, 4, 19, 40, 0),
        }
        encoded = json.dumps(payload, default=toml_json_default)
        decoded = json.loads(encoded)
        self.assertEqual(decoded["d"], payload["d"].isoformat())
        self.assertEqual(decoded["t"], payload["t"].isoformat())
        self.assertEqual(decoded["dt"], payload["dt"].isoformat())

    def test_other_types_keep_standard_json_error(self) -> None:
        with self.assertRaises(TypeError):
            json.dumps({"path": Path(".")}, default=toml_json_default)

    def test_write_json_stdout_preserves_unicode_and_temporals(self) -> None:
        payload = {"name": "Привіт", "when": date(2026, 9, 4)}
        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        try:
            write_json_stdout(payload)
        finally:
            sys.stdout = old
        text = buf.getvalue()
        self.assertIn("Привіт", text)
        self.assertNotIn("\\u041f", text)
        self.assertIn("2026-09-04", text)


if __name__ == "__main__":
    unittest.main()
