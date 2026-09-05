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


class TestMemlogFrontmatterKeys(unittest.TestCase):
    def test_init_rejects_invalid_keys(self) -> None:
        cases = ("---=x", "=x", "foo:bar=x", "a\nb=x")
        with tempfile.TemporaryDirectory() as raw:
            for i, field in enumerate(cases):
                workspace = Path(raw) / f"run-{i}"
                result = _run("init", "--workspace", str(workspace), f"--field={field}")
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("invalid frontmatter key", result.stderr)
                self.assertFalse((workspace / ".memlog.md").exists())

    def test_set_rejects_invalid_keys(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workspace = Path(raw) / "run"
            init = _run("init", "--workspace", str(workspace), "--field=topic=ok")
            self.assertEqual(init.returncode, 0, init.stderr)
            for key in ("---", "", "foo:bar", "a\nb"):
                result = _run(
                    "set", "--workspace", str(workspace), f"--key={key}", "--value=x"
                )
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("invalid frontmatter key", result.stderr)
            body = (workspace / ".memlog.md").read_text(encoding="utf-8")
            self.assertIn("topic: ok", body)


if __name__ == "__main__":
    unittest.main()
