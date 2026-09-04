#!/usr/bin/env python3
"""TOML date/time values serialize via isoformat(); other types still fail."""
from __future__ import annotations

import json
import unittest
from datetime import date, datetime, time
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config_utils import toml_json_default  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
