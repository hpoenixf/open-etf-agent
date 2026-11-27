"""Provider-free contract and boundary checks for the numeric-only interpreter."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "src/owner-skills/financial-chart/controlled-chart-compute.py"
SPEC = importlib.util.spec_from_file_location("compute", SCRIPT)
COMPUTE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPUTE)


class ControlledComputeTests(unittest.TestCase):
    def calculate(self, script, **inputs):
        return COMPUTE.compute({"script": script, "inputs": inputs})

    def rejects(self, script, code=None, **inputs):
        with self.assertRaises(COMPUTE.FormulaError) as observed:
            self.calculate(script, **inputs)
        if code is not None:
            self.assertEqual(observed.exception.code, code)

    def run_cli(self, value):
        raw = value if type(value) is bytes else json.dumps(value).encode("utf-8")
        return subprocess.run([sys.executable, "-I", "-B", str(SCRIPT)], input=raw,
                              capture_output=True, timeout=5, check=False)

    def test_revenue_growth_across_missing_and_zero_base(self):
        actual = self.calculate("quarterly_growth = growth(revenue)\nquarterly_growth",
                                revenue=[100, 110, None, 120, 0, 15, 18])
        self.assertEqual(actual, [None, 10, None, None, -100, None, 20])

    def test_aligned_vector_arithmetic_and_percentage(self):
        actual = self.calculate("net = gross - returns\npct(net, gross)", gross=[100, 0, None, 5],
                                returns=[10, 0, 1, 2])
        self.assertEqual(actual, [90, None, None, 60])
        self.assertEqual(self.calculate("growth(current, prior)", current=[10, 20], prior=[8, 25]), [25, -20])
        self.assertEqual(self.calculate("-series + 3", series=[2, None, -4]), [1, None, 7])

    def test_missing_is_not_zero_without_explicit_coalesce(self):
        self.assertIsNone(self.calculate("sum([None, None])"))
        self.assertEqual(self.calculate("avg([2, None, 4])"), 3)
        self.assertEqual(self.calculate("coalesce(series, fallback)", series=[1, None], fallback=[10, 20]),
                         [1, 20])
        self.assertEqual(self.calculate("sum(coalesce(series, 0))", series=[1, None]), 1)
        self.assertEqual(self.calculate("series / 2", series=[4, None]), [2, None])
        # Multiplication scales a vector; the underlying Python list
        # repetition operator is never invoked.
        self.assertEqual(self.calculate("[0] * 1000 + [1]"), [1])

    def test_rejects_non_arithmetic_syntax(self):
        for text in ('import math\n1', 'value = "chart.txt"\nvalue', 'open("chart.txt")',
                     'print(1)', 'series[0]', 'series.count(1)', 'series.__class__', 'lambda x: x',
                     '[x for x in series]', 'for i in series:\n    i\n1',
                     'try:\n    1\nexcept:\n    2\n1', 'if series:\n    1\n1',
                     'sum(series=series)', 'sum(*series)', '(assigned := 1)', '1 ** 9',
                     'series = 2\nseries', 'sum = 2\nsum', 'value = other = 2\nvalue',
                     'value = 1\nvalue = 2\nvalue', 'value = 1', '变量 = 2\n变量'):
            with self.subTest(text=text):
                self.rejects(text, series=[1, 2])

    def test_bounded_length_and_value_failures(self):
        self.rejects("series + other", "FORMULA_LENGTH_MISMATCH", series=[1], other=[1, 2])
        self.rejects("series / 0", "FORMULA_DIVISION_BY_ZERO", series=[1])
        self.rejects("1_000_000_000 + 1", "FORMULA_NUMBER_LIMIT")
        self.rejects("series", "FORMULA_SERIES_LIMIT", series=[0] * (COMPUTE.MAX_POINTS + 1))
        self.rejects("series", "FORMULA_NUMBER_LIMIT", series=[True])
        self.rejects("series", "FORMULA_NUMBER_LIMIT", series=[[1]])
        self.rejects("series", "FORMULA_NUMBER_LIMIT", series=[float("inf")])
        self.rejects("1+" * 120 + "1", "FORMULA_AST_LIMIT")
        self.rejects("x+" * 60 + "x", "FORMULA_OPERATION_LIMIT", x=[1] * 180)
        self.rejects(" " * COMPUTE.SCRIPT_BYTES + "1")
        self.rejects("coalesce()", None)
        self.rejects("sum(1)", None)
        with self.assertRaises(COMPUTE.FormulaError):
            COMPUTE.compute({"script": "1", "inputs": {}, "path": "/other"})

    def test_cli_json_only_and_failure_never_exposes_script(self):
        child = self.run_cli({"script": "avg(values)", "inputs": {"values": [0, None, 6]}})
        self.assertEqual((child.returncode, json.loads(child.stdout), child.stderr), (0, {"value": 3}, b""))
        for raw, expected in (
                (b'{"script":"1","inputs":{},"inputs":{}}', "FORMULA_INVALID"),
                (b'{"script":"1","inputs":{"series":[NaN]}}', "FORMULA_NUMBER_LIMIT"),
                (b'{"script":"1","inputs":{"series":[1e999]}}', "FORMULA_NUMBER_LIMIT"),
                (b'\xff', "FORMULA_INVALID"),
                (b' ' * (COMPUTE.REQUEST_BYTES + 1), "FORMULA_REQUEST_LIMIT"),
                (b'{"script":"do_not_echo()","inputs":{}}', "FORMULA_INVALID"),
        ):
            with self.subTest(expected=expected):
                child = self.run_cli(raw)
                self.assertEqual((child.returncode, json.loads(child.stdout), child.stderr),
                                 (2, {"error": expected}, b""))


if __name__ == "__main__":
    unittest.main()
