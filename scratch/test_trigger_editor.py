import sys, os
sys.path.insert(0, os.path.abspath("."))
import tkinter as tk
from tools.mission_editor import MissionEditorApp

app = MissionEditorApp()
app.withdraw()

# Test 1: Add a dialogue trigger
app.add_dialogue_trigger()
idx = app.selected_trigger_idx
trig = app.mission['dynamics']['triggers'][idx]
print(f"Added trigger: {trig['name']}, event: {trig['event']}, time: {trig.get('time')}")

# Test 2: Modify time to 25.0 and save
app.ent_trig_time.delete(0, tk.END)
app.ent_trig_time.insert(0, "25.0")
app.cb_trig_event.set("TIMER")
app.txt_dia_body.delete("1.0", tk.END)
app.txt_dia_body.insert("1.0", "ASTRA // Target acquired at 25 seconds.")
app.update_trigger_from_form()

trig = app.mission['dynamics']['triggers'][idx]
print(f"After update: {trig['name']}, event: {trig['event']}, time: {trig.get('time')}")
assert trig['time'] == 25.0, f"Expected 25.0, got {trig.get('time')}"
assert app.ent_trig_time.get() == "25.0", f"Expected ent_trig_time 25.0, got {app.ent_trig_time.get()}"

# Test 3: Select another trigger and switch back
app.add_area_trigger()
new_idx = app.selected_trigger_idx
assert new_idx != idx
# Switch back to the first trigger
app.select_trigger(idx)
print(f"Switched back to idx {idx}: ent_trig_time = {app.ent_trig_time.get()}")
assert app.ent_trig_time.get() == "25.0", f"Expected ent_trig_time 25.0 after re-selection, got {app.ent_trig_time.get()}"

# Test 4: TARGET_DESTROYED event
app.cb_trig_event.set("TARGET_DESTROYED")
app.cb_trig_target.set("enemy_mig29_1")
app.update_trigger_from_form()
trig = app.mission['dynamics']['triggers'][idx]
print(f"After target destroyed update: event: {trig['event']}, targetId: {trig.get('targetId')}")
assert trig['targetId'] == "enemy_mig29_1", f"Expected enemy_mig29_1, got {trig.get('targetId')}"

# Re-select and verify targetId is populated in combobox
app.select_trigger(new_idx)
app.select_trigger(idx)
assert app.cb_trig_target.get() == "enemy_mig29_1" or "enemy_mig29_1" in app.cb_trig_target.get()

app.destroy()
print(">>> ALL MISSION EDITOR TRIGGER TESTS PASSED! <<<")
