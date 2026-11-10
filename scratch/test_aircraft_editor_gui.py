import tkinter as tk
import os
import sys

sys.path.insert(0, os.path.abspath("."))

# Test aircraft_editor without opening mainloop
from tools.aircraft_editor import AircraftEditorApp

def test_editor_app():
    root = AircraftEditorApp()
    root.withdraw()

    # Check loaded aircraft
    print("Loaded aircraft count:", len(root.aircraft_cache))
    assert len(root.aircraft_cache) >= 8, f"Expected at least 8 aircraft, got {len(root.aircraft_cache)}"
    assert "mig17" in root.aircraft_cache, "mig17 missing from editor cache!"
    assert "f15c" in root.aircraft_cache, "f15c missing from editor cache!"

    # Test displaying MiG-17
    root.display_aircraft("mig17")
    mig_scale = float(root.node_scale_spin.get())
    print("MiG-17 scale in editor:", mig_scale)
    assert mig_scale == 0.78, f"Expected 0.78 for MiG-17, got {mig_scale}"

    print("MiG-17 nodes in editor:", root.nodes_data)
    assert len(root.nodes_data["engines"]) == 1, f"MiG-17 should have 1 engine node, got {len(root.nodes_data['engines'])}"
    assert root.nodes_data["engines"][0]["x"] == 0.0, "MiG-17 engine should be at x=0.0"
    assert len(root.nodes_data["wingtips"]) == 2, f"MiG-17 should have 2 wingtip nodes, got {len(root.nodes_data['wingtips'])}"

    # Test collecting form data
    data = root.collect_form_data()
    assert data["scale"] == 0.78
    assert data["nodes"]["engines"][0]["x"] == 0.0
    print("[PASS] Form data collected correctly!")

    # Test displaying F-15C
    root.display_aircraft("f15c")
    f15_scale = float(root.node_scale_spin.get())
    print("F-15C scale in editor:", f15_scale)
    assert f15_scale == 1.0, f"Expected 1.0 for F-15C, got {f15_scale}"
    assert len(root.nodes_data["engines"]) == 2, f"F-15C should have 2 engine nodes, got {len(root.nodes_data['engines'])}"
    assert len(root.nodes_data["wingtips"]) == 2, f"F-15C should have 2 wingtip nodes, got {len(root.nodes_data['wingtips'])}"

    root.destroy()
    print("[PASS] AircraftEditorApp GUI and data integration tested successfully!")

if __name__ == "__main__":
    test_editor_app()
