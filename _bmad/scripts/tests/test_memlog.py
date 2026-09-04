#!/usr/bin/env python3
"""Concurrent append must keep both records (file lock around RMW)."""
from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "memlog.py"


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        check=False,
    )


class TestMemlogParallelAppend(unittest.TestCase):
    def test_parallel_append_preserves_both_records(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workspace = Path(raw) / "run"
            init = _run("init", "--workspace", str(workspace), "--field", "topic=lock-test")
            self.assertEqual(init.returncode, 0, init.stderr)

            def append(text: str) -> subprocess.CompletedProcess[str]:
                return _run("append", "--workspace", str(workspace), "--text", text)

            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(append, "alpha-record")
                second = pool.submit(append, "beta-record")
                r1 = first.result()
                r2 = second.result()

            self.assertEqual(r1.returncode, 0, r1.stderr)
            self.assertEqual(r2.returncode, 0, r2.stderr)

            body = (workspace / ".memlog.md").read_text(encoding="utf-8")
            self.assertIn("alpha-record", body)
            self.assertIn("beta-record", body)
            self.assertGreaterEqual(sum(1 for ln in body.splitlines() if ln.startswith("- ")), 2)


if __name__ == "__main__":
    unittest.main()
