import os
import sys

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import tkinter as tk

# Import mission editor
import tools.mission_editor as me

try:
    editor = me.MissionEditorApp()
    editor.withdraw()
except Exception as e:
    print(f"Skipping GUI test (no display): {e}")
    sys.exit(0)

print("=== TEST 1: Initial Objective State ===")
assert hasattr(editor, "selected_objective_idx"), "Editor must have selected_objective_idx attribute"
assert hasattr(editor, "ent_obj_title"), "Editor must have ent_obj_title"
assert hasattr(editor, "cb_obj_type"), "Editor must have cb_obj_type"
assert hasattr(editor, "ent_obj_desc"), "Editor must have ent_obj_desc"
assert hasattr(editor, "chk_obj_primary"), "Editor must have chk_obj_primary"
assert hasattr(editor, "ent_obj_param1"), "Editor must have ent_obj_param1"
assert hasattr(editor, "cb_obj_target"), "Editor must have cb_obj_target"
print("PASS: Objective Inspector UI components exist.")

print("\n=== TEST 2: Add and Inspect Objective ===")
editor.mission["dynamics"]["objectives"] = []
editor.add_objective()
assert len(editor.mission["dynamics"]["objectives"]) == 1
assert editor.selected_objective_idx == 0
assert editor.ent_obj_title.get() == "Objective #1"
assert editor.cb_obj_type.get() == "DESTROY_TARGETS"
assert editor.var_obj_primary.get() is True
print("PASS: Objective added and inspector populated.")

print("\n=== TEST 3: Edit Objective and Apply Changes ===")
editor.ent_obj_title.delete(0, tk.END)
editor.ent_obj_title.insert(0, "Eliminate Radar Station")
editor.ent_obj_desc.delete(0, tk.END)
editor.ent_obj_desc.insert(0, "Strike primary early-warning radar node at Sector Gamma.")
editor.cb_obj_type.set("DESTROY_NAMED_TARGET")
editor.cb_obj_target.set("radar_array_1")
editor.var_obj_primary.set(True)

editor.update_objective_from_form()

saved_obj = editor.mission["dynamics"]["objectives"][0]
assert saved_obj["title"] == "Eliminate Radar Station"
assert saved_obj["description"] == "Strike primary early-warning radar node at Sector Gamma."
assert saved_obj["type"] == "DESTROY_NAMED_TARGET"
assert saved_obj["targetUnitId"] == "radar_array_1"
assert saved_obj["isPrimary"] is True
print("PASS: Objective edits successfully saved into mission data.")

print("\n=== TEST 4: Duplicate Objective ===")
editor.duplicate_objective()
assert len(editor.mission["dynamics"]["objectives"]) == 2
assert editor.selected_objective_idx == 1
assert editor.mission["dynamics"]["objectives"][1]["title"] == "Eliminate Radar Station (Copy)"
print("PASS: Objective duplication works.")

print("\n=== TEST 5: Delete Objective ===")
editor.delete_objective()
assert len(editor.mission["dynamics"]["objectives"]) == 1
assert editor.selected_objective_idx == 0
print("PASS: Objective deletion works.")

print("\nALL MISSION EDITOR OBJECTIVE TESTS PASSED SUCCESSFULLY!")
editor.destroy()
