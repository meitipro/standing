"""
Checks over the parsed contract source.

A behaviour test covers the methods somebody thought to test. These cover the
ones nobody has written yet: a write added later cannot skip its sender check,
a prompt cannot gain an unfenced parameter, and a storage class cannot grow a
collection, without one of these failing in the same diff.
"""

from __future__ import annotations

import ast
import builtins
import pathlib
import re
import symtable
import unittest

SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "standing.py"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)
CLASS = next(n for n in TREE.body if isinstance(n, ast.ClassDef) and n.name == "Standing")
METHODS = {n.name: n for n in CLASS.body if isinstance(n, ast.FunctionDef)}
MODULE_FUNCTIONS = {n.name: n for n in TREE.body if isinstance(n, ast.FunctionDef)}
STORAGE_CLASSES = {
    n.name: n
    for n in TREE.body
    if isinstance(n, ast.ClassDef) and any(ast.unparse(d) == "allow_storage" for d in n.decorator_list)
}
CONSTANTS = {
    t.id: n.value
    for n in TREE.body
    if isinstance(n, ast.Assign)
    for t in n.targets
    if isinstance(t, ast.Name)
}


def decorators(fn: ast.FunctionDef) -> set:
    return {ast.unparse(d) for d in fn.decorator_list}


WRITES = {n: f for n, f in METHODS.items() if decorators(f) & {"gl.public.write", "gl.public.write.payable"}}
VIEWS = {n: f for n, f in METHODS.items() if "gl.public.view" in decorators(f)}

#: Writes any account may call, each with the reason it is safe to leave open.
#: A write missing from here must check who is asking. Tightening one of these
#: means arguing with its reason here, in a diff, rather than deleting a comment.
OPEN = {
    "notarize": (
        "Anyone may pay to certify a public page. The payer is stored on the "
        "certificate as its requester, and the fee is the only gate a public "
        "notary should have."
    ),
    "notarize_contracts": (
        "The same for other contracts' zero-argument views. The reads are "
        "deterministic and the payer is stored as the requester."
    ),
    "watch": (
        "Anyone may open a watch they pay for. The sender becomes its owner, "
        "and every later change to it is bound to that owner."
    ),
    "assess": (
        "Anyone may pay to put one question about two public records. The "
        "question is filed by its content, so it can be put once, and asking "
        "again from another pair cannot shop for a different answer."
    ),
    "capture_watch": (
        "The keeper. The owner has already paid, the contract fixes when a "
        "capture is due, and the caller chooses nothing but the moment within "
        "the due window. Binding it to one address would let the schedule die "
        "with that address."
    ),
}

PROMPT_BUILDERS = ("_extract_prompt", "_verify_prompt", "_assess_prompt")
FENCES = {"_fence", "_numbered"}
CLOSURES = {"leader_fn", "validator_fn"}
STAR_IMPORT = {"gl", "Address", "u256", "DynArray", "TreeMap", "allow_storage"}


def nodes_in(tree: ast.AST, kind) -> list:
    return [n for n in ast.walk(tree) if isinstance(n, kind)]


def compares_sender(fn: ast.AST) -> bool:
    return any("gl.message.sender_address" in ast.unparse(c) for c in nodes_in(fn, ast.Compare))


def calls(fn: ast.AST, name: str) -> bool:
    return any(ast.unparse(c.func) == name for c in nodes_in(fn, ast.Call))


def with_stacks(tree: ast.AST):
    """Every node, with the names of the functions it sits inside, outermost first."""
    out = []

    def visit(node, stack):
        out.append((node, stack))
        inner = stack + [node.name] if isinstance(node, ast.FunctionDef) else stack
        for child in ast.iter_child_nodes(node):
            visit(child, inner)

    visit(tree, [])
    return out


class Authority(unittest.TestCase):
    def test_every_write_checks_the_sender_or_is_named_with_a_reason(self):
        self.assertTrue(set(OPEN) <= set(WRITES), "the open list names a write that no longer exists")
        for name, fn in WRITES.items():
            bound = compares_sender(fn) or calls(fn, "self._require_owner")
            if name in OPEN:
                self.assertFalse(bound, f"{name} checks its sender now; take it off the open list")
            else:
                self.assertTrue(bound, f"{name} writes without checking who is asking")

    def test_the_owner_check_compares_against_the_owner(self):
        self.assertIn("gl.message.sender_address != self.owner", ast.unparse(METHODS["_require_owner"]))

    def test_every_open_write_records_who_called_it(self):
        self.assertIn("requester=gl.message.sender_address", ast.unparse(METHODS["_record"]))
        self.assertIn("requester=gl.message.sender_address", ast.unparse(METHODS["assess"]))
        self.assertIn("owner=gl.message.sender_address", ast.unparse(METHODS["watch"]))
        for name in OPEN:
            fn = WRITES[name]
            self.assertTrue(
                "gl.message.sender_address" in ast.unparse(fn) or calls(fn, "self._record"),
                f"{name} stores nothing about who called it",
            )


class Prompts(unittest.TestCase):
    def test_every_interpolated_value_is_fenced_or_a_constant(self):
        for name in PROMPT_BUILDERS:
            fn = MODULE_FUNCTIONS[name]
            for value in nodes_in(fn, ast.FormattedValue):
                inner = value.value
                if isinstance(inner, ast.Call) and isinstance(inner.func, ast.Name) and inner.func.id in FENCES:
                    continue
                if isinstance(inner, ast.Name) and re.fullmatch(r"[A-Z_]+", inner.id) and inner.id in CONSTANTS:
                    continue
                self.fail(f"{name} interpolates {ast.unparse(inner)}, which is neither fenced nor a constant")

    def test_prompts_are_built_only_from_literals_and_fstrings(self):
        for name in PROMPT_BUILDERS:
            fn = MODULE_FUNCTIONS[name]
            for op in nodes_in(fn, ast.BinOp):
                sides = (op.left, op.right)
                stringy = any(isinstance(s, (ast.JoinedStr, ast.Constant)) and isinstance(getattr(s, "value", ""), str) for s in sides)
                self.assertFalse(stringy and isinstance(op.op, (ast.Add, ast.Mod)), f"{name} concatenates a string")
            self.assertFalse(any(isinstance(c.func, ast.Attribute) and c.func.attr == "format" for c in nodes_in(fn, ast.Call)))

    def test_numbered_lines_pass_through_the_fence(self):
        self.assertTrue(calls(MODULE_FUNCTIONS["_numbered"], "_fence"))

    def test_the_model_is_only_ever_handed_a_built_prompt(self):
        prompts = [c for c in nodes_in(TREE, ast.Call) if ast.unparse(c.func) == "gl.nondet.exec_prompt"]
        self.assertTrue(prompts)
        for call in prompts:
            first = call.args[0]
            self.assertTrue(
                isinstance(first, ast.Call) and isinstance(first.func, ast.Name) and first.func.id in PROMPT_BUILDERS,
                f"exec_prompt handed {ast.unparse(first)}",
            )


class Runtime(unittest.TestCase):
    def test_no_storage_dataclass_holds_a_collection(self):
        self.assertEqual(set(STORAGE_CLASSES), {"Cert", "Watch", "Assessment"})
        for name, cls in STORAGE_CLASSES.items():
            for field in nodes_in(cls, ast.AnnAssign):
                kind = ast.unparse(field.annotation)
                self.assertIn(kind, {"str", "bool", "u256", "Address"}, f"{name}.{ast.unparse(field.target)} is {kind}")

    def test_the_contract_declares_only_storage_types(self):
        allowed = r"str|bool|u256|Address|DynArray\[(str|u256|Cert|Watch|Assessment)\]|TreeMap\[str, u256\]"
        for field in (n for n in CLASS.body if isinstance(n, ast.AnnAssign)):
            self.assertRegex(ast.unparse(field.annotation), f"^({allowed})$")

    def test_every_field_written_is_declared(self):
        declared = {ast.unparse(n.target) for n in CLASS.body if isinstance(n, ast.AnnAssign)}
        fields = {ast.unparse(f.target) for cls in STORAGE_CLASSES.values() for f in nodes_in(cls, ast.AnnAssign)}
        for fn in METHODS.values():
            for store in nodes_in(fn, ast.Attribute):
                if not isinstance(store.ctx, ast.Store):
                    continue
                owner = ast.unparse(store.value)
                if owner == "self":
                    self.assertIn(store.attr, declared, f"self.{store.attr} is not declared, so it would be discarded")
                else:
                    self.assertIn(store.attr, fields, f"{owner}.{store.attr} is not a storage field")

    def test_nondet_calls_sit_inside_the_consensus_closures(self):
        stacks = with_stacks(TREE)
        helpers = set()
        for node, stack in stacks:
            if isinstance(node, ast.Call) and ast.unparse(node.func).startswith("gl.nondet."):
                if CLOSURES & set(stack):
                    continue
                self.assertEqual(len(stack), 1, f"gl.nondet in {stack}")
                helpers.add(stack[0])
        self.assertEqual(helpers, {"_read_page", "_extract"})
        for node, stack in stacks:
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in helpers:
                self.assertTrue(CLOSURES & set(stack), f"{node.func.id} called from {stack}")

    def test_no_block_nests_inside_another(self):
        for node, stack in with_stacks(TREE):
            if isinstance(node, ast.Call) and ast.unparse(node.func) == "gl.vm.run_nondet":
                self.assertFalse(CLOSURES & set(stack))

    def test_validators_read_for_themselves_before_judging_the_leader(self):
        firsts = {}
        for method in ("_capture", "_judge"):
            closure = next(n for n in nodes_in(METHODS[method], ast.FunctionDef) if n.name == "validator_fn")
            firsts[method] = ast.unparse(closure.body[0].value.func)
        self.assertEqual(firsts, {"_capture": "_read_page", "_judge": "leader_fn"})

    def test_the_only_clock_is_the_transaction_datetime(self):
        clocks = {"now", "utcnow", "today", "time", "monotonic", "perf_counter"}
        for call in nodes_in(TREE, ast.Call):
            if isinstance(call.func, ast.Attribute):
                self.assertNotIn(call.func.attr, clocks, ast.unparse(call))
        self.assertNotIn("import time", SOURCE)
        for node, stack in with_stacks(TREE):
            if isinstance(node, ast.Attribute) and ast.unparse(node) == "gl.message_raw":
                self.assertEqual(stack[-1], "_now")

    def test_nothing_is_compared_by_identity(self):
        for compare in nodes_in(TREE, ast.Compare):
            for op, right in zip(compare.ops, compare.comparators):
                if isinstance(op, (ast.Is, ast.IsNot)):
                    self.assertIsInstance(right, ast.Constant, ast.unparse(compare))

    def test_every_refusal_is_a_named_constant(self):
        for call in nodes_in(TREE, ast.Call):
            if ast.unparse(call.func) != "gl.vm.UserError":
                continue
            self.assertEqual(len(call.args), 1)
            arg = call.args[0]
            self.assertIsInstance(arg, ast.Name, ast.unparse(call))
            self.assertTrue(arg.id.startswith("R_"))
            self.assertIsInstance(CONSTANTS[arg.id], ast.Constant)

    def test_every_view_returns_sorted_json_or_null(self):
        self.assertTrue(VIEWS)
        for name, fn in VIEWS.items():
            for ret in nodes_in(fn, ast.Return):
                value = ret.value
                if isinstance(value, ast.Constant) and value.value == "null":
                    continue
                self.assertEqual(ast.unparse(value.func), "json.dumps", name)
                keywords = {k.arg: ast.unparse(k.value) for k in value.keywords}
                self.assertEqual(keywords.get("sort_keys"), "True", name)

    def test_every_name_a_function_reads_is_bound(self):
        top = symtable.symtable(SOURCE, str(SOURCE_PATH), "exec")
        bound = {s.get_name() for s in top.get_symbols() if s.is_assigned() or s.is_imported()}
        bound |= STAR_IMPORT | set(dir(builtins))

        def walk(table):
            for child in table.get_children():
                yield child
                yield from walk(child)

        unbound = []
        for table in walk(top):
            if table.get_type() != "function":
                continue
            for sym in table.get_symbols():
                if sym.is_referenced() and sym.is_global() and sym.get_name() not in bound:
                    unbound.append(f"{table.get_name()}: {sym.get_name()}")
        self.assertEqual(unbound, [])


if __name__ == "__main__":
    unittest.main()
