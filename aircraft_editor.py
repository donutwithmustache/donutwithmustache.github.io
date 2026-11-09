#!/usr/bin/env python3
"""Launcher for Aircraft Editor"""
import os
import sys

tools_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools")
if tools_dir not in sys.path:
    sys.path.insert(0, tools_dir)

try:
    from tools.aircraft_editor import AircraftEditorApp
except (ImportError, ModuleNotFoundError):
    from aircraft_editor import AircraftEditorApp

if __name__ == "__main__":
    app = AircraftEditorApp()
    app.mainloop()

