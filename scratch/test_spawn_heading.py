import math
import sys
import os

# Adjust path
sys.path.insert(0, os.path.abspath("tools"))
from mission_editor import MissionEditorApp

def main():
    print("Testing Mission Editor Spawn & Unit Heading Support...")
    app = MissionEditorApp()
    app.withdraw()  # Hide GUI window during automated test

    # 1. Player Spawns
    spawns = app.mission["units"].setdefault("playerSpawns", [])
    if not spawns:
        app.add_spawn_point(100, 200)
    sp = app.mission["units"]["playerSpawns"][0]
    
    app.select_unit("spawn", 0)
    assert hasattr(app, "ent_sp_heading"), "ent_sp_heading missing on app"
    assert hasattr(app, "ent_sp_speed"), "ent_sp_speed missing on app"
    assert hasattr(app, "var_sp_primary"), "var_sp_primary missing on app"

    # Test preset North (270°)
    app.set_spawn_heading_preset(270)
    sp = app.mission["units"]["playerSpawns"][0]
    assert math.isclose(sp["heading"], -math.pi/2, abs_tol=0.01), f"Expected -pi/2, got {sp['heading']}"
    print(f"PASS: Player spawn North preset -> heading: {sp['heading']} rad")

    # Test preset East (0°)
    app.set_spawn_heading_preset(0)
    sp = app.mission["units"]["playerSpawns"][0]
    assert math.isclose(sp["heading"], 0.0, abs_tol=0.01), f"Expected 0.0, got {sp['heading']}"
    print(f"PASS: Player spawn East preset -> heading: {sp['heading']} rad")

    # Test manual entry in degrees: 135° (South-West)
    app.ent_sp_heading.delete(0, "end")
    app.ent_sp_heading.insert(0, "135")
    app.update_spawn_from_form()
    sp = app.mission["units"]["playerSpawns"][0]
    assert math.isclose(sp["heading"], math.radians(135), abs_tol=0.01), f"Expected 2.356, got {sp['heading']}"
    print(f"PASS: Player spawn manual entry 135° -> heading: {sp['heading']} rad")

    # 2. Air Units
    app.add_air_unit(500, 500)
    air_idx = len(app.mission["units"]["airUnits"]) - 1
    app.select_unit("air", air_idx)
    app.set_unit_heading_preset(180)  # West
    a_unit = app.mission["units"]["airUnits"][air_idx]
    assert math.isclose(abs(a_unit["heading"]), math.pi, abs_tol=0.01), f"Expected pi, got {a_unit['heading']}"
    print(f"PASS: Air unit West preset -> heading: {a_unit['heading']} rad")

    # 3. Ground Units
    app.add_ground_unit(1000, 1000)
    gnd_idx = len(app.mission["units"]["groundUnits"]) - 1
    app.select_unit("ground", gnd_idx)
    app.set_unit_heading_preset(45)  # South-East
    g_unit = app.mission["units"]["groundUnits"][gnd_idx]
    assert math.isclose(g_unit["heading"], math.pi/4, abs_tol=0.01), f"Expected pi/4, got {g_unit['heading']}"
    print(f"PASS: Ground unit South-East preset -> heading: {g_unit['heading']} rad")

    # 4. Naval Units
    app.add_naval_unit(2000, 2000)
    nav_idx = len(app.mission["units"]["navalUnits"]) - 1
    app.select_unit("naval", nav_idx)
    app.set_unit_heading_preset(315)  # North-East
    n_unit = app.mission["units"]["navalUnits"][nav_idx]
    assert math.isclose(n_unit["heading"], -math.pi/4, abs_tol=0.01), f"Expected -pi/4, got {n_unit['heading']}"
    print(f"PASS: Naval unit North-East preset -> heading: {n_unit['heading']} rad")

    # 5. Canvas redraw check
    app.redraw_canvas()
    print("PASS: Canvas redraw succeeded with all heading vectors and handles.")

    app.destroy()
    print("ALL SPAWN & UNIT HEADING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()

