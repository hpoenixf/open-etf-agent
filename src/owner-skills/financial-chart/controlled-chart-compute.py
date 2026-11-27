#!/usr/bin/env python3
"""Interpret a bounded numeric formula subset; never execute the parsed program."""
import ast
import json
import math
import re
import sys

REQUEST_BYTES = 64 * 1024
SCRIPT_BYTES = 4096
AST_NODES = 256
MAX_INPUTS = 12
MAX_BINDINGS = 8
MAX_POINTS = 180
MAX_OPS = 6000
MAX_VALUE = 1_000_000_000
SAFE_NAME = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,31}")
FUNCTIONS = {"sum", "avg", "pct", "growth", "coalesce"}
# Exact positive list. No implicit generic Python evaluation is used.
ALLOWED_NODES = (
    ast.Module, ast.Assign, ast.Expr, ast.Name, ast.Load, ast.Store, ast.Constant,
    ast.List, ast.UnaryOp, ast.BinOp, ast.UAdd, ast.USub, ast.Add, ast.Sub,
    ast.Mult, ast.Div, ast.Call,
)


class FormulaError(ValueError):
    def __init__(self, code="FORMULA_INVALID"):
        super().__init__(code)
        self.code = code


def checked_scalar(value):
    if value is None:
        return None
    # Reject bool and complex, and bound huge integer literals before float conversion.
    if type(value) not in (int, float) or not -MAX_VALUE <= value <= MAX_VALUE or not math.isfinite(value):
        raise FormulaError("FORMULA_NUMBER_LIMIT")
    return 0 if value == 0 else value


def checked_value(value):
    if type(value) is list:
        if not 1 <= len(value) <= MAX_POINTS:
            raise FormulaError("FORMULA_SERIES_LIMIT")
        return [checked_scalar(item) for item in value]
    return checked_scalar(value)


def valid_name(value):
    return type(value) is str and SAFE_NAME.fullmatch(value) and value not in FUNCTIONS


def advance_budget(tree):
    # Stop checking on the first rejected node. Depth is bounded by node count;
    # parsing is separately byte-bounded, not delegated to a user program.
    for count, node in enumerate(ast.walk(tree), 1):
        if count > AST_NODES:
            raise FormulaError("FORMULA_AST_LIMIT")
        if type(node) not in ALLOWED_NODES:
            raise FormulaError()


class Interpreter:
    def __init__(self, inputs):
        self.env = inputs
        self.remaining = MAX_OPS

    def charge(self, amount=1):
        self.remaining -= amount
        if self.remaining < 0:
            raise FormulaError("FORMULA_OPERATION_LIMIT")

    def operands(self, operation, first, second):
        left_series, right_series = type(first) is list, type(second) is list
        if not left_series and not right_series:
            self.charge()
            return checked_scalar(operation(first, second))
        count = len(first if left_series else second)
        if left_series and right_series and len(second) != count:
            raise FormulaError("FORMULA_LENGTH_MISMATCH")
        self.charge(count)
        return [
            checked_scalar(operation(first[index] if left_series else first,
                                     second[index] if right_series else second))
            for index in range(count)
        ]

    def expression(self, node):
        self.charge()
        kind = type(node)
        if kind is ast.Constant:
            return checked_scalar(node.value)
        if kind is ast.Name and valid_name(node.id) and node.id in self.env:
            return self.env[node.id]
        if kind is ast.List:
            if not 1 <= len(node.elts) <= MAX_POINTS:
                raise FormulaError("FORMULA_SERIES_LIMIT")
            self.charge(len(node.elts))
            return [checked_scalar(self.expression(item)) for item in node.elts]
        if kind is ast.UnaryOp:
            factor = {ast.UAdd: 1, ast.USub: -1}.get(type(node.op))
            if factor is None:
                raise FormulaError()
            return self.operands(lambda value, _ignored: None if value is None else value * factor,
                                 self.expression(node.operand), None)
        if kind is ast.BinOp:
            def operation(left, right):
                if left is None or right is None:
                    return None
                op = type(node.op)
                if op is ast.Add:
                    return left + right
                if op is ast.Sub:
                    return left - right
                if op is ast.Mult:
                    return left * right
                if op is ast.Div:
                    if right == 0:
                        raise FormulaError("FORMULA_DIVISION_BY_ZERO")
                    return left / right
                raise FormulaError()

            return self.operands(operation, self.expression(node.left), self.expression(node.right))
        if kind is ast.Call and type(node.func) is ast.Name and node.func.id in FUNCTIONS and not node.keywords:
            return self.call(node.func.id, node.args)
        raise FormulaError()

    def call(self, name, expressions):
        argc = len(expressions)
        if name in {"sum", "avg"} and argc == 1:
            values = self.expression(expressions[0])
            if type(values) is not list:
                raise FormulaError()
            self.charge(len(values))
            known = [item for item in values if item is not None]
            if not known:
                return None
            total = math.fsum(known)
            return checked_scalar(total if name == "sum" else total / len(known))
        if name == "growth" and argc == 1:
            series = self.expression(expressions[0])
            if type(series) is not list:
                raise FormulaError()
            # Only consecutive observations: never skip a missing denominator.
            return self.operands(growth, series, [None, *series[:-1]])
        if name in {"pct", "growth", "coalesce"} and argc == 2:
            operation = {"pct": percentage, "growth": growth, "coalesce": coalesce}[name]
            return self.operands(operation, self.expression(expressions[0]), self.expression(expressions[1]))
        raise FormulaError()

    def program(self, tree):
        if not 1 <= len(tree.body) <= MAX_BINDINGS + 1 or type(tree.body[-1]) is not ast.Expr:
            raise FormulaError()
        for statement in tree.body[:-1]:
            if type(statement) is not ast.Assign or len(statement.targets) != 1:
                raise FormulaError()
            target = statement.targets[0]
            if type(target) is not ast.Name or not valid_name(target.id) or target.id in self.env:
                raise FormulaError()
            self.env[target.id] = self.expression(statement.value)
        return self.expression(tree.body[-1].value)


def percentage(numerator, denominator):
    return None if numerator is None or denominator is None or denominator == 0 else numerator / denominator * 100


def growth(current, prior):
    return None if current is None or prior is None or prior == 0 else (current - prior) / prior * 100


def coalesce(primary, fallback):
    return fallback if primary is None else primary


def compute(request):
    """Return a plain number, numeric list or null; no provenance assertions."""
    if type(request) is not dict or set(request) != {"script", "inputs"}:
        raise FormulaError()
    script, inputs = request["script"], request["inputs"]
    if (type(script) is not str or not script.isascii() or not script.strip()
            or "\x00" in script or len(script) > SCRIPT_BYTES):
        raise FormulaError()
    if type(inputs) is not dict or len(inputs) > MAX_INPUTS or not all(valid_name(key) for key in inputs):
        raise FormulaError()
    env = {key: checked_value(value) for key, value in inputs.items()}
    try:
        tree = ast.parse(script, filename="<chart-formula>")
    except (SyntaxError, RecursionError, ValueError):
        raise FormulaError() from None
    advance_budget(tree)
    return Interpreter(env).program(tree)


def no_duplicate_keys(pairs):
    seen = {}
    for key, value in pairs:
        if key in seen:
            raise FormulaError()
        seen[key] = value
    return seen


def invalid_constant(_name):
    raise FormulaError("FORMULA_NUMBER_LIMIT")


def main():
    try:
        data = sys.stdin.buffer.read(REQUEST_BYTES + 1)
        if len(data) > REQUEST_BYTES:
            raise FormulaError("FORMULA_REQUEST_LIMIT")
        request = json.loads(data.decode("utf-8"), object_pairs_hook=no_duplicate_keys,
                             parse_constant=invalid_constant)
        result = {"value": compute(request)}
        exit_code = 0
    except FormulaError as error:
        result, exit_code = {"error": error.code}, 2
    except (UnicodeError, ValueError, OverflowError, RecursionError):
        result, exit_code = {"error": "FORMULA_INVALID"}, 2
    sys.stdout.write(json.dumps(result, allow_nan=False, separators=(",", ":")) + "\n")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
