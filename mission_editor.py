#!/usr/bin/env python3
"""Launcher for Mission & Map Editor"""
import os
import sys

tools_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools")
sys.path.insert(0, tools_dir)
from mission_editor import MissionEditorApp

if __name__ == "__main__":
    app = MissionEditorApp()
    app.mainloop()

