import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import tools.mission_editor as me

try:
    editor = me.MissionEditorApp()
    editor.withdraw()
except Exception as e:
    print(f"Skipping GUI test: {e}")
    sys.exit(0)

print("=== TEST 1: Polygon with List of [x, y] Points ===")
poly_list_pts = [
    [-600, -600],
    [600, -600],
    [600, 600],
    [-600, 600]
]

isl_city_list = {
    "id": "poly_city_1",
    "type": "polygon",
    "landType": "city",
    "x": 0,
    "y": 0,
    "radius": 900,
    "points": poly_list_pts,
    "color": "#222730",
    "sandColor": "#252930"
}

# Add to editor mission terrain
editor.mission["map"]["terrain"] = [isl_city_list]
try:
    editor.redraw_canvas()
    print("PASS: Polygon island with list coordinates rendered successfully without error!")
except Exception as e:
    print(f"FAIL: {e}")
    sys.exit(1)

print("\n=== TEST 2: Polygon with Dict of {'x': ..., 'y': ...} Points ===")
poly_dict_pts = [
    {"x": -700, "y": -700},
    {"x": 700, "y": -700},
    {"x": 700, "y": 700},
    {"x": -700, "y": 700}
]

isl_city_dict = {
    "id": "poly_city_2",
    "type": "polygon",
    "landType": "city",
    "x": 0,
    "y": 0,
    "radius": 1000,
    "points": poly_dict_pts,
    "color": "#222730",
    "sandColor": "#252930"
}

editor.mission["map"]["terrain"] = [isl_city_dict]
try:
    editor.redraw_canvas()
    print("PASS: Polygon island with dict coordinates rendered successfully without error!")
except Exception as e:
    print(f"FAIL: {e}")
    sys.exit(1)

print("\n=== TEST 3: All Land Types for Polygons ===")
for ltype in ["island", "desert", "city"]:
    test_isl = {
        "id": f"poly_{ltype}",
        "type": "polygon",
        "landType": ltype,
        "x": 0,
        "y": 0,
        "radius": 800,
        "points": [[-400, -400], [400, -400], [400, 400], [-400, 400]]
    }
    editor.mission["map"]["terrain"] = [test_isl]
    editor.redraw_canvas()
    print(f"PASS: Polygon landType '{ltype}' rendered cleanly.")

editor.destroy()
print("\nALL POLYGON ISLAND TESTS PASSED SUCCESSFULLY!")

