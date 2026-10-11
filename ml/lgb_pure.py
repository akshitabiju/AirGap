"""Dependency-free evaluator for LightGBM `model.txt` files.

Used by the AWS Lambda so the deployment package is ~100 KB instead of
~100 MB (no numpy/scipy/lightgbm). `ml/test_pipeline.py` checks that it
reproduces lightgbm's own predictions to within 1e-6.

Supports numerical splits (the only kind this project uses), LightGBM's
missing-value semantics, and regression/quantile objectives (raw sum of
leaf values; shrinkage is already baked into the stored leaf values).
"""
from __future__ import annotations

import math


class Tree:
    __slots__ = ("split_feature", "threshold", "decision_type", "left", "right", "leaf_value")

    def __init__(self, block: dict[str, str]):
        self.split_feature = [int(x) for x in block.get("split_feature", "").split()] if block.get("split_feature") else []
        self.threshold = [float(x) for x in block.get("threshold", "").split()] if block.get("threshold") else []
        self.decision_type = [int(x) for x in block.get("decision_type", "").split()] if block.get("decision_type") else []
        self.left = [int(x) for x in block.get("left_child", "").split()] if block.get("left_child") else []
        self.right = [int(x) for x in block.get("right_child", "").split()] if block.get("right_child") else []
        self.leaf_value = [float(x) for x in block["leaf_value"].split()]

    def predict(self, x: list[float]) -> float:
        if not self.split_feature:          # single-leaf tree
            return self.leaf_value[0]
        node = 0
        while True:
            f = x[self.split_feature[node]]
            dt = self.decision_type[node]
            default_left = bool(dt & 2)
            missing_type = (dt >> 2) & 3     # 0 none, 1 zero, 2 nan
            if f is None or (isinstance(f, float) and math.isnan(f)):
                if missing_type == 2:
                    go_left = default_left
                else:                        # LightGBM treats NaN as 0 when missing_type != NaN
                    go_left = (0.0 <= self.threshold[node]) if missing_type != 1 else default_left
            elif missing_type == 1 and f == 0.0:
                go_left = default_left
            else:
                go_left = f <= self.threshold[node]
            nxt = self.left[node] if go_left else self.right[node]
            if nxt < 0:
                return self.leaf_value[~nxt]
            node = nxt


class Model:
    def __init__(self, text: str):
        self.feature_names: list[str] = []
        self.trees: list[Tree] = []
        head, *tree_blocks = text.split("\nTree=")
        for line in head.splitlines():
            if line.startswith("feature_names="):
                self.feature_names = line.split("=", 1)[1].split()
        for tb in tree_blocks:
            block: dict[str, str] = {}
            for line in tb.splitlines()[1:]:
                if "=" in line:
                    k, v = line.split("=", 1)
                    block[k] = v
                elif line.startswith("end of trees"):
                    break
            if "leaf_value" in block:
                self.trees.append(Tree(block))

    @classmethod
    def from_file(cls, path: str) -> "Model":
        with open(path, encoding="utf-8") as f:
            return cls(f.read())

    def predict_row(self, x: list[float]) -> float:
        return sum(t.predict(x) for t in self.trees)

    def predict_dict(self, feats: dict[str, float]) -> float:
        return self.predict_row([feats.get(n, float("nan")) for n in self.feature_names])
