"""Optional stdlib checks: python3 -B -m unittest test/test_financial_chart_producer.py."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/financial-chart-producer.py"
SPEC = importlib.util.spec_from_file_location("financial_chart_producer", SCRIPT)
CHART = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHART)


class FinancialChartProducerTests(unittest.TestCase):
    def test_csv_preserves_unicode_units_series_order_and_missing_values(self):
        chart = CHART.dataset_from_csv(
            io.StringIO('期间,率,汇率,说明\n二季度,,"1,234.50",abc\n三季度,-0,.75,def\n'),
            kind="financial-columns", as_of="2025-09-30", unit="CNY million",
            key_column="期间", value_columns=["汇率", "率"],
        )
        self.assertEqual(chart, {
            "kind": "financial-columns", "asOf": "2025-09-30", "unit": "CNY million",
            "keys": ["二季度", "三季度"],
            "series": [{"label": "汇率", "values": [1234.5, .75]}, {"label": "率", "values": [None, 0]}],
        })

    def test_csv_rejects_malformed_data_and_inferred_values(self):
        for text in ("key,val,val\nA,1,2", "key,val\nA,1,2", "key,val\nA,1\nA,2",
                     "key,val\nA,+inf", 'key,val\nA,"1,23"', "key,val\nA,4%",
                     "key,val\nA,1e-999", 'key,val\nA,"1,000,000,000.0000000000000000000001"',
                     "key,val\nA,", "key,val\nA,abc", 'key,val\nA,"1'):
            with self.subTest(text=text), self.assertRaises((ValueError, CHART.csv.Error)):
                CHART.dataset_from_csv(io.StringIO(text), kind="financial-columns", as_of="2025-09-30",
                                       unit="count", key_column="key", value_columns=["val"])

    def test_caller_rows_fail_closed_for_incomparable_dimensions(self):
        args = {"kind": "financial-trend", "as_of": "2024-02-29", "unit": "%"}
        invalid = [
            (["2024-02-30"], [{"label": "A", "values": [1]}]),
            (["2024-03-01"], [{"label": "A", "values": [1]}]),
            (["2024-02-29", "2024-02-28"], [{"label": "A", "values": [1, 2]}]),
            (["2024-02-29"], [{"label": "A", "values": [True]}]),
            (["2024-02-29"], [{"label": "A", "values": [None]}]),
            (["2024-02-29"], [{"label": "A", "values": [float("nan")]}]),
            (["2024-02-29"], [{"label": "A", "values": [float("inf")]}]),
            (["2024-02-29"], [{"label": "A\u202e", "values": [1]}]),
            (["2024-02-29"], [{"label": "财" * 41, "values": [1]}]),
            (["2024-02-29"], [{"label": "A", "values": [1]}, {"label": "A", "values": [2]}]),
            (["2024-02-29"], [{"label": "A", "values": [1, 2]}]),
        ]
        for keys, series in invalid:
            with self.subTest(keys=keys, series=series), self.assertRaises(ValueError):
                CHART.prepare_dataset(**args, keys=keys, series=series)

    def test_pie_does_not_infer_missing_denominator_or_values(self):
        spec = {"kind": "financial-share", "as_of": "2025-09-30", "unit": "%", "keys": ["A", "B"]}
        self.assertEqual(CHART.prepare_dataset(**spec, series=[{"label": "Share", "values": [75, None]}])
                         ["series"][0]["values"], [75, None])
        for values in ([100, None], [0, None], [55, 46], [25, -1]):
            with self.subTest(values=values), self.assertRaises(ValueError):
                CHART.prepare_dataset(**spec, series=[{"label": "Share", "values": values}])

    def test_ohlc_must_be_complete_or_missing(self):
        args = {"kind": "financial-ohlc", "as_of": "2025-09-30", "unit": "CNY/share",
                "key_column": "day", "value_columns": ["O", "H", "L", "C"], "ohlc_label": "股价"}
        chart = CHART.dataset_from_csv(io.StringIO("day,O,H,L,C\n2025-09-28,9,12,8,10\n2025-09-29,,,,"), **args)
        self.assertEqual(chart["series"][0], {"label": "股价", "values": [
            {"open": 9, "high": 12, "low": 8, "close": 10}, None]})
        for row in ("9,,8,10", "9,9,8,10", "9,12,0,10"):
            with self.subTest(row=row), self.assertRaises(ValueError):
                CHART.dataset_from_csv(io.StringIO("day,O,H,L,C\n2025-09-28," + row), **args)

    def test_cli_supports_utf8_bom_and_optional_fence(self):
        command = [sys.executable, "-B", str(SCRIPT), "-", "--kind", "financial-columns",
                   "--as-of", "2025-09-30", "--unit", "count", "--key-column", "季度",
                   "--value-column", "销量", "--fenced"]
        result = subprocess.run(command, input="季度,销量\r\n三季度,100\r\n".encode("utf-8-sig"),
                                capture_output=True, timeout=5, check=True)
        header, payload, end = result.stdout.decode("utf-8").splitlines()
        self.assertEqual((header, end), ("```financial-chart-data", "```"))
        self.assertEqual(json.loads(payload)["series"], [{"label": "销量", "values": [100]}])
        invalid = subprocess.run(command, input=b"x" * (CHART.CSV_LIMIT + 1), capture_output=True, timeout=5)
        self.assertEqual(invalid.returncode, 2)
        self.assertEqual(invalid.stdout, b"")


if __name__ == "__main__":
    unittest.main()
