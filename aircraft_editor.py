#!/usr/bin/env python3
"""Launcher for Aircraft Editor"""
import os
import sys

tools_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools")
sys.path.insert(0, tools_dir)
from aircraft_editor import AircraftEditorApp

if __name__ == "__main__":
    app = AircraftEditorApp()
    app.mainloop()

