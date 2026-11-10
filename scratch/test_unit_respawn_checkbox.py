import sys
import os

sys.path.insert(0, os.path.abspath("tools"))
from mission_editor import MissionEditorApp

def main():
    print("Testing Mission Editor Unit Respawn Checkbox...")
    app = MissionEditorApp()
    app.withdraw()

    # 1. Checkbox attributes exist
    assert hasattr(app, "var_u_respawn"), "var_u_respawn missing on app"
    assert hasattr(app, "cb_u_respawn"), "cb_u_respawn missing on app"
    print("PASS: var_u_respawn and cb_u_respawn exist.")

    # 2. Add an air unit with respawn enabled
    app.var_u_respawn.set(True)
    app.add_air_unit(100, 200)
    air_idx = len(app.mission["units"]["airUnits"]) - 1
    u_air = app.mission["units"]["airUnits"][air_idx]
    assert u_air.get("canRespawn") is True, f"Expected canRespawn=True, got {u_air.get('canRespawn')}"
    print("PASS: Air unit added with canRespawn=True.")

    # 3. Add a ground unit with respawn disabled
    app.var_u_respawn.set(False)
    app.add_ground_unit(300, 400)
    gnd_idx = len(app.mission["units"]["groundUnits"]) - 1
    u_gnd = app.mission["units"]["groundUnits"][gnd_idx]
    assert u_gnd.get("canRespawn") is False, f"Expected canRespawn=False, got {u_gnd.get('canRespawn')}"
    print("PASS: Ground unit added with canRespawn=False.")

    # 4. Select the ground unit and toggle respawn to True, then apply
    app.select_unit("ground", gnd_idx)
    assert app.var_u_respawn.get() is False, "Expected var_u_respawn to be False when selecting ground unit"
    app.var_u_respawn.set(True)
    app.update_unit_from_form()
    u_gnd = app.mission["units"]["groundUnits"][gnd_idx]
    assert u_gnd.get("canRespawn") is True, "Expected canRespawn to be updated to True"
    print("PASS: Successfully toggled ground unit canRespawn to True via form.")

    # 5. Select air unit and toggle respawn to False, then apply
    app.select_unit("air", air_idx)
    assert app.var_u_respawn.get() is True, "Expected var_u_respawn to be True when selecting air unit"
    app.var_u_respawn.set(False)
    app.update_unit_from_form()
    u_air = app.mission["units"]["airUnits"][air_idx]
    assert u_air.get("canRespawn") is False, "Expected canRespawn to be updated to False"
    print("PASS: Successfully toggled air unit canRespawn to False via form.")

    # 6. Check listbox displays [RESPAWN] when canRespawn is True
    app.select_unit("ground", gnd_idx)
    items = list(app.units_listbox.get(0, "end"))
    has_respawn_tag = any("[RESPAWN]" in item for item in items)
    assert has_respawn_tag, "Expected at least one unit item to show [RESPAWN] tag"
    print(f"PASS: Units listbox displays [RESPAWN] tag correctly: {items[-1]}")

    app.destroy()
    print("ALL UNIT RESPAWN CHECKBOX TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()

