#!/usr/bin/env python3
"""Prepare chart dataset JSON from explicitly selected local CSV columns."""
import argparse
import csv
from datetime import date
from decimal import Decimal
import io
import json
import math
import re
import sys
import unicodedata

MONEY = {code + scale for code in ("CNY", "HKD", "USD") for scale in ("", " million", " billion")}
COMMON = MONEY | {"%", "x", "count"}
SHARE_PRICE = {code + "/share" for code in ("CNY", "HKD", "USD")}
OHLC = ("open", "high", "low", "close")
# units, dated keys, bounds on points, bounds on series
PROFILES = {
    "financial-share": ({"%"}, False, (1, 24), (1, 1)),
    "financial-trend": (COMMON, True, (1, 180), (1, 4)),
    "financial-columns": (COMMON, False, (1, 24), (1, 4)),
    "financial-stacked": (MONEY | {"%", "count"}, False, (1, 24), (1, 4)),
    "financial-multi-line": (COMMON, True, (2, 180), (2, 4)),
    "financial-area": (COMMON, True, (2, 180), (1, 1)),
    "financial-combo": (COMMON, False, (2, 24), (2, 2)),
    "financial-ohlc": (SHARE_PRICE, True, (1, 180), (1, 1)),
    "financial-heatmap": (COMMON, False, (2, 12), (2, 12)),
}
CSV_LIMIT = 256 * 1024
NUMBER = re.compile(r"[+-]?(?:(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]{1,3})?")


def valid_label(value):
    if type(value) is not str or not value.strip() or any(unicodedata.category(ch).startswith("C") for ch in value):
        return False
    return len(value.encode("utf-8")) <= 120


def iso_day(value):
    if type(value) is not str or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("expected an ISO calendar date (YYYY-MM-DD)")
    return date.fromisoformat(value)


def numeric(value, *, minimum=-1e9, maximum=1e9):
    # bool is a subclass of int; the JS tool requires an actual number.
    if type(value) not in (int, float) or not minimum <= value <= maximum or not math.isfinite(value):
        raise ValueError("chart value is not a finite in-range number")
    return 0 if value == 0 else value


def normalize_value(value, kind):
    if value is None:
        return None
    if kind == "financial-ohlc":
        if type(value) is not dict or set(value) != set(OHLC):
            raise ValueError("OHLC requires exactly open, high, low, close")
        point = {k: numeric(value[k], minimum=0) for k in OHLC}
        low, high = point["low"], point["high"]
        if not 0 < low <= min(point["open"], point["close"]) <= max(point["open"], point["close"]) <= high:
            raise ValueError("OHLC range must enclose open and close and have positive prices")
        return point
    return numeric(value, minimum=0, maximum=100) if kind == "financial-share" else numeric(value)


def prepare_dataset(*, kind, as_of, unit, keys, series):
    """Validate trusted caller-calculated rows; return a fresh JSON-ready object.

    Each series is {"label": str, "values": [number | None | OHLC]}. No source
    authenticity, unit conversion, arbitrary computation, or execution here.
    """
    if type(kind) is not str or kind not in PROFILES:
        raise ValueError("unknown chart kind")
    units, dated, points, count = PROFILES[kind]
    if type(unit) is not str or unit not in units:
        raise ValueError("unit not supported for this chart kind")
    end = iso_day(as_of)
    if not isinstance(keys, (list, tuple)) or not points[0] <= len(keys) <= points[1]:
        raise ValueError("invalid number of chart keys")
    if not all(valid_label(key) for key in keys) or len(set(keys)) != len(keys):
        raise ValueError("chart keys must have unique, nonempty labels")
    if dated:
        dates = [iso_day(key) for key in keys]
        if dates != sorted(dates) or dates[-1] > end:
            raise ValueError("dated keys must increase and cannot exceed as-of")
    if not isinstance(series, (list, tuple)) or not count[0] <= len(series) <= count[1]:
        raise ValueError("invalid number of chart series")
    normalized = []
    for row in series:
        if type(row) is not dict or set(row) != {"label", "values"} or not valid_label(row["label"]):
            raise ValueError("expected a series label and values")
        raw = row["values"]
        if not isinstance(raw, (list, tuple)) or len(raw) != len(keys):
            raise ValueError("each series must align to all chart keys")
        values = [normalize_value(value, kind) for value in raw]
        if all(value is None for value in values):
            raise ValueError("each series needs at least one observation")
        normalized.append({"label": row["label"], "values": values})
    if len({row["label"] for row in normalized}) != len(normalized):
        raise ValueError("series labels must be unique")
    if kind == "financial-share":
        values = normalized[0]["values"]
        total = sum((float(value) for value in values if value is not None), 0.0)
        if not 0 < total <= 100 + 1e-9 or (None in values and total >= 100 - 1e-9):
            raise ValueError("invalid pie coverage for a single 100% denominator")
    return {"kind": kind, "asOf": as_of, "unit": unit, "keys": list(keys), "series": normalized}


def csv_number(cell):
    cell = cell.strip()
    if not cell:
        return None
    if len(cell) > 80 or not NUMBER.fullmatch(cell):
        raise ValueError("expected a decimal cell or an empty cell")
    exact = Decimal(cell.replace(",", ""))
    value = float(exact)
    if not math.isfinite(value) or value == 0 and exact != 0:
        raise ValueError("decimal is outside the supported numeric representation")
    # Prevent rounding to a legal bound from admitting an out-of-range input.
    if exact.copy_abs() > 1_000_000_000:
        raise ValueError("decimal exceeds the supported range")
    return value


def dataset_from_csv(stream, *, kind, as_of, unit, key_column, value_columns,
                     ohlc_label=None):
    """Read selected columns only; retain source row and series order."""
    if type(kind) is not str or kind not in PROFILES:
        raise ValueError("unknown chart kind")
    if not isinstance(value_columns, (list, tuple)) or not value_columns:
        raise ValueError("select one or more value columns")
    if kind == "financial-ohlc":
        if len(value_columns) != len(OHLC) or not valid_label(ohlc_label):
            raise ValueError("OHLC requires four columns in open/high/low/close order and one label")
    elif ohlc_label is not None:
        raise ValueError("OHLC label can only be used with financial-ohlc")
    selected = [key_column, *value_columns]
    if not all(valid_label(name) for name in selected) or len(set(selected)) != len(selected):
        raise ValueError("column selections must be distinct, nonempty names")
    reader = csv.reader(stream, strict=True)
    header = next(reader, [])
    if len(set(header)) != len(header) or not all(name in header for name in selected):
        raise ValueError("CSV must have unique headers and all selected columns")
    indices = [header.index(name) for name in selected]
    keys, columns = [], [[] for _ in value_columns]
    max_points = PROFILES[kind][2][1]
    for position, row in enumerate(reader, 2):
        if len(row) != len(header):
            raise ValueError(f"CSV record {position} has the wrong number of cells")
        if len(keys) >= max_points:
            raise ValueError("CSV exceeds this chart's point limit")
        keys.append(row[indices[0]])
        try:
            for idx, column in zip(indices[1:], columns):
                column.append(csv_number(row[idx]))
        except ValueError as error:
            raise ValueError(f"CSV record {position}: {error}") from error
    if kind == "financial-ohlc":
        observations = []
        for values in zip(*columns):
            if all(value is None for value in values):
                observations.append(None)
            elif any(value is None for value in values):
                raise ValueError("each OHLC record must be complete or fully empty")
            else:
                observations.append(dict(zip(OHLC, values)))
        series = [{"label": ohlc_label, "values": observations}]
    else:
        series = [{"label": label, "values": values} for label, values in zip(value_columns, columns)]
    return prepare_dataset(kind=kind, as_of=as_of, unit=unit, keys=keys, series=series)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", help="local UTF-8 CSV file, or - for stdin")
    parser.add_argument("--kind", required=True, choices=PROFILES)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--unit", required=True)
    parser.add_argument("--key-column", required=True)
    parser.add_argument("--value-column", required=True, action="append",
                        help="repeat to select multiple series; for OHLC use open/high/low/close order")
    parser.add_argument("--ohlc-label")
    parser.add_argument("--fenced", action="store_true", help="wrap JSON in an owner chart-data code block")
    args = parser.parse_args(argv)
    try:
        if args.csv == "-":
            data = sys.stdin.buffer.read(CSV_LIMIT + 1)
        else:
            with open(args.csv, "rb") as stream:
                data = stream.read(CSV_LIMIT + 1)
        if len(data) > CSV_LIMIT:
            raise ValueError("CSV input exceeds 256 KiB")
        result = dataset_from_csv(
            io.StringIO(data.decode("utf-8-sig"), newline=""), kind=args.kind, as_of=args.as_of,
            unit=args.unit, key_column=args.key_column, value_columns=args.value_column,
            ohlc_label=args.ohlc_label,
        )
        output = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        if args.fenced:
            output = "```financial-chart-data\n" + output + "\n```"
            if len(output.encode("utf-8")) >= 12000:
                raise ValueError("fenced chart data exceeds owner-message byte capacity")
        sys.stdout.buffer.write((output + "\n").encode("utf-8"))
    except (UnicodeError, OSError, ValueError, csv.Error) as error:
        parser.exit(2, f"{parser.prog}: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
