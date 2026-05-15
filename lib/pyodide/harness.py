"""Test harness executed inside Pyodide.

Loads the user's solution module, instantiates `Solution`, calls
`<method_name>(**case["input"])`, compares to `case["expected"]`,
captures stdout and exceptions per case.

Auto-converts LeetCode-style serialized inputs/outputs:
- For inputs, when the param name conventionally holds a linked-list head
  (`head`, `l1`, `l2`, ...) or a tree root (`root`, `subRoot`, `p`, `q`),
  the array value is converted to a `ListNode` chain or `TreeNode` tree.
- For outputs, `ListNode` returns are serialized back to a list and
  `TreeNode` returns to a level-order array (with `None` for missing).

The user's code namespace is pre-populated with `ListNode`, `TreeNode`,
common typing imports, and helpers, so starter code referencing
`Optional[ListNode]` parses without further imports.
"""

import io
import inspect
import json
import sys
import time
import traceback
import types
import math
import bisect
import heapq
from collections import Counter, defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple, Union


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


# Names that conventionally hold a linked-list head/tree root in LeetCode
# problem signatures. Used to auto-deserialize array-shaped test inputs.
_LIST_INPUT_NAMES = {"head", "head1", "head2", "l1", "l2", "list1", "list2"}
_TREE_INPUT_NAMES = {"root", "root1", "root2", "p", "q", "subRoot"}


def _to_list_node(arr):
    if arr is None:
        return None
    dummy = ListNode()
    cur = dummy
    for v in arr:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next


def _from_list_node(node):
    out = []
    while node is not None:
        out.append(node.val)
        node = node.next
    return out


def _to_tree_node(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    queue = deque([root])
    i = 1
    while queue and i < len(arr):
        node = queue.popleft()
        if i < len(arr):
            v = arr[i]
            i += 1
            if v is not None:
                node.left = TreeNode(v)
                queue.append(node.left)
        if i < len(arr):
            v = arr[i]
            i += 1
            if v is not None:
                node.right = TreeNode(v)
                queue.append(node.right)
    return root


def _from_tree_node(root):
    if root is None:
        return []
    out = []
    queue = deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            out.append(None)
        else:
            out.append(node.val)
            queue.append(node.left)
            queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out


def _convert_input(name, value):
    if value is None:
        return None
    if name == "lists" and isinstance(value, list):
        # merge-k-sorted-lists: List[Optional[ListNode]] serialized as List[List[int]].
        if all(v is None or isinstance(v, list) for v in value):
            return [_to_list_node(v) for v in value]
    if name in _LIST_INPUT_NAMES and isinstance(value, list):
        if all(not isinstance(v, list) for v in value):
            return _to_list_node(value)
    if name in _TREE_INPUT_NAMES and isinstance(value, list):
        return _to_tree_node(value)
    return value


def _convert_output(actual, expected=None):
    if isinstance(actual, ListNode):
        return _from_list_node(actual)
    if isinstance(actual, TreeNode):
        # Problems like Lowest Common Ancestor return a TreeNode but the
        # expected output is just the node's value.
        if isinstance(expected, (int, float, str)):
            return actual.val
        return _from_tree_node(actual)
    return actual


# Names made available inside the user's solution module namespace so that
# starter signatures referencing `Optional[ListNode]` etc. parse.
_USER_NS_INJECT = {
    "ListNode": ListNode,
    "TreeNode": TreeNode,
    "Any": Any,
    "Dict": Dict,
    "List": List,
    "Optional": Optional,
    "Set": Set,
    "Tuple": Tuple,
    "Union": Union,
    "Counter": Counter,
    "defaultdict": defaultdict,
    "deque": deque,
    "heapq": heapq,
    "math": math,
    "bisect": bisect,
}


def _canonical_unordered(value):
    # Recursively canonicalize a list-of-lists / list-of-strings into a sorted
    # tuple so unordered outputs can be compared. Returns None if the value
    # isn't a shape we want to compare order-independently.
    if not isinstance(value, list):
        return None
    if not value:
        return ()
    if all(isinstance(v, list) for v in value):
        inner = []
        for v in value:
            if not all(isinstance(x, (int, float, str, bool)) or x is None for x in v):
                return None
            inner.append(tuple(v))
        return tuple(sorted(inner, key=lambda t: (len(t), [repr(x) for x in t])))
    if all(isinstance(v, str) for v in value):
        return tuple(sorted(value))
    return None


def _equals_allowing_unordered(actual, expected):
    if actual == expected:
        return True
    a = _canonical_unordered(actual)
    e = _canonical_unordered(expected)
    if a is None or e is None:
        return False
    return a == e


def _run_one(solution, method_name, case):
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    start = time.perf_counter()
    try:
        method = getattr(solution, method_name)
        raw_input = case["input"]
        # `pos` is a LeetCode test-data convention for linked-list cycles:
        # it indicates the index the tail's `next` connects to. It is never
        # a function parameter, so consume it here to splice the cycle.
        pos = raw_input.get("pos") if isinstance(raw_input, dict) else None
        kwargs = {
            k: _convert_input(k, v) for k, v in raw_input.items() if k != "pos"
        }
        # LeetCode LCA-style problems: `p` and `q` are passed as scalar
        # values referencing nodes already present in `root`. Resolve them
        # to the actual TreeNode in the constructed tree.
        root_tree = kwargs.get("root") if isinstance(kwargs.get("root"), TreeNode) else None
        if root_tree is not None:
            node_by_val = {}
            stack = [root_tree]
            while stack:
                n = stack.pop()
                if n is None:
                    continue
                node_by_val[n.val] = n
                stack.append(n.left)
                stack.append(n.right)
            for key in ("p", "q"):
                if key in kwargs and not isinstance(kwargs[key], TreeNode):
                    v = kwargs[key]
                    if v in node_by_val:
                        kwargs[key] = node_by_val[v]
        if pos is not None and isinstance(pos, int) and pos >= 0:
            for list_key in _LIST_INPUT_NAMES:
                head = kwargs.get(list_key)
                if head is None or not isinstance(head, ListNode):
                    continue
                target = head
                for _ in range(pos):
                    if target.next is None:
                        break
                    target = target.next
                tail = head
                while tail.next is not None:
                    tail = tail.next
                tail.next = target
                break
        # If any input had a linked-list/tree-shaped name, we assume the
        # return value is the same kind. When the user method returns
        # `None` (in-place mutation problems like `reorderList`), serialize
        # the mutated input instead — this also covers empty-list cases
        # since `_from_list_node(None)` returns `[]`.
        list_key = next((k for k in raw_input if k in _LIST_INPUT_NAMES), None)
        tree_key = next((k for k in raw_input if k in _TREE_INPUT_NAMES), None)
        raw_actual = method(**kwargs)
        # Distinguish "method returns a new head/root" from "in-place mutation
        # returning None" via the return annotation. If the user's signature
        # promises a ListNode/TreeNode (or Optional thereof), trust their
        # explicit return — None then means an empty list/tree. Only fall back
        # to serializing the mutated input when the method is annotated to
        # return None, or has no annotation we can read.
        try:
            return_ann = inspect.signature(method).return_annotation
        except (TypeError, ValueError):
            return_ann = inspect.Signature.empty
        ann_str = "" if return_ann is inspect.Signature.empty else str(return_ann)
        returns_list_node = "ListNode" in ann_str
        returns_tree_node = "TreeNode" in ann_str
        if raw_actual is None and list_key is not None and not returns_list_node:
            actual = _from_list_node(kwargs[list_key])
        elif raw_actual is None and tree_key is not None and not returns_tree_node:
            actual = _from_tree_node(kwargs[tree_key])
        elif raw_actual is None and list_key is not None and returns_list_node:
            actual = []
        elif raw_actual is None and tree_key is not None and returns_tree_node:
            actual = []
        elif raw_actual is None and any(k == "lists" for k in raw_input):
            actual = []
        else:
            actual = _convert_output(raw_actual, case["expected"])
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        passed = _equals_allowing_unordered(actual, case["expected"])
        return {
            "passed": passed,
            "actual": actual,
            "expected": case["expected"],
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": None,
        }
    except Exception:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return {
            "passed": False,
            "actual": None,
            "expected": case["expected"],
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": traceback.format_exc(),
        }
    finally:
        sys.stdout = real_stdout


def run_tests(user_code: str, test_cases_json: str, method_name: str) -> str:
    """Entry point called from JS. Returns JSON string."""
    cases = json.loads(test_cases_json)
    mod = types.ModuleType("user_solution")
    mod.__dict__.update(_USER_NS_INJECT)
    try:
        exec(user_code, mod.__dict__)
    except Exception:
        return json.dumps({
            "compile_error": traceback.format_exc(),
            "results": [],
        })
    if "Solution" not in mod.__dict__:
        return json.dumps({
            "compile_error": "Your code must define a `Solution` class.",
            "results": [],
        })
    solution = mod.Solution()
    results = [_run_one(solution, method_name, c) for c in cases]
    return json.dumps({"compile_error": None, "results": results})
