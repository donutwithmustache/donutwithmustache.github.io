#!/usr/bin/env python3
"""
Web Legion - 3-Layer Mission & Map Editor GUI
Visual map editor with interactive 2D canvas for:
Layer 1: Map (Bounds, Terrain, Atmosphere)
Layer 2: Units (Player Spawns, Air, Ground, Naval, Spawn/Despawn, Waypoint Pathing)
Layer 3: Dynamics (Objectives, Triggers, Dialogue Transmissions, Scripted Explosions & Nukes)
"""

import os
import sys
import json
import math
import copy
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from PIL import Image, ImageTk

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MISSIONS_DIR = os.path.join(BASE_DIR, "data", "missions")
MANIFEST_FILE = os.path.join(MISSIONS_DIR, "manifest.json")
PLANES_DIR = os.path.join(BASE_DIR, "assets", "planes")
PORTRAITS_DIR = os.path.join(BASE_DIR, "assets", "portraits")

AI_LEVELS = ["dummy", "drone", "rookie", "veteran", "elite", "ace", "strike"]
AIRCRAFT_MODELS = ["su27", "f15c", "f111f", "su57", "f22", "mig21"]
SHIP_TYPES = ["carrier", "cruiser", "destroyer", "frigate", "gunboat"]
GROUND_TYPES = ["sam", "flak", "radar"]

TRIGGER_EVENTS = [
    "ON_START",
    "TIMER",
    "PLAYER_ENTER_AREA",
    "UNIT_ENTER_AREA",
    "PLAYER_PROXIMITY",
    "TARGET_DESTROYED"
]

TRIGGER_ACTIONS = [
    "DIALOGUE",
    "FLY_TO_AREA",
    "DEFEND_AREA",
    "STAY_IN_AREA",
    "TELEPORT_TO_AREA",
    "TELEPORT_PLAYER",
    "TELEPORT_UNIT",
    "FADE_TRANSITION",
    "DETONATE_NUKE",
    "EXPLODE_UNIT",
    "MOVE_UNIT",
    "SPAWN_UNIT",
    "DESPAWN_UNIT",
    "RADIO_MESSAGE",
    "SET_AI_ORDER",
    "SCRIPTED_END",
    "MISSION_COMPLETE",
    "MISSION_FAILED"
]

AI_ORDER_TYPES = [
    "FLY_TO_AREA",
    "DEFEND_AREA",
    "STAY_IN_AREA",
    "PATROL_AREA",
    "COVER_AREA",
    "ATTACK_TARGET",
    "INTERCEPT_PLAYER",
    "FORMATION_FLIGHT",
    "DEFEND_POINT",
    "ADVANCE_AND_ATTACK"
]


def is_point_in_polygon(x, y, poly):
    """Ray-casting point-in-polygon test for arbitrary 2D polygons."""
    if not poly or len(poly) < 3:
        return False
    inside = False
    n = len(poly)
    p1x, p1y = poly[0][0], poly[0][1]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n][0], poly[i % n][1]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


class MissionEditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Web Legion - Mission & Map Editor (3-Layer Architecture)")
        self.geometry("1340x860")
        self.minsize(1080, 720)
        self.configure(bg="#0a121c")

        self.current_mission_id = "test_flight"
        self.mission = self.get_empty_mission()

        # Canvas navigation state
        self.cam_x = 0.0
        self.cam_y = 0.0
        self.zoom = 0.018  # Canvas pixels per world meter
        self.tool_mode = "select"  # select, island, poly_island, spawn, air, ground, naval, nuke
        self.selected_item = None  # (layer, type, index_or_id)
        self.selected_area_idx = None
        self.selected_trigger_idx = None
        self.drag_start = None
        self.dragging_area_resize = False
        self.portrait_preview_img = None

        # Polygonal island drawing and vertex manipulation state
        self.poly_drawing_pts = []  # List of (wx, wy)
        self.mouse_world_pos = (0.0, 0.0)
        self.selected_vertex_idx = None  # Index of active vertex in selected polygon island

        # Clipboard buffers for units, triggers, and areas
        self.clipboard_unit = None
        self.clipboard_trigger = None
        self.clipboard_area = None

        self.setup_styles()
        self.build_ui()
        self.setup_hotkeys()
        self.load_mission_by_id(self.current_mission_id)

    def setup_hotkeys(self):
        self.bind_all("<Control-c>", self.on_hotkey_copy)
        self.bind_all("<Control-v>", self.on_hotkey_paste)
        self.bind_all("<Control-d>", self.on_hotkey_duplicate)
        self.bind_all("<Control-C>", self.on_hotkey_copy)
        self.bind_all("<Control-V>", self.on_hotkey_paste)
        self.bind_all("<Control-D>", self.on_hotkey_duplicate)

    def setup_styles(self):
        self.style = ttk.Style(self)
        try:
            self.style.theme_use("clam")
        except Exception:
            pass
        self.style.configure(".", background="#0a121c", foreground="#00ff66", font=("Consolas", 10))
        self.style.configure("TNotebook", background="#0a121c", borderwidth=0)
        self.style.configure("TNotebook.Tab", background="#121e2c", foreground="#80c0a0", padding=[12, 6], font=("Consolas", 10, "bold"))
        self.style.map("TNotebook.Tab",
            background=[("selected", "#1a2c40"), ("active", "#152434")],
            foreground=[("selected", "#00ffcc"), ("active", "#ffffff")]
        )
        self.style.configure("TFrame", background="#0a121c")
        self.style.configure("TLabel", background="#0a121c", foreground="#88b0a0")
        self.style.configure("TEntry", fieldbackground="#132030", foreground="#ffffff", insertcolor="#00ff66")
        self.style.configure("TCombobox", fieldbackground="#132030", foreground="#ffffff", background="#182c40")

    def get_empty_mission(self):
        return {
            "missionType": "singleplayer",
            "noRespawn": False,
            "playerCount": 1,
            "loadout": {
                "mode": "player",
                "aircraft": "f15c",
                "specialWeapon": "qaam"
            },
            "map": {
                "id": "new_mission",
                "name": "New Tactical Operation",
                "size": 30150,
                "halfMapSize": 15075,
                "returnLine": {"enabled": False, "side": "bottom", "offset": 0.10},
                "oceanTheme": {"gradTop": "#050e18", "gradMid": "#061524", "gradBottom": "#04101a"},
                "terrain": [],
                "weather": {"cloudDensity": 1.0, "waveCount": 1500, "windHeading": -0.45, "windSpeed": 10}
            },
            "units": {
                "playerSpawns": [
                    {"id": "spawn_p1", "team": "friendly", "x": 0, "y": 0, "heading": -0.785, "speed": 335, "altitude": 1.0, "isPrimary": True, "allowedTags": []}
                ],
                "airUnits": [],
                "navalUnits": [],
                "groundUnits": []
            },
            "dynamics": {
                "meta": {
                    "id": "new_mission",
                    "title": "OPERATION: UNNAMED",
                    "codename": "AIR-STRIKE",
                    "briefing": "Mission briefing parameters..."
                },
                "objectives": [
                    {"id": "obj_primary", "title": "Eliminate Hostiles", "description": "Destroy hostile forces in sector.", "type": "DESTROY_TARGETS", "requiredCount": 5, "isPrimary": True}
                ],
                "winConditions": {"allPrimaryComplete": True, "requiredKills": 0},
                "loseConditions": {"playerDestroyed": True, "timeLimit": 0, "noRespawn": False},
                "areas": [],
                "triggers": [
                    {
                        "id": "trig_start",
                        "name": "Start Radio Comm",
                        "event": "ON_START",
                        "actions": [
                            {"type": "RADIO_MESSAGE", "text": "HQ // Tactical operation underway."},
                            {"type": "DIALOGUE", "speaker": "PIXY", "aircraft": "F-15C", "squadron": "1ST BUDDY AIRFORCE", "text": "Yo buddy, still alive?", "duration": 5.5}
                        ]
                    }
                ]
            }
        }

    # ----------------------------------------------------
    # UI CONSTRUCTION
    # ----------------------------------------------------
    def build_ui(self):
        # Top Control Toolbar
        toolbar = tk.Frame(self, bg="#0d1824", height=48, bd=1, relief="ridge")
        toolbar.pack(side="top", fill="x")

        tk.Label(toolbar, text="MISSION & MAP DESIGNER // 3-LAYER", bg="#0d1824", fg="#00ff66",
                 font=("Consolas", 12, "bold"), padx=12).pack(side="left")

        # Tool Mode Radio Buttons
        tk.Label(toolbar, text="Tool:", bg="#0d1824", fg="#88b0a0", font=("Consolas", 10)).pack(side="left", padx=(15, 4))
        self.mode_var = tk.StringVar(value="select")
        tools = [
            ("Select/Move", "select"),
            ("+ Area", "area"),
            ("+ Island", "island"),
            ("+ Poly Island", "poly_island"),
            ("+ Spawn", "spawn"),
            ("+ Air", "air"),
            ("+ SAM", "ground"),
            ("+ Naval", "naval"),
            ("+ Nuke Pt", "nuke")
        ]
        for lbl, mode in tools:
            rb = tk.Radiobutton(toolbar, text=lbl, value=mode, variable=self.mode_var,
                                bg="#0d1824", fg="#c0f0d0", selectcolor="#005522",
                                activebackground="#0d1824", activeforeground="#00ffcc",
                                indicatoron=0, padx=6, pady=2, font=("Consolas", 9, "bold"),
                                command=self.on_tool_change)
            rb.pack(side="left", padx=2)

        # Right Action Buttons
        btn_save = tk.Button(toolbar, text="[ SAVE MISSION ]", bg="#006633", fg="#ffffff",
                             activebackground="#00994d", activeforeground="#ffffff",
                             font=("Consolas", 9, "bold"), padx=10, command=self.save_mission)
        btn_save.pack(side="right", padx=10, pady=8)

        btn_open = tk.Button(toolbar, text="Open JSON...", bg="#183048", fg="#00ffcc",
                             font=("Consolas", 9), padx=8, command=self.open_mission_file)
        btn_open.pack(side="right", padx=4)

        btn_new = tk.Button(toolbar, text="New Mission", bg="#183048", fg="#00ffcc",
                            font=("Consolas", 9), padx=8, command=self.new_mission)
        btn_new.pack(side="right", padx=4)

        # Main Split: 2D Canvas (Left) + Layer Inspector (Right)
        paned = tk.PanedWindow(self, orient="horizontal", bg="#050a10", bd=0, sashwidth=4)
        paned.pack(fill="both", expand=True, padx=6, pady=6)

        # ------------------ 2D MAP CANVAS ------------------
        canvas_frame = tk.Frame(paned, bg="#000000")
        paned.add(canvas_frame, minsize=550)

        # Canvas Nav Controls Bar
        c_nav = tk.Frame(canvas_frame, bg="#0e1724", height=28)
        c_nav.pack(side="top", fill="x")

        tk.Label(c_nav, text="Interactive Map: Drag to Move | Right-Drag/Mid to Pan | Wheel to Zoom",
                 bg="#0e1724", fg="#88b0a0", font=("Consolas", 9), padx=8).pack(side="left")

        btn_zin = tk.Button(c_nav, text=" + ", bg="#1a2d42", fg="#00ffcc", font=("Consolas", 8, "bold"), command=lambda: self.adjust_zoom(1.3))
        btn_zin.pack(side="right", padx=2, pady=2)
        btn_zout = tk.Button(c_nav, text=" - ", bg="#1a2d42", fg="#00ffcc", font=("Consolas", 8, "bold"), command=lambda: self.adjust_zoom(0.75))
        btn_zout.pack(side="right", padx=2, pady=2)
        btn_zreset = tk.Button(c_nav, text="Fit Map", bg="#1a2d42", fg="#00ffcc", font=("Consolas", 8), command=self.fit_map_view)
        btn_zreset.pack(side="right", padx=4, pady=2)

        self.canvas = tk.Canvas(canvas_frame, bg="#050e18", highlightthickness=0, cursor="crosshair")
        self.canvas.pack(fill="both", expand=True)

        self.canvas.bind("<ButtonPress-1>", self.on_canvas_click)
        self.canvas.bind("<Double-Button-1>", self.on_canvas_double_click)
        self.canvas.bind("<B1-Motion>", self.on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)
        self.canvas.bind("<ButtonPress-2>", self.on_pan_start)
        self.canvas.bind("<B2-Motion>", self.on_pan_drag)
        self.canvas.bind("<ButtonPress-3>", self.on_pan_start)
        self.canvas.bind("<B3-Motion>", self.on_pan_drag)
        self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)
        self.canvas.bind("<Motion>", self.on_mouse_move)

        # Global keyboard shortcuts for polygon drawing
        self.bind("<Return>", self.on_key_return)
        self.bind("<Escape>", self.on_key_escape)

        # ------------------ RIGHT TABS: 3-LAYER INSPECTOR ------------------
        right_panel = tk.Frame(paned, bg="#0a121c")
        paned.add(right_panel, minsize=500)

        self.notebook = ttk.Notebook(right_panel)
        self.notebook.pack(fill="both", expand=True)

        self.tab_map = ttk.Frame(self.notebook)
        self.tab_units = ttk.Frame(self.notebook)
        self.tab_dynamics = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_map, text=" Layer 1: Map & Terrain ")
        self.notebook.add(self.tab_units, text=" Layer 2: Units & Spawns ")
        self.notebook.add(self.tab_dynamics, text=" Layer 3: Dynamics & Scripts ")
        self.notebook.bind("<<NotebookTabChanged>>", self.on_tab_changed)

        self.build_tab_map()
        self.build_tab_units()
        self.build_tab_dynamics()

        # Bottom Coordinates & Status Bar
        self.status_bar = tk.Label(self, text="World: (0m, 0m) | Mission: test_flight", bg="#081018", fg="#00ff66",
                                   font=("Consolas", 9), anchor="w", padx=10, pady=3)
        self.status_bar.pack(side="bottom", fill="x")

    def get_active_layer(self):
        try:
            curr = self.notebook.select()
            idx = self.notebook.index(curr)
            if idx == 0:
                return "map"
            elif idx == 1:
                return "units"
            elif idx == 2:
                return "dynamics"
        except Exception:
            pass
        return "map"

    def on_tab_changed(self, event=None):
        layer = self.get_active_layer()
        if self.selected_item:
            item_layer = self.selected_item[0]
            if item_layer != layer:
                self.selected_item = None
                self.selected_vertex_idx = None
                self.terrain_listbox.selection_clear(0, tk.END)
                self.spawns_listbox.selection_clear(0, tk.END)
                self.units_listbox.selection_clear(0, tk.END)
                self.redraw_canvas()

    def on_tool_change(self):
        self.tool_mode = self.mode_var.get()
        if self.tool_mode != "poly_island" and self.poly_drawing_pts:
            self.poly_drawing_pts = []
            self.redraw_canvas()
        if self.tool_mode in ("island", "poly_island"):
            self.notebook.select(self.tab_map)
        elif self.tool_mode in ("spawn", "air", "ground", "naval"):
            self.notebook.select(self.tab_units)
        elif self.tool_mode in ("nuke", "area"):
            self.notebook.select(self.tab_dynamics)
        if self.tool_mode == "poly_island":
            self.status_bar.config(text="POLY ISLAND TOOL: Click map to place vertices. Click near start vertex, Double-Click, or press Enter to finish. Escape to cancel.")
        elif self.tool_mode == "area":
            self.status_bar.config(text="AREA TOOL: Click on map to place a circular trigger zone. Use perimeter handle or radius controls to resize.")
        self.canvas.config(cursor="hand2" if self.tool_mode == "select" else "crosshair")

    # ----------------------------------------------------
    # TAB 1: LAYER 1 - MAP & TERRAIN
    # ----------------------------------------------------
    def build_tab_map(self):
        frame = tk.Frame(self.tab_map, bg="#0a121c", padx=12, pady=12)
        frame.pack(fill="both", expand=True)

        box_meta = tk.LabelFrame(frame, text=" Map Boundaries & Size ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        box_meta.pack(fill="x", pady=4)

        tk.Label(box_meta, text="Map Size (meters):", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w", pady=4)
        self.ent_map_size = ttk.Entry(box_meta, width=14)
        self.ent_map_size.grid(row=0, column=1, sticky="w", padx=8)

        btn_resize = tk.Button(box_meta, text="Resize Map Bounds", bg="#1a3248", fg="#00ffcc", font=("Consolas", 9, "bold"),
                               command=self.apply_map_resize)
        btn_resize.grid(row=0, column=2, sticky="w", padx=8)

        tk.Label(box_meta, text="Mission ID:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=1, column=0, sticky="w", pady=4)
        self.ent_mission_id = ttk.Entry(box_meta, width=18)
        self.ent_mission_id.grid(row=1, column=1, sticky="w", padx=8)

        # Mission Mode, Player Count & Loadout Configuration
        box_mode = tk.LabelFrame(frame, text=" Mission Mode, Player Count & Loadout Configuration ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        box_mode.pack(fill="x", pady=4)

        # Row 0: Mode selection
        tk.Label(box_mode, text="Mission Mode:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9, "bold")).grid(row=0, column=0, sticky="w", pady=3)
        self.cb_mission_type = ttk.Combobox(box_mode, values=["singleplayer", "multiplayer"], state="readonly", width=14)
        self.cb_mission_type.set("singleplayer")
        self.cb_mission_type.grid(row=0, column=1, sticky="w", padx=6, pady=3)
        self.cb_mission_type.bind("<<ComboboxSelected>>", self.on_mission_type_changed)

        self.lbl_mode_badge = tk.Label(box_mode, text="[ SINGLEPLAYER CAMPAIGN / SORTIE ]", bg="#101c2b", fg="#00ff66", font=("Consolas", 9, "bold"))
        self.lbl_mode_badge.grid(row=0, column=2, columnspan=2, sticky="w", padx=6)

        # Row 1: Multiplayer Controls
        self.lbl_mp_players = tk.Label(box_mode, text="Player Count:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9))
        self.lbl_mp_players.grid(row=1, column=0, sticky="w", pady=3)

        self.spin_player_count = tk.Spinbox(box_mode, from_=2, to=16, width=6, bg="#132030", fg="#00ffcc", font=("Consolas", 9), command=self.on_player_count_changed)
        self.spin_player_count.delete(0, tk.END)
        self.spin_player_count.insert(0, "4")
        self.spin_player_count.grid(row=1, column=1, sticky="w", padx=6, pady=3)
        self.spin_player_count.bind("<KeyRelease>", lambda e: self.on_player_count_changed())

        self.btn_gen_spawns = tk.Button(box_mode, text="Auto-Generate Spawns", bg="#1a3248", fg="#00e5ff", font=("Consolas", 8, "bold"), command=self.auto_generate_player_spawns)
        self.btn_gen_spawns.grid(row=1, column=2, sticky="w", padx=4)

        self.lbl_spawns_status = tk.Label(box_mode, text="Spawns: 0/0", bg="#101c2b", fg="#00ffcc", font=("Consolas", 8))
        self.lbl_spawns_status.grid(row=1, column=3, sticky="w", padx=6)

        # Row 2: Singleplayer Loadout Controls
        self.lbl_sp_loadout = tk.Label(box_mode, text="Loadout Option:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9))
        self.lbl_sp_loadout.grid(row=2, column=0, sticky="w", pady=3)

        self.cb_loadout_mode = ttk.Combobox(box_mode, values=["Player Loadout", "Forced Aircraft & Loadout"], state="readonly", width=24)
        self.cb_loadout_mode.set("Player Loadout")
        self.cb_loadout_mode.grid(row=2, column=1, sticky="w", padx=6, pady=3)
        self.cb_loadout_mode.bind("<<ComboboxSelected>>", self.on_loadout_mode_changed)

        self.f_forced_loadout = tk.Frame(box_mode, bg="#101c2b")
        self.f_forced_loadout.grid(row=2, column=2, columnspan=2, sticky="w")

        tk.Label(self.f_forced_loadout, text="Plane:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 8)).pack(side="left")
        self.cb_forced_plane = ttk.Combobox(self.f_forced_loadout, values=["f15c", "su27", "f111f", "su57"], state="readonly", width=8)
        self.cb_forced_plane.set("f15c")
        self.cb_forced_plane.pack(side="left", padx=2)

        tk.Label(self.f_forced_loadout, text="SPW:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 8)).pack(side="left", padx=(4, 0))
        self.cb_forced_spw = ttk.Combobox(self.f_forced_loadout, values=["qaam", "saam", "4aam", "hpaa", "ugb", "lasm", "sffs", "mpbm"], state="readonly", width=7)
        self.cb_forced_spw.set("qaam")
        self.cb_forced_spw.pack(side="left", padx=2)

        # Row 3: Singleplayer No Respawn Option
        self.var_no_respawn = tk.BooleanVar(value=False)
        self.chk_no_respawn = tk.Checkbutton(
            box_mode, text="No Respawn (Strict Singleplayer: Mission fails immediately if pilot is shot down)",
            variable=self.var_no_respawn, bg="#101c2b", fg="#ff7766", selectcolor="#440000",
            activebackground="#101c2b", activeforeground="#ff9988", font=("Consolas", 8, "bold"),
            command=self.update_conditions_notes
        )
        self.chk_no_respawn.grid(row=3, column=0, columnspan=4, sticky="w", pady=2)

        # Row 4: Operational Notes / Rules
        self.lbl_mode_notes = tk.Label(box_mode, text="", bg="#101c2b", fg="#88a898", font=("Consolas", 8), wraplength=480, justify="left")
        self.lbl_mode_notes.grid(row=4, column=0, columnspan=4, sticky="w", pady=3)

        # Ace Combat Return Line (Resupply Zone) Settings
        box_rl = tk.LabelFrame(frame, text=" Return Line (Ace Combat Resupply Zone) ", bg="#101c2b", fg="#00e5ff", font=("Consolas", 10, "bold"), padx=10, pady=8)
        box_rl.pack(fill="x", pady=4)

        self.var_rl_enabled = tk.BooleanVar(value=False)
        chk_rl = tk.Checkbutton(box_rl, text="Enable Return Line", variable=self.var_rl_enabled, bg="#101c2b", fg="#00e5ff",
                                selectcolor="#05121c", activebackground="#101c2b", activeforeground="#ffffff", font=("Consolas", 9, "bold"))
        chk_rl.grid(row=0, column=0, sticky="w", pady=2)

        tk.Label(box_rl, text="Side:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=1, sticky="w", padx=4)
        self.cb_rl_side = ttk.Combobox(box_rl, values=["bottom", "top", "left", "right"], state="readonly", width=10)
        self.cb_rl_side.set("bottom")
        self.cb_rl_side.grid(row=0, column=2, sticky="w", padx=4)

        tk.Label(box_rl, text="Blocked Area (%):", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=3, sticky="w", padx=4)
        self.ent_rl_pct = ttk.Entry(box_rl, width=6)
        self.ent_rl_pct.insert(0, "10")
        self.ent_rl_pct.grid(row=0, column=4, sticky="w", padx=4)

        btn_save_rl = tk.Button(box_rl, text="Apply Return Line", bg="#102e48", fg="#00e5ff", font=("Consolas", 8, "bold"),
                                command=self.apply_return_line)
        btn_save_rl.grid(row=0, column=5, sticky="e", padx=8)

        tk.Label(box_rl, text="* Blocks off 10% of map edge. Crossing blue line completely re-arms aircraft (HP not repaired).",
                 bg="#101c2b", fg="#5a88a0", font=("Consolas", 8)).grid(row=1, column=0, columnspan=6, sticky="w", pady=2)

        box_terrain = tk.LabelFrame(frame, text=" Terrain Features (Islands & Landmasses) ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        box_terrain.pack(fill="both", expand=True, pady=6)

        t_btns = tk.Frame(box_terrain, bg="#101c2b")
        t_btns.pack(fill="x", pady=2)
        tk.Button(t_btns, text="+ Draw Poly Island", bg="#1a3d36", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.start_draw_poly_island).pack(side="left", padx=2)
        tk.Button(t_btns, text="Finish Poly", bg="#00552e", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.finish_polygon_island).pack(side="left", padx=2)
        tk.Button(t_btns, text="+ Add Circular", bg="#183048", fg="#00ffcc", font=("Consolas", 8), command=self.add_island).pack(side="left", padx=2)
        tk.Button(t_btns, text="- Remove Island", bg="#4a1818", fg="#ff8888", font=("Consolas", 8), command=self.delete_selected_island).pack(side="left", padx=2)
        tk.Button(t_btns, text="- Delete Vertex", bg="#3a2210", fg="#ffaa44", font=("Consolas", 8), command=self.delete_selected_vertex).pack(side="left", padx=2)

        self.terrain_listbox = tk.Listbox(box_terrain, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55",
                                          font=("Consolas", 9), height=7, bd=0)
        self.terrain_listbox.pack(fill="both", expand=True, pady=4)
        self.terrain_listbox.bind("<<ListboxSelect>>", self.on_select_island_item)

        prop_frame = tk.Frame(box_terrain, bg="#101c2b")
        prop_frame.pack(fill="x", pady=2)
        tk.Label(prop_frame, text="X:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=0)
        self.ent_isl_x = ttk.Entry(prop_frame, width=8)
        self.ent_isl_x.grid(row=0, column=1, padx=4)
        tk.Label(prop_frame, text="Y:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=2)
        self.ent_isl_y = ttk.Entry(prop_frame, width=8)
        self.ent_isl_y.grid(row=0, column=3, padx=4)
        tk.Label(prop_frame, text="Radius:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=4)
        self.ent_isl_rad = ttk.Entry(prop_frame, width=8)
        self.ent_isl_rad.grid(row=0, column=5, padx=4)
        btn_upd_isl = tk.Button(prop_frame, text="Apply", bg="#1a3248", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.update_island_from_form)
        btn_upd_isl.grid(row=0, column=6, padx=6)

        self.lbl_isl_info = tk.Label(prop_frame, text="Select an island on map or list to inspect", bg="#101c2b", fg="#00e5ff", font=("Consolas", 8))
        self.lbl_isl_info.grid(row=1, column=0, columnspan=7, sticky="w", pady=3)

    def apply_map_resize(self):
        try:
            sz = int(self.ent_map_size.get().strip())
            self.mission["map"]["size"] = sz
            self.mission["map"]["halfMapSize"] = sz * 0.5
            self.redraw_canvas()
            messagebox.showinfo("Resized", f"Map bounds resized to {sz}m x {sz}m.")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def apply_return_line(self):
        try:
            enabled = bool(self.var_rl_enabled.get())
            side = self.cb_rl_side.get()
            pct = float(self.ent_rl_pct.get().strip() or "10") / 100.0
            pct = max(0.04, min(0.30, pct))

            self.mission["map"]["returnLine"] = {
                "enabled": enabled,
                "side": side,
                "offset": pct
            }
            self.redraw_canvas()
            status = f"Return Line {'enabled on ' + side + f' ({int(pct*100)}%)' if enabled else 'disabled'}."
            messagebox.showinfo("Return Line", status)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    # ----------------------------------------------------
    # TAB 2: LAYER 2 - UNITS & SPAWNS
    # ----------------------------------------------------
    def build_tab_units(self):
        frame = tk.Frame(self.tab_units, bg="#0a121c", padx=12, pady=12)
        frame.pack(fill="both", expand=True)

        # 1. Player Spawns
        box_spawns = tk.LabelFrame(frame, text=" Player Spawns (Singleplayer / Multiplayer) ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=6)
        box_spawns.pack(fill="x", pady=4)

        sp_btns = tk.Frame(box_spawns, bg="#101c2b")
        sp_btns.pack(fill="x")
        tk.Button(sp_btns, text="+ Add Spawn Point", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_spawn_point).pack(side="left", padx=2)
        tk.Button(sp_btns, text="Auto-Format Spawns", bg="#15334e", fg="#00e5ff", font=("Consolas", 8, "bold"), command=self.auto_generate_player_spawns).pack(side="left", padx=2)
        tk.Button(sp_btns, text="- Remove", bg="#4a1818", fg="#ff8888", font=("Consolas", 8), command=self.delete_selected_spawn).pack(side="left", padx=2)

        self.spawns_listbox = tk.Listbox(box_spawns, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55", font=("Consolas", 9), height=3, bd=0)
        self.spawns_listbox.pack(fill="x", pady=4)
        self.spawns_listbox.bind("<<ListboxSelect>>", self.on_select_spawn_item)

        # 2. Combat Units List
        box_units = tk.LabelFrame(frame, text=" Combat Units & Story Spawn States ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=6)
        box_units.pack(fill="both", expand=True, pady=4)

        u_btns = tk.Frame(box_units, bg="#101c2b")
        u_btns.pack(fill="x", pady=2)
        tk.Button(u_btns, text="+ Air Unit", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_air_unit).pack(side="left", padx=2)
        tk.Button(u_btns, text="+ SAM Site", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_sam_unit).pack(side="left", padx=2)
        tk.Button(u_btns, text="+ Warship", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_naval_unit).pack(side="left", padx=2)
        tk.Button(u_btns, text="Duplicate", bg="#1f3b58", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.duplicate_unit).pack(side="left", padx=2)
        tk.Button(u_btns, text="Copy", bg="#15283c", fg="#a0d8ef", font=("Consolas", 8), command=self.copy_unit).pack(side="left", padx=2)
        tk.Button(u_btns, text="Paste", bg="#15283c", fg="#a0d8ef", font=("Consolas", 8), command=self.paste_unit).pack(side="left", padx=2)
        tk.Button(u_btns, text="- Remove", bg="#4a1818", fg="#ff8888", font=("Consolas", 8), command=self.delete_selected_unit).pack(side="left", padx=2)

        self.units_listbox = tk.Listbox(box_units, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55", font=("Consolas", 9), height=6, bd=0)
        self.units_listbox.pack(fill="both", expand=True, pady=4)
        self.units_listbox.bind("<<ListboxSelect>>", self.on_select_unit_item)

        # Unit Inspector Panel
        self.u_insp = tk.Frame(box_units, bg="#101c2b", pady=4)
        self.u_insp.pack(fill="x")

        tk.Label(self.u_insp, text="Name:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w")
        self.ent_u_name = ttk.Entry(self.u_insp, width=20)
        self.ent_u_name.grid(row=0, column=1, sticky="w", padx=4)

        tk.Label(self.u_insp, text="AI Level:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=2, sticky="w")
        self.cb_u_ai = ttk.Combobox(self.u_insp, values=AI_LEVELS, state="readonly", width=10)
        self.cb_u_ai.grid(row=0, column=3, sticky="w", padx=4)

        # Dormant / Active Checkbox for story spawn/despawn
        self.var_u_active = tk.BooleanVar(value=True)
        self.cb_u_active = tk.Checkbutton(self.u_insp, text="Active at Start (Uncheck to start dormant/spawned via trigger)",
                                          variable=self.var_u_active, bg="#101c2b", fg="#00ffcc", selectcolor="#005522",
                                          font=("Consolas", 9))
        self.cb_u_active.grid(row=1, column=0, columnspan=4, sticky="w", pady=4)

        # AI Order & Pathing
        tk.Label(self.u_insp, text="AI Order / Path:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=2, column=0, sticky="w")
        self.cb_u_order = ttk.Combobox(self.u_insp, values=AI_ORDER_TYPES, state="readonly", width=18)
        self.cb_u_order.grid(row=2, column=1, sticky="w", padx=4)

        btn_save_u = tk.Button(self.u_insp, text="Apply Unit Changes", bg="#1a3248", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.update_unit_from_form)
        btn_save_u.grid(row=2, column=2, columnspan=2, sticky="e", padx=4)

    # ----------------------------------------------------
    # TAB 3: LAYER 3 - DYNAMICS, DIALOGUE & TRIGGERS
    # ----------------------------------------------------
    def build_tab_dynamics(self):
        canvas = tk.Canvas(self.tab_dynamics, bg="#0a121c", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.tab_dynamics, orient="vertical", command=canvas.yview)
        frame = tk.Frame(canvas, bg="#0a121c", padx=10, pady=10)

        frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 1. Objectives Box
        box_objs = tk.LabelFrame(frame, text=" Mission Objectives (Win / Lose) ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=6)
        box_objs.pack(fill="x", pady=4)

        o_btns = tk.Frame(box_objs, bg="#101c2b")
        o_btns.pack(fill="x")
        tk.Button(o_btns, text="+ Add Objective", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_objective).pack(side="left", padx=2)
        tk.Button(o_btns, text="- Remove", bg="#4a1818", fg="#ff8888", font=("Consolas", 8), command=self.delete_objective).pack(side="left", padx=2)

        self.objs_listbox = tk.Listbox(box_objs, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55", font=("Consolas", 9), height=3, bd=0)
        self.objs_listbox.pack(fill="x", pady=4)

        # 1B. Win & Lose Conditions Panel
        box_conds = tk.LabelFrame(frame, text=" Mission Win / Lose Conditions & Endings ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=6)
        box_conds.pack(fill="x", pady=4)

        f_win = tk.Frame(box_conds, bg="#101c2b")
        f_win.pack(fill="x", pady=2)
        tk.Label(f_win, text="Win Conditions:", bg="#101c2b", fg="#00ff66", font=("Consolas", 9, "bold")).pack(side="left")

        self.var_win_all_primary = tk.BooleanVar(value=True)
        self.chk_win_primary = tk.Checkbutton(f_win, text="All Primary Objectives Completed", variable=self.var_win_all_primary,
                                              bg="#101c2b", fg="#c0f0d0", selectcolor="#005522",
                                              activebackground="#101c2b", activeforeground="#00ffcc", font=("Consolas", 8),
                                              command=self.update_conditions_notes)
        self.chk_win_primary.pack(side="left", padx=6)

        tk.Label(f_win, text="Target Kills:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 8)).pack(side="left", padx=(4, 2))
        self.ent_win_kills = ttk.Entry(f_win, width=5)
        self.ent_win_kills.insert(0, "0")
        self.ent_win_kills.pack(side="left")
        self.ent_win_kills.bind("<KeyRelease>", lambda e: self.update_conditions_notes())

        f_lose = tk.Frame(box_conds, bg="#101c2b")
        f_lose.pack(fill="x", pady=2)
        tk.Label(f_lose, text="Lose Conditions:", bg="#101c2b", fg="#ff4444", font=("Consolas", 9, "bold")).pack(side="left")

        self.var_lose_destroyed = tk.BooleanVar(value=True)
        self.chk_lose_destroyed = tk.Checkbutton(f_lose, text="Player Aircraft Destroyed / Crashed", variable=self.var_lose_destroyed,
                                                 bg="#101c2b", fg="#c0f0d0", selectcolor="#550000",
                                                 activebackground="#101c2b", activeforeground="#ff8888", font=("Consolas", 8),
                                                 command=self.update_conditions_notes)
        self.chk_lose_destroyed.pack(side="left", padx=6)

        self.chk_cond_no_respawn = tk.Checkbutton(
            f_lose, text="[No Respawn]", variable=self.var_no_respawn,
            bg="#101c2b", fg="#ff7766", selectcolor="#440000",
            activebackground="#101c2b", activeforeground="#ff9988", font=("Consolas", 8, "bold"),
            command=self.update_conditions_notes
        )
        self.chk_cond_no_respawn.pack(side="left", padx=4)

        tk.Label(f_lose, text="Time Limit (s):", bg="#101c2b", fg="#88c0a0", font=("Consolas", 8)).pack(side="left", padx=(4, 2))
        self.ent_lose_time = ttk.Entry(f_lose, width=6)
        self.ent_lose_time.insert(0, "0")
        self.ent_lose_time.pack(side="left")
        self.ent_lose_time.bind("<KeyRelease>", lambda e: self.update_conditions_notes())

        self.lbl_conds_status = tk.Label(box_conds, text="", bg="#101c2b", fg="#88b0a0", font=("Consolas", 8), wraplength=480, justify="left")
        self.lbl_conds_status.pack(fill="x", pady=2)

        # 2. Operational Areas (Trigger Zones) Box
        box_areas = tk.LabelFrame(frame, text=" Operational Areas & Trigger Zones (Invisible In-Game) ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=6)
        box_areas.pack(fill="x", pady=4)

        a_btns = tk.Frame(box_areas, bg="#101c2b")
        a_btns.pack(fill="x")
        tk.Button(a_btns, text="+ Add Area", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_new_area_button).pack(side="left", padx=2)
        tk.Button(a_btns, text="Duplicate", bg="#1f3b58", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.duplicate_area).pack(side="left", padx=2)
        tk.Button(a_btns, text="- Delete", bg="#331111", fg="#ff6666", font=("Consolas", 8), command=self.delete_area).pack(side="left", padx=2)

        self.areas_listbox = tk.Listbox(box_areas, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55", font=("Consolas", 9), height=3, bd=0)
        self.areas_listbox.pack(fill="x", pady=4)
        self.areas_listbox.bind("<<ListboxSelect>>", self.on_select_area_item)

        # Area Inspector inside box_areas
        self.area_insp = tk.Frame(box_areas, bg="#101c2b", pady=2)
        self.area_insp.pack(fill="x")

        tk.Label(self.area_insp, text="Area ID:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w")
        self.ent_area_id = ttk.Entry(self.area_insp, width=16)
        self.ent_area_id.grid(row=0, column=1, sticky="w", padx=4, pady=2)

        tk.Label(self.area_insp, text="Area Name:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=2, sticky="w")
        self.ent_area_name = ttk.Entry(self.area_insp, width=22)
        self.ent_area_name.grid(row=0, column=3, sticky="w", padx=4, pady=2)

        tk.Label(self.area_insp, text="Center X / Y:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=1, column=0, sticky="w")
        a_xy_frame = tk.Frame(self.area_insp, bg="#101c2b")
        a_xy_frame.grid(row=1, column=1, sticky="w", padx=4, pady=2)
        self.ent_area_x = ttk.Entry(a_xy_frame, width=7)
        self.ent_area_x.pack(side="left")
        self.ent_area_y = ttk.Entry(a_xy_frame, width=7)
        self.ent_area_y.pack(side="left", padx=2)

        tk.Label(self.area_insp, text="Radius (m):", bg="#101c2b", fg="#00ffcc", font=("Consolas", 9, "bold")).grid(row=1, column=2, sticky="w")
        r_frame = tk.Frame(self.area_insp, bg="#101c2b")
        r_frame.grid(row=1, column=3, sticky="w", padx=4, pady=2)
        self.ent_area_radius = ttk.Entry(r_frame, width=8)
        self.ent_area_radius.pack(side="left")
        tk.Button(r_frame, text="-250", bg="#182c40", fg="#00ffcc", font=("Consolas", 7), command=lambda: self.nudge_area_radius(-250)).pack(side="left", padx=1)
        tk.Button(r_frame, text="+250", bg="#182c40", fg="#00ffcc", font=("Consolas", 7), command=lambda: self.nudge_area_radius(250)).pack(side="left", padx=1)

        tk.Label(self.area_insp, text="Theme Color:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=2, column=0, sticky="w")
        self.cb_area_color = ttk.Combobox(self.area_insp, values=["#00e5ff", "#00ff66", "#ffaa00", "#ff00aa", "#3388ff", "#ffff00"], state="readonly", width=14)
        self.cb_area_color.grid(row=2, column=1, sticky="w", padx=4, pady=2)
        self.cb_area_color.set("#00e5ff")

        btn_save_area = tk.Button(self.area_insp, text="Apply Area Changes", bg="#1a3248", fg="#00ffcc", font=("Consolas", 8, "bold"),
                                  command=self.update_area_from_form)
        btn_save_area.grid(row=2, column=3, sticky="e", padx=4, pady=2)

        # 3. Triggers List Box
        box_trigs = tk.LabelFrame(frame, text=" Scripted Triggers & Story Events ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=6)
        box_trigs.pack(fill="x", pady=4)

        t_btns = tk.Frame(box_trigs, bg="#101c2b")
        t_btns.pack(fill="x")
        tk.Button(t_btns, text="+ Dialogue", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_dialogue_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="+ Area Trigger", bg="#1a3848", fg="#00e5ff", font=("Consolas", 8, "bold"), command=self.add_area_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="+ Fade to Black", bg="#122538", fg="#00eeff", font=("Consolas", 8, "bold"), command=self.add_fade_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="+ Scripted End", bg="#123542", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.add_scripted_end_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="+ Nuke", bg="#3a2818", fg="#ffaa00", font=("Consolas", 8, "bold"), command=self.add_nuke_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="+ Explode", bg="#4a1818", fg="#ff8888", font=("Consolas", 8), command=self.add_explode_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="Duplicate", bg="#1f3b58", fg="#00ffcc", font=("Consolas", 8, "bold"), command=self.duplicate_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="Copy", bg="#15283c", fg="#a0d8ef", font=("Consolas", 8), command=self.copy_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="Paste", bg="#15283c", fg="#a0d8ef", font=("Consolas", 8), command=self.paste_trigger).pack(side="left", padx=2)
        tk.Button(t_btns, text="- Delete", bg="#331111", fg="#ff6666", font=("Consolas", 8), command=self.delete_trigger).pack(side="left", padx=2)

        self.trigs_listbox = tk.Listbox(box_trigs, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55", font=("Consolas", 9), height=4, bd=0)
        self.trigs_listbox.pack(fill="x", pady=4)
        self.trigs_listbox.bind("<<ListboxSelect>>", self.on_select_trigger_item)

        # 4. Trigger & Dialogue Action Inspector
        self.trig_insp = tk.LabelFrame(frame, text=" Trigger & Action Inspector ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        self.trig_insp.pack(fill="x", pady=6)

        tk.Label(self.trig_insp, text="Trigger Name:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w")
        self.ent_trig_name = ttk.Entry(self.trig_insp, width=24)
        self.ent_trig_name.grid(row=0, column=1, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Condition Event:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=0, column=2, sticky="w")
        self.cb_trig_event = ttk.Combobox(self.trig_insp, values=TRIGGER_EVENTS, state="readonly", width=18)
        self.cb_trig_event.grid(row=0, column=3, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Action Type:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=1, column=0, sticky="w")
        self.cb_act_type = ttk.Combobox(self.trig_insp, values=TRIGGER_ACTIONS, state="readonly", width=20)
        self.cb_act_type.grid(row=1, column=1, sticky="w", padx=4, pady=2)

        # Dialogue-specific fields
        tk.Label(self.trig_insp, text="Speaker Callsign:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=2, column=0, sticky="w")
        self.ent_dia_speaker = ttk.Entry(self.trig_insp, width=16)
        self.ent_dia_speaker.grid(row=2, column=1, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Aircraft / Role:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=2, column=2, sticky="w")
        self.ent_dia_craft = ttk.Entry(self.trig_insp, width=16)
        self.ent_dia_craft.grid(row=2, column=3, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Squadron / Unit:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=3, column=0, sticky="w")
        self.ent_dia_sq = ttk.Entry(self.trig_insp, width=20)
        self.ent_dia_sq.grid(row=3, column=1, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Duration (s):", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=3, column=2, sticky="w")
        self.ent_dia_dur = ttk.Entry(self.trig_insp, width=8)
        self.ent_dia_dur.grid(row=3, column=3, sticky="w", padx=4, pady=2)

        # Portrait row with preview canvas
        tk.Label(self.trig_insp, text="Portrait Image:", bg="#101c2b", fg="#00ffcc", font=("Consolas", 9, "bold")).grid(row=4, column=0, sticky="w")
        port_frame = tk.Frame(self.trig_insp, bg="#101c2b")
        port_frame.grid(row=4, column=1, columnspan=2, sticky="w", padx=4, pady=2)
        self.ent_dia_portrait = ttk.Entry(port_frame, width=24)
        self.ent_dia_portrait.pack(side="left")
        self.ent_dia_portrait.bind("<KeyRelease>", lambda e: self.update_portrait_preview())
        tk.Button(port_frame, text="Browse...", bg="#1a2e44", fg="#00ffcc", font=("Consolas", 8), command=self.browse_portrait).pack(side="left", padx=3)
        tk.Button(port_frame, text="Clear", bg="#3a1a1a", fg="#ff8888", font=("Consolas", 8), command=self.clear_portrait).pack(side="left")

        # Portrait thumbnail preview canvas
        self.dia_portrait_canvas = tk.Canvas(self.trig_insp, width=64, height=64, bg="#05121a", highlightthickness=1, highlightbackground="#00ff66")
        self.dia_portrait_canvas.grid(row=4, column=3, rowspan=2, sticky="w", padx=6, pady=2)

        tk.Label(self.trig_insp, text="Dialogue Text:", bg="#101c2b", fg="#00ffcc", font=("Consolas", 9, "bold")).grid(row=5, column=0, sticky="nw", pady=4)
        self.txt_dia_body = tk.Text(self.trig_insp, height=3, width=38, bg="#132030", fg="#ffffff", font=("Consolas", 9))
        self.txt_dia_body.grid(row=5, column=1, columnspan=2, sticky="w", padx=4, pady=4)

        # Row 6: Area Target / Trigger Zone Selector & Target Unit ID
        tk.Label(self.trig_insp, text="Area (Zone/Target):", bg="#101c2b", fg="#00e5ff", font=("Consolas", 9, "bold")).grid(row=6, column=0, sticky="w")
        self.cb_trig_area = ttk.Combobox(self.trig_insp, values=[], state="readonly", width=22)
        self.cb_trig_area.grid(row=6, column=1, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Target Unit ID:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=6, column=2, sticky="w")
        self.ent_act_target = ttk.Entry(self.trig_insp, width=16)
        self.ent_act_target.grid(row=6, column=3, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Action X / Y:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=7, column=0, sticky="w")
        xy_frame = tk.Frame(self.trig_insp, bg="#101c2b")
        xy_frame.grid(row=7, column=1, sticky="w", padx=4)
        self.ent_act_x = ttk.Entry(xy_frame, width=7)
        self.ent_act_x.pack(side="left")
        self.ent_act_y = ttk.Entry(xy_frame, width=7)
        self.ent_act_y.pack(side="left", padx=2)

        # Fade to Black / Sector Transition fields
        tk.Label(self.trig_insp, text="Sector Title:", bg="#101c2b", fg="#00e5ff", font=("Consolas", 9)).grid(row=7, column=2, sticky="w")
        self.ent_fade_title = ttk.Entry(self.trig_insp, width=16)
        self.ent_fade_title.grid(row=7, column=3, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Subtitle / Time:", bg="#101c2b", fg="#00e5ff", font=("Consolas", 9)).grid(row=8, column=0, sticky="w")
        self.ent_fade_subtitle = ttk.Entry(self.trig_insp, width=20)
        self.ent_fade_subtitle.grid(row=8, column=1, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Spawn Unit IDs:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=8, column=2, sticky="w")
        self.ent_fade_spawn = ttk.Entry(self.trig_insp, width=16)
        self.ent_fade_spawn.grid(row=8, column=3, sticky="w", padx=4, pady=2)

        tk.Label(self.trig_insp, text="Despawn IDs:", bg="#101c2b", fg="#88c0a0", font=("Consolas", 9)).grid(row=9, column=0, sticky="w")
        self.ent_fade_despawn = ttk.Entry(self.trig_insp, width=20)
        self.ent_fade_despawn.grid(row=9, column=1, sticky="w", padx=4, pady=2)

        btn_save_trig = tk.Button(self.trig_insp, text="Apply Trigger Changes", bg="#1a3248", fg="#00ffcc", font=("Consolas", 9, "bold"),
                                  command=self.update_trigger_from_form)
        btn_save_trig.grid(row=9, column=2, columnspan=2, sticky="e", padx=4, pady=6)

    # ----------------------------------------------------
    # MISSION MODE & LOADOUT MANAGEMENT
    # ----------------------------------------------------
    def on_mission_type_changed(self, event=None):
        m_type = self.cb_mission_type.get()
        self.mission["missionType"] = m_type
        if m_type == "multiplayer":
            if hasattr(self, "var_no_respawn"):
                self.var_no_respawn.set(False)
            self.lbl_mode_badge.config(text="[ MULTIPLAYER COMBAT THEATER ]", fg="#00e5ff")
            self.lbl_mp_players.grid()
            self.spin_player_count.grid()
            self.btn_gen_spawns.grid()
            self.lbl_spawns_status.grid()
            self.lbl_sp_loadout.grid_remove()
            self.cb_loadout_mode.grid_remove()
            self.f_forced_loadout.grid_remove()
            self.chk_no_respawn.grid_remove()
            if hasattr(self, "chk_cond_no_respawn"):
                self.chk_cond_no_respawn.pack_forget()
            self.lbl_mode_notes.config(
                text="* MULTIPLAYER RULES: Always uses player's equipped hangar aircraft & loadout. Requires spawns for all players, plus at least 1 valid win and 1 lose condition.",
                fg="#00e5ff"
            )
        else:
            self.lbl_mode_badge.config(text="[ SINGLEPLAYER CAMPAIGN / SORTIE ]", fg="#00ff66")
            self.lbl_mp_players.grid_remove()
            self.spin_player_count.grid_remove()
            self.btn_gen_spawns.grid_remove()
            self.lbl_spawns_status.grid_remove()
            self.lbl_sp_loadout.grid()
            self.cb_loadout_mode.grid()
            self.chk_no_respawn.grid()
            if hasattr(self, "chk_cond_no_respawn"):
                self.chk_cond_no_respawn.pack(side="left", padx=4)
            self.on_loadout_mode_changed()
            self.lbl_mode_notes.config(
                text="* SINGLEPLAYER RULES: Can use player loadout or force a specific plane/loadout. Can end with scripted ending (Trigger: SCRIPTED_END) without real win/loss (win/loss also ends mission if configured).",
                fg="#88a898"
            )
        self.update_spawns_status()
        self.update_conditions_notes()
        self.redraw_canvas()

    def on_loadout_mode_changed(self, event=None):
        if self.cb_loadout_mode.get() == "Forced Aircraft & Loadout":
            self.f_forced_loadout.grid()
        else:
            self.f_forced_loadout.grid_remove()

    def on_player_count_changed(self, event=None):
        self.update_spawns_status()
        self.redraw_canvas()

    def update_spawns_status(self):
        if not hasattr(self, "cb_mission_type"): return
        is_mp = (self.cb_mission_type.get() == "multiplayer")
        spawns = self.mission.get("units", {}).get("playerSpawns", [])
        if is_mp:
            try:
                req = int(self.spin_player_count.get() or "4")
            except Exception:
                req = 4
            cur = len(spawns)
            if cur >= req:
                self.lbl_spawns_status.config(text=f"Spawns: {cur}/{req} [READY]", fg="#00ff66")
            else:
                self.lbl_spawns_status.config(text=f"Spawns: {cur}/{req} [NEEDS {req - cur} MORE]", fg="#ff4444")
        else:
            self.lbl_spawns_status.config(text=f"Spawns: {len(spawns)} [SP Primary]", fg="#00ffcc")

    def update_conditions_notes(self, event=None):
        if not hasattr(self, "cb_mission_type"): return
        is_mp = (self.cb_mission_type.get() == "multiplayer")
        try:
            req_kills = int(self.ent_win_kills.get().strip() or "0")
        except ValueError:
            req_kills = 0
        try:
            time_lim = int(self.ent_lose_time.get().strip() or "0")
        except ValueError:
            time_lim = 0

        has_win = bool(self.var_win_all_primary.get()) or (req_kills > 0)
        has_lose = bool(self.var_lose_destroyed.get()) or (time_lim > 0)

        if is_mp:
            if has_win and has_lose:
                self.lbl_conds_status.config(text="[OK] Multiplayer Win & Lose conditions verified and active.", fg="#00ff66")
            else:
                missing = []
                if not has_win: missing.append("Win Condition")
                if not has_lose: missing.append("Lose Condition")
                self.lbl_conds_status.config(text=f"[!] MULTIPLAYER ERROR: Missing required {', '.join(missing)}.", fg="#ff4444")
        else:
            if hasattr(self, "var_no_respawn") and self.var_no_respawn.get():
                self.lbl_conds_status.config(text="[SP - NO RESPAWN] Strict sortie mode: Mission fails immediately upon pilot shootdown or crash.", fg="#ff6666")
            elif has_win or has_lose:
                self.lbl_conds_status.config(text="[SP] Formal Win/Lose conditions active (will conclude mission upon trigger).", fg="#88b0a0")
            else:
                self.lbl_conds_status.config(text="[SP] Free-flight / Scripted ending mode. Conclude via trigger action 'SCRIPTED_END'.", fg="#00e5ff")

    def auto_generate_player_spawns(self):
        try:
            count = int(self.spin_player_count.get() if hasattr(self, "spin_player_count") else 4)
        except Exception:
            count = 4
        count = max(2, min(16, count))

        spawns = self.mission.get("units", {}).get("playerSpawns", [])
        base_x = spawns[0].get("x", 0.0) if spawns else 0.0
        base_y = spawns[0].get("y", 0.0) if spawns else 0.0
        base_heading = spawns[0].get("heading", -0.785) if spawns else -0.785
        base_speed = spawns[0].get("speed", 335) if spawns else 335

        perp_heading = base_heading + math.pi / 2

        new_spawns = []
        for i in range(count):
            slot_num = i + 1
            step = (i + 1) // 2 * (1 if i % 2 == 1 else -1)
            lat_dist = step * 180.0
            long_dist = -abs(step) * 60.0

            px = base_x + math.cos(perp_heading) * lat_dist + math.cos(base_heading) * long_dist
            py = base_y + math.sin(perp_heading) * lat_dist + math.sin(base_heading) * long_dist

            new_spawns.append({
                "id": f"spawn_p{slot_num}",
                "team": "friendly",
                "x": round(px, 1),
                "y": round(py, 1),
                "heading": round(base_heading, 3),
                "speed": base_speed,
                "altitude": 1.0,
                "isPrimary": (i == 0),
                "allowedTags": []
            })

        self.mission["units"]["playerSpawns"] = new_spawns
        self.populate_form_from_mission()
        self.redraw_canvas()
        messagebox.showinfo("Spawns Generated", f"Generated {count} tactical formation player spawns for multiplayer.")

    def add_scripted_end_trigger(self):
        trigs = self.mission["dynamics"].setdefault("triggers", [])
        new_trig = {
            "id": f"trig_end_{len(trigs) + 1}",
            "name": f"Scripted Mission Ending #{len(trigs) + 1}",
            "event": "ON_START",
            "actions": [
                {
                    "type": "SCRIPTED_END",
                    "title": "OPERATION CONCLUDED",
                    "text": "HQ // Tactical sortie objectives completed. RTB approved.",
                    "fadeTime": 2.0
                }
            ]
        }
        trigs.append(new_trig)
        self.selected_trigger_idx = len(trigs) - 1
        self.populate_form_from_mission()

    # ----------------------------------------------------
    # DATA POPULATION & SYNCHRONIZATION
    # ----------------------------------------------------
    def populate_form_from_mission(self):
        m = self.mission.get("map", {})
        self.ent_map_size.delete(0, tk.END)
        self.ent_map_size.insert(0, str(m.get("size", 30150)))

        self.ent_mission_id.delete(0, tk.END)
        self.ent_mission_id.insert(0, str(m.get("id", "test_flight")))

        # Mission Mode & Loadout Synchronization
        m_type = self.mission.get("missionType", "singleplayer")
        self.cb_mission_type.set(m_type)

        p_count = self.mission.get("playerCount", 4 if m_type == "multiplayer" else 1)
        self.spin_player_count.delete(0, tk.END)
        self.spin_player_count.insert(0, str(p_count))

        loadout = self.mission.get("loadout", {})
        l_mode = loadout.get("mode", "player")
        if l_mode == "forced":
            self.cb_loadout_mode.set("Forced Aircraft & Loadout")
            self.cb_forced_plane.set(loadout.get("aircraft", "f15c"))
            self.cb_forced_spw.set(loadout.get("specialWeapon", "qaam"))
        else:
            self.cb_loadout_mode.set("Player Loadout")

        self.on_mission_type_changed()

        # Return Line settings
        rl = m.get("returnLine", {})
        self.var_rl_enabled.set(bool(rl.get("enabled", False)))
        self.cb_rl_side.set(rl.get("side", "bottom"))
        self.ent_rl_pct.delete(0, tk.END)
        self.ent_rl_pct.insert(0, str(int(rl.get("offset", 0.10) * 100)))

        # Terrain list
        self.terrain_listbox.delete(0, tk.END)
        for i, t in enumerate(m.get("terrain", [])):
            pts = t.get("points")
            if pts and len(pts) >= 3:
                self.terrain_listbox.insert(tk.END, f"[POLY] {t.get('id', f'poly_{i}')} | {len(pts)} pts | pos: ({int(t.get('x',0))}, {int(t.get('y',0))}) rad: {int(t.get('radius',300))}")
            else:
                self.terrain_listbox.insert(tk.END, f"[CIRC] {t.get('id', f'isl_{i}')} | pos: ({int(t.get('x',0))}, {int(t.get('y',0))}) rad: {int(t.get('radius',300))}")

        # Spawns list
        u = self.mission.get("units", {})
        self.spawns_listbox.delete(0, tk.END)
        for i, s in enumerate(u.get("playerSpawns", [])):
            prim = "[PRIMARY]" if s.get("isPrimary") else ""
            self.spawns_listbox.insert(tk.END, f"P{i+1} {s.get('id')} {prim} | ({int(s.get('x',0))}, {int(s.get('y',0))})")

        # Units list
        self.units_listbox.delete(0, tk.END)
        for a in u.get("airUnits", []):
            dorm = " [DORMANT]" if (a.get("active") is False or a.get("spawned") is False) else ""
            self.units_listbox.insert(tk.END, f"[AIR] {a.get('name', 'Plane')} ({int(a.get('x',0))}, {int(a.get('y',0))}){dorm}")
        for g in u.get("groundUnits", []):
            dorm = " [DORMANT]" if (g.get("active") is False or g.get("spawned") is False) else ""
            self.units_listbox.insert(tk.END, f"[GND] {g.get('name', 'SAM')} ({int(g.get('x',0))}, {int(g.get('y',0))}){dorm}")
        for n in u.get("navalUnits", []):
            dorm = " [DORMANT]" if (n.get("active") is False or n.get("spawned") is False) else ""
            self.units_listbox.insert(tk.END, f"[NAV] {n.get('name', 'Ship')} ({int(n.get('x',0))}, {int(n.get('y',0))}){dorm}")

        # Objectives & Triggers
        d = self.mission.get("dynamics", {})
        self.objs_listbox.delete(0, tk.END)
        for o in d.get("objectives", []):
            self.objs_listbox.insert(tk.END, f"OBJ: {o.get('title')} ({o.get('type')})")

        # Win & Lose conditions
        wc = d.get("winConditions", {})
        self.var_win_all_primary.set(bool(wc.get("allPrimaryComplete", True)))
        self.ent_win_kills.delete(0, tk.END)
        self.ent_win_kills.insert(0, str(wc.get("requiredKills", 0)))

        lc = d.get("loseConditions", {})
        self.var_lose_destroyed.set(bool(lc.get("playerDestroyed", True)))
        self.ent_lose_time.delete(0, tk.END)
        self.ent_lose_time.insert(0, str(lc.get("timeLimit", 0)))

        no_resp = bool(self.mission.get("noRespawn", False) or lc.get("noRespawn", False))
        if hasattr(self, "var_no_respawn"):
            self.var_no_respawn.set(no_resp)

        self.update_conditions_notes()
        self.update_spawns_status()

        # Operational Areas
        areas = d.setdefault("areas", [])
        self.areas_listbox.delete(0, tk.END)
        for a in areas:
            self.areas_listbox.insert(tk.END, f"{a.get('id', 'area').ljust(12)} | {a.get('name', 'Area')} [R={int(a.get('radius', 2000))}m]")

        # Update Area Combobox values in trigger inspector
        area_vals = [f"{a['id']} - {a.get('name', 'Area')}" for a in areas]
        self.cb_trig_area["values"] = area_vals

        self.trigs_listbox.delete(0, tk.END)
        for tr in d.get("triggers", []):
            acts = tr.get("actions", [])
            act_types = ",".join([a.get("type", "") for a in acts])
            self.trigs_listbox.insert(tk.END, f"{tr.get('name')} [{tr.get('event')}] -> {act_types}")

        # Restore selection in listboxes if an entity is currently selected
        if self.selected_item:
            layer, kind, s_idx = self.selected_item
            if layer == "map" and kind == "island":
                if s_idx < len(m.get("terrain", [])):
                    self.terrain_listbox.selection_clear(0, tk.END)
                    self.terrain_listbox.selection_set(s_idx)
                    self.terrain_listbox.activate(s_idx)
                    self.terrain_listbox.see(s_idx)
            elif layer == "units":
                if kind == "spawn":
                    if s_idx < len(u.get("playerSpawns", [])):
                        self.spawns_listbox.selection_clear(0, tk.END)
                        self.spawns_listbox.selection_set(s_idx)
                        self.spawns_listbox.activate(s_idx)
                        self.spawns_listbox.see(s_idx)
                elif kind in ("air", "ground", "naval"):
                    air_len = len(u.get("airUnits", []))
                    gnd_len = len(u.get("groundUnits", []))
                    nav_len = len(u.get("navalUnits", []))
                    list_idx = -1
                    if kind == "air" and s_idx < air_len:
                        list_idx = s_idx
                    elif kind == "ground" and s_idx < gnd_len:
                        list_idx = air_len + s_idx
                    elif kind == "naval" and s_idx < nav_len:
                        list_idx = air_len + gnd_len + s_idx
                    if list_idx >= 0 and list_idx < (air_len + gnd_len + nav_len):
                        self.units_listbox.selection_clear(0, tk.END)
                        self.units_listbox.selection_set(list_idx)
                        self.units_listbox.activate(list_idx)
                        self.units_listbox.see(list_idx)
            elif layer == "dynamics" and kind == "area":
                if s_idx < len(areas):
                    self.areas_listbox.selection_clear(0, tk.END)
                    self.areas_listbox.selection_set(s_idx)
                    self.areas_listbox.activate(s_idx)
                    self.areas_listbox.see(s_idx)

        # Restore trigger selection
        if self.selected_trigger_idx is not None and self.selected_trigger_idx < len(d.get("triggers", [])):
            self.trigs_listbox.selection_clear(0, tk.END)
            self.trigs_listbox.selection_set(self.selected_trigger_idx)
            self.trigs_listbox.activate(self.selected_trigger_idx)
            self.trigs_listbox.see(self.selected_trigger_idx)

        self.redraw_canvas()

    def select_island(self, idx, vertex_idx=None):
        terrain = self.mission["map"].get("terrain", [])
        if idx >= len(terrain):
            return
        isl = terrain[idx]
        self.selected_item = ("map", "island", idx)
        self.selected_vertex_idx = vertex_idx

        # Clear other layer listboxes
        self.spawns_listbox.selection_clear(0, tk.END)
        self.units_listbox.selection_clear(0, tk.END)

        # Select & scroll into view in terrain listbox
        self.terrain_listbox.selection_clear(0, tk.END)
        self.terrain_listbox.selection_set(idx)
        self.terrain_listbox.activate(idx)
        self.terrain_listbox.see(idx)

        # Populate form fields
        self.ent_isl_x.delete(0, tk.END)
        self.ent_isl_x.insert(0, str(int(isl.get("x", 0))))
        self.ent_isl_y.delete(0, tk.END)
        self.ent_isl_y.insert(0, str(int(isl.get("y", 0))))
        self.ent_isl_rad.delete(0, tk.END)
        self.ent_isl_rad.insert(0, str(int(isl.get("radius", 350))))
        pts = isl.get("points")
        if pts:
            self.lbl_isl_info.config(text=f"[POLYGON] {len(pts)} vertices | Bounding Rad: {int(isl.get('radius', 350))}m")
        else:
            self.lbl_isl_info.config(text=f"[CIRCULAR] Radius: {int(isl.get('radius', 350))}m")
        self.redraw_canvas()

    def on_select_island_item(self, event):
        sel = self.terrain_listbox.curselection()
        if not sel: return
        self.select_island(sel[0])

    def update_island_from_form(self):
        if not self.selected_item or self.selected_item[1] != "island": return
        idx = self.selected_item[2]
        terrain = self.mission["map"].get("terrain", [])
        if idx < len(terrain):
            new_x = float(self.ent_isl_x.get() or 0)
            new_y = float(self.ent_isl_y.get() or 0)
            dx = new_x - terrain[idx].get("x", 0)
            dy = new_y - terrain[idx].get("y", 0)
            terrain[idx]["x"] = new_x
            terrain[idx]["y"] = new_y
            terrain[idx]["radius"] = float(self.ent_isl_rad.get() or 350)
            # Offset all vertices if this is a polygon island
            if terrain[idx].get("points"):
                for pt in terrain[idx]["points"]:
                    pt[0] = round(pt[0] + dx, 1)
                    pt[1] = round(pt[1] + dy, 1)
            self.populate_form_from_mission()

    def select_unit(self, kind, idx):
        self.selected_item = ("units", kind, idx)
        self.selected_vertex_idx = None
        self.terrain_listbox.selection_clear(0, tk.END)

        u = self.mission.get("units", {})
        if kind == "spawn":
            self.units_listbox.selection_clear(0, tk.END)
            self.spawns_listbox.selection_clear(0, tk.END)
            spawns = u.get("playerSpawns", [])
            if idx < len(spawns):
                self.spawns_listbox.selection_set(idx)
                self.spawns_listbox.activate(idx)
                self.spawns_listbox.see(idx)
        elif kind in ("air", "ground", "naval"):
            self.spawns_listbox.selection_clear(0, tk.END)
            air_len = len(u.get("airUnits", []))
            gnd_len = len(u.get("groundUnits", []))
            nav_len = len(u.get("navalUnits", []))

            list_idx = -1
            unit = None
            if kind == "air" and idx < air_len:
                list_idx = idx
                unit = u["airUnits"][idx]
            elif kind == "ground" and idx < gnd_len:
                list_idx = air_len + idx
                unit = u["groundUnits"][idx]
            elif kind == "naval" and idx < nav_len:
                list_idx = air_len + gnd_len + idx
                unit = u["navalUnits"][idx]

            self.units_listbox.selection_clear(0, tk.END)
            if list_idx >= 0:
                self.units_listbox.selection_set(list_idx)
                self.units_listbox.activate(list_idx)
                self.units_listbox.see(list_idx)

            if unit:
                self.ent_u_name.delete(0, tk.END)
                self.ent_u_name.insert(0, unit.get("name", ""))
                self.cb_u_ai.set(unit.get("aiType", "rookie"))
                orders = unit.get("orders", {})
                self.cb_u_order.set(orders.get("type", "PATROL_AREA"))
                is_active = unit.get("active", True) if unit.get("spawned") is None else unit.get("spawned", True)
                self.var_u_active.set(bool(is_active))
        self.redraw_canvas()

    def on_select_spawn_item(self, event):
        sel = self.spawns_listbox.curselection()
        if not sel: return
        self.select_unit("spawn", sel[0])

    def on_select_unit_item(self, event):
        sel = self.units_listbox.curselection()
        if not sel: return
        idx = sel[0]
        u = self.mission.get("units", {})
        air_len = len(u.get("airUnits", []))
        gnd_len = len(u.get("groundUnits", []))
        nav_len = len(u.get("navalUnits", []))

        if idx < air_len:
            self.select_unit("air", idx)
        elif idx < air_len + gnd_len:
            self.select_unit("ground", idx - air_len)
        elif idx < air_len + gnd_len + nav_len:
            self.select_unit("naval", idx - air_len - gnd_len)

    def update_unit_from_form(self):
        if not self.selected_item or self.selected_item[0] != "units": return
        u_type = self.selected_item[1]
        idx = self.selected_item[2]
        u = self.mission.get("units", {})
        key = f"{u_type}Units"
        if key in u and idx < len(u[key]):
            unit = u[key][idx]
            unit["name"] = self.ent_u_name.get().strip()
            unit["aiType"] = self.cb_u_ai.get()
            unit["active"] = bool(self.var_u_active.get())
            unit["orders"] = {"type": self.cb_u_order.get()}
            self.populate_form_from_mission()

    def on_select_trigger_item(self, event):
        sel = self.trigs_listbox.curselection()
        idx = sel[0] if sel else self.selected_trigger_idx
        if idx is None: return
        self.selected_trigger_idx = idx
        trigs = self.mission["dynamics"].get("triggers", [])
        if idx < len(trigs):
            trig = trigs[idx]
            self.ent_trig_name.delete(0, tk.END)
            self.ent_trig_name.insert(0, trig.get("name", ""))
            self.cb_trig_event.set(trig.get("event", "ON_START"))

            acts = trig.get("actions", [])
            dia_act = next((a for a in acts if a.get("type") == "DIALOGUE"), None)
            act = dia_act if dia_act else (acts[0] if len(acts) > 0 else {})
            act_type = act.get("type", "RADIO_MESSAGE")
            self.cb_act_type.set(act_type)

            # Populate dialogue fields from dialogue action if present
            d_source = dia_act or act
            self.ent_dia_speaker.delete(0, tk.END)
            self.ent_dia_speaker.insert(0, str(d_source.get("speaker", "PIXY")))
            self.ent_dia_craft.delete(0, tk.END)
            self.ent_dia_craft.insert(0, str(d_source.get("aircraft", "F-15C")))
            self.ent_dia_sq.delete(0, tk.END)
            self.ent_dia_sq.insert(0, str(d_source.get("squadron", "1ST BUDDY AIRFORCE")))
            self.ent_dia_dur.delete(0, tk.END)
            self.ent_dia_dur.insert(0, str(d_source.get("duration", 5.5)))

            port_val = d_source.get("portrait", "")
            self.ent_dia_portrait.delete(0, tk.END)
            self.ent_dia_portrait.insert(0, str(port_val))
            self.update_portrait_preview()

            self.txt_dia_body.delete("1.0", tk.END)
            self.txt_dia_body.insert("1.0", str(d_source.get("text", "")))

            # Area association
            trig_area = trig.get("areaId") or act.get("areaId") or ""
            matched = False
            for val in self.cb_trig_area["values"]:
                if trig_area and (val == trig_area or val.startswith(trig_area + " ") or val.startswith(trig_area + "-")):
                    self.cb_trig_area.set(val)
                    matched = True
                    break
            if not matched:
                self.cb_trig_area.set(trig_area)

            tgt_val = trig.get("targetId") or act.get("unitId") or act.get("targetId") or ""
            self.ent_act_target.delete(0, tk.END)
            self.ent_act_target.insert(0, str(tgt_val))

            self.ent_act_x.delete(0, tk.END)
            self.ent_act_x.insert(0, str(int(act.get("x", 0))))
            self.ent_act_y.delete(0, tk.END)
            self.ent_act_y.insert(0, str(int(act.get("y", 0))))

            # Populate fade transition fields
            self.ent_fade_title.delete(0, tk.END)
            self.ent_fade_title.insert(0, str(act.get("title", "")))
            self.ent_fade_subtitle.delete(0, tk.END)
            self.ent_fade_subtitle.insert(0, str(act.get("subtitle", "")))
            self.ent_fade_spawn.delete(0, tk.END)
            self.ent_fade_spawn.insert(0, ",".join(act.get("spawnUnits", [])))
            self.ent_fade_despawn.delete(0, tk.END)
            self.ent_fade_despawn.insert(0, ",".join(act.get("despawnUnits", [])))

            if act_type == "SCRIPTED_END":
                self.ent_fade_title.delete(0, tk.END)
                self.ent_fade_title.insert(0, str(act.get("title", "OPERATION CONCLUDED")))
                self.txt_dia_body.delete("1.0", tk.END)
                self.txt_dia_body.insert("1.0", str(act.get("text", "")))
                self.ent_dia_dur.delete(0, tk.END)
                self.ent_dia_dur.insert(0, str(act.get("fadeTime", 2.0)))

    def update_trigger_from_form(self):
        if self.selected_trigger_idx is None: return
        trigs = self.mission["dynamics"].get("triggers", [])
        if self.selected_trigger_idx < len(trigs):
            trig = trigs[self.selected_trigger_idx]
            trig["name"] = self.ent_trig_name.get().strip()
            trig["event"] = self.cb_trig_event.get()

            # Set trigger-level targetId for proximity / destroyed events
            tgt_val = self.ent_act_target.get().strip()
            if trig["event"] in ["PLAYER_PROXIMITY", "TARGET_DESTROYED"] and tgt_val:
                trig["targetId"] = tgt_val

            if trig["event"] in ["PLAYER_ENTER_AREA", "UNIT_ENTER_AREA"]:
                chosen_area = self.cb_trig_area.get().split(" ")[0].strip()
                if chosen_area:
                    trig["areaId"] = chosen_area
                if trig["event"] == "UNIT_ENTER_AREA" and tgt_val:
                    trig["unitId"] = tgt_val

            act_type = self.cb_act_type.get()
            act = {"type": act_type}

            if act_type == "DIALOGUE":
                act["speaker"] = self.ent_dia_speaker.get().strip()
                act["aircraft"] = self.ent_dia_craft.get().strip()
                act["squadron"] = self.ent_dia_sq.get().strip()
                act["duration"] = float(self.ent_dia_dur.get() or 5.5)
                act["text"] = self.txt_dia_body.get("1.0", tk.END).strip()
                port = self.ent_dia_portrait.get().strip()
                if port:
                    act["portrait"] = port
            elif act_type in ["FLY_TO_AREA", "DEFEND_AREA", "STAY_IN_AREA"]:
                chosen_area = self.cb_trig_area.get().split(" ")[0].strip()
                act["areaId"] = chosen_area
                act["unitId"] = self.ent_act_target.get().strip()
                if self.ent_act_x.get().strip():
                    try:
                        act["speed"] = float(self.ent_act_x.get().strip())
                    except ValueError:
                        pass
            elif act_type in ["TELEPORT_TO_AREA", "TELEPORT_PLAYER", "TELEPORT_UNIT"]:
                chosen_area = self.cb_trig_area.get().split(" ")[0].strip()
                act["areaId"] = chosen_area
                u_id = self.ent_act_target.get().strip()
                act["unitId"] = u_id if u_id else ("player" if act_type != "TELEPORT_UNIT" else "")
            elif act_type == "FADE_TRANSITION":
                act["title"] = self.ent_fade_title.get().strip()
                act["subtitle"] = self.ent_fade_subtitle.get().strip()
                sp_txt = self.ent_fade_spawn.get().strip()
                act["spawnUnits"] = [x.strip() for x in sp_txt.split(",") if x.strip()] if sp_txt else []
                dsp_txt = self.ent_fade_despawn.get().strip()
                act["despawnUnits"] = [x.strip() for x in dsp_txt.split(",") if x.strip()] if dsp_txt else []
                act["fadeTime"] = 0.8
                act["holdTime"] = 1.3
                act["clearMissiles"] = True
            elif act_type == "DETONATE_NUKE":
                act["x"] = float(self.ent_act_x.get() or 0)
                act["y"] = float(self.ent_act_y.get() or 0)
                act["duration"] = 2.5
            elif act_type in ["EXPLODE_UNIT", "SPAWN_UNIT", "DESPAWN_UNIT"]:
                act["unitId"] = self.ent_act_target.get().strip()
            elif act_type == "MOVE_UNIT":
                act["unitId"] = self.ent_act_target.get().strip()
                act["targetX"] = float(self.ent_act_x.get() or 0)
                act["targetY"] = float(self.ent_act_y.get() or 0)
            elif act_type == "RADIO_MESSAGE":
                act["text"] = self.txt_dia_body.get("1.0", tk.END).strip()
            elif act_type == "SCRIPTED_END":
                act["title"] = self.ent_fade_title.get().strip() or "OPERATION CONCLUDED"
                act["text"] = self.txt_dia_body.get("1.0", tk.END).strip() or "HQ // Tactical sortie objectives completed. RTB approved."
                try:
                    act["fadeTime"] = float(self.ent_dia_dur.get().strip() or "2.0")
                except ValueError:
                    act["fadeTime"] = 2.0

            trig["actions"] = [act]
            self.populate_form_from_mission()

    # ----------------------------------------------------
    # ADD / DELETE HANDLERS
    # ----------------------------------------------------
    def add_island(self, x=0, y=0, radius=400):
        terrain = self.mission["map"].setdefault("terrain", [])
        new_isl = {
            "id": f"island_{len(terrain) + 1}",
            "type": "island",
            "x": float(x),
            "y": float(y),
            "radius": float(radius),
            "color": "#1a382d",
            "sandColor": "#45594b"
        }
        terrain.append(new_isl)
        self.populate_form_from_mission()

    def delete_selected_island(self):
        if self.selected_item and self.selected_item[1] == "island":
            idx = self.selected_item[2]
            terrain = self.mission["map"].get("terrain", [])
            if idx < len(terrain):
                del terrain[idx]
                self.selected_item = None
                self.selected_vertex_idx = None
                self.populate_form_from_mission()

    def start_draw_poly_island(self):
        self.mode_var.set("poly_island")
        self.on_tool_change()
        self.poly_drawing_pts = []
        self.status_bar.config(text="Mode: POLYGON ISLAND. Click on the map to place vertices. Click near start vertex, Double-Click, or press Enter to finish. Escape to cancel.")

    def finish_polygon_island(self):
        if len(self.poly_drawing_pts) < 3:
            messagebox.showwarning("Polygon Island", "A polygon island requires at least 3 vertices to enclose an area.")
            return
        terrain = self.mission["map"].setdefault("terrain", [])
        pts = [[round(p[0], 1), round(p[1], 1)] for p in self.poly_drawing_pts]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        max_r = max(math.hypot(p[0] - cx, p[1] - cy) for p in pts) + 30.0

        new_isl = {
            "id": f"poly_island_{len(terrain) + 1}",
            "type": "polygon",
            "x": round(cx, 1),
            "y": round(cy, 1),
            "radius": round(max_r, 1),
            "points": pts,
            "color": "#1a382d",
            "sandColor": "#45594b"
        }
        terrain.append(new_isl)
        self.poly_drawing_pts = []
        self.selected_item = ("map", "island", len(terrain) - 1)
        self.selected_vertex_idx = None
        self.mode_var.set("select")
        self.on_tool_change()
        self.populate_form_from_mission()
        self.status_bar.config(text=f"Polygon island created with {len(pts)} vertices.")

    def cancel_polygon_drawing(self):
        if self.poly_drawing_pts:
            self.poly_drawing_pts = []
            self.redraw_canvas()
            self.status_bar.config(text="Polygon drawing cancelled.")

    def delete_selected_vertex(self):
        if self.selected_item and self.selected_item[1] == "island" and self.selected_vertex_idx is not None:
            idx = self.selected_item[2]
            terrain = self.mission["map"].get("terrain", [])
            if idx < len(terrain):
                isl = terrain[idx]
                pts = isl.get("points", [])
                if len(pts) <= 3:
                    messagebox.showwarning("Cannot Delete", "A polygon island requires at least 3 vertices.")
                    return
                if self.selected_vertex_idx < len(pts):
                    del pts[self.selected_vertex_idx]
                    self.selected_vertex_idx = None
                    cx = sum(p[0] for p in pts) / len(pts)
                    cy = sum(p[1] for p in pts) / len(pts)
                    isl["x"] = round(cx, 1)
                    isl["y"] = round(cy, 1)
                    isl["radius"] = round(max(math.hypot(p[0] - cx, p[1] - cy) for p in pts) + 30, 1)
                    self.populate_form_from_mission()

    def on_canvas_double_click(self, event):
        if self.tool_mode == "poly_island" and len(self.poly_drawing_pts) >= 3:
            self.finish_polygon_island()

    def on_key_return(self, event):
        if self.tool_mode == "poly_island" and len(self.poly_drawing_pts) >= 3:
            self.finish_polygon_island()

    def on_key_escape(self, event):
        if self.tool_mode == "poly_island":
            self.cancel_polygon_drawing()

    def add_spawn_point(self, x=0, y=0):
        spawns = self.mission["units"].setdefault("playerSpawns", [])
        spawns.append({
            "id": f"spawn_p{len(spawns) + 1}",
            "team": "friendly",
            "x": float(x),
            "y": float(y),
            "heading": -0.785,
            "speed": 335,
            "altitude": 1.0,
            "isPrimary": len(spawns) == 0,
            "allowedTags": []
        })
        self.populate_form_from_mission()
        self.update_spawns_status()

    def add_fade_trigger(self):
        trigs = self.mission["dynamics"].setdefault("triggers", [])
        trigs.append({
            "id": f"trig_fade_{len(trigs) + 1}",
            "name": f"Sector Transfer #{len(trigs) + 1}",
            "event": "TIMER",
            "time": 60.0,
            "actions": [
                {
                    "type": "FADE_TRANSITION",
                    "title": "SECTOR B // REAR AIRSPACE",
                    "subtitle": "TRANSFERRING TO ADJACENT COMBAT ZONE (+00:35:00)",
                    "spawnUnits": [],
                    "despawnUnits": [],
                    "fadeTime": 0.8,
                    "holdTime": 1.3,
                    "clearMissiles": True
                }
            ]
        })
        self.populate_form_from_mission()

    def delete_selected_spawn(self):
        if self.selected_item and self.selected_item[1] == "spawn":
            idx = self.selected_item[2]
            spawns = self.mission["units"].get("playerSpawns", [])
            if idx < len(spawns):
                del spawns[idx]
                if spawns and not any(s.get("isPrimary") for s in spawns):
                    spawns[0]["isPrimary"] = True
                self.selected_item = None
                self.populate_form_from_mission()
                self.update_spawns_status()

    def add_air_unit(self, x=0, y=0):
        air = self.mission["units"].setdefault("airUnits", [])
        air.append({
            "id": f"fighter_custom_{len(air) + 1}",
            "name": f"MiG-21 Custom #{len(air) + 1}",
            "code": "TGT [AIR]",
            "type": "air",
            "model": "mig21",
            "aiType": "rookie",
            "team": "enemy",
            "active": True,
            "x": float(x),
            "y": float(y),
            "heading": 0.0,
            "speed": 210,
            "hp": 48,
            "maxHp": 48,
            "hitRadius": 32,
            "orders": {"type": "PATROL_AREA", "centerX": float(x), "centerY": float(y), "radius": 2000}
        })
        self.populate_form_from_mission()

    def add_sam_unit(self, x=0, y=0):
        gnd = self.mission["units"].setdefault("groundUnits", [])
        gnd.append({
            "id": f"sam_custom_{len(gnd) + 1}",
            "name": f"SAM Battery #{len(gnd) + 1}",
            "code": "TGT [SAM]",
            "type": "ground",
            "team": "enemy",
            "active": True,
            "x": float(x),
            "y": float(y),
            "hp": 40,
            "maxHp": 40,
            "hitRadius": 32,
            "range": 3400,
            "fireInterval": 9.0,
            "orders": {"type": "DEFEND_POINT", "targetX": float(x), "targetY": float(y)}
        })
        self.populate_form_from_mission()

    def add_naval_unit(self, x=0, y=0):
        nav = self.mission["units"].setdefault("navalUnits", [])
        nav.append({
            "id": f"destroyer_custom_{len(nav) + 1}",
            "name": f"Destroyer DDG #{len(nav) + 1}",
            "code": "TGT [NAV]",
            "type": "naval",
            "subType": "destroyer",
            "team": "enemy",
            "active": True,
            "x": float(x),
            "y": float(y),
            "heading": 0.0,
            "speed": 18,
            "hp": 190,
            "maxHp": 190,
            "hitRadius": 44,
            "hasCIWS": True,
            "ciwsChannels": 1,
            "ciwsRange": 850,
            "hasSAM": True,
            "samRange": 3400,
            "orders": {"type": "FORMATION_ORBIT", "centerX": float(x), "centerY": float(y), "radius": 2000}
        })
        self.populate_form_from_mission()

    def add_dialogue_trigger(self):
        trigs = self.mission["dynamics"].setdefault("triggers", [])
        trigs.append({
            "id": f"trig_dia_{len(trigs) + 1}",
            "name": f"Story Dialogue #{len(trigs) + 1}",
            "event": "TIMER",
            "time": 10.0,
            "actions": [
                {
                    "type": "DIALOGUE",
                    "speaker": "PIXY",
                    "aircraft": "F-15C",
                    "squadron": "1ST BUDDY AIRFORCE",
                    "portrait": "./assets/portraits/pilot_pixy.png",
                    "text": "Yo buddy, still alive?",
                    "duration": 5.5
                }
            ]
        })
        self.populate_form_from_mission()

    # ----------------------------------------------------
    # OPERATIONAL AREAS & PORTRAIT HANDLERS
    # ----------------------------------------------------
    def update_portrait_preview(self):
        if not hasattr(self, "dia_portrait_canvas") or not hasattr(self, "ent_dia_portrait"):
            return
        path = self.ent_dia_portrait.get().strip().replace("\\", "/")
        self.dia_portrait_canvas.delete("all")
        w, h = 64, 64
        self.dia_portrait_canvas.create_rectangle(2, 2, w - 2, h - 2, fill="#05121a", outline="#00ff66", width=1.5)

        if not path:
            self.dia_portrait_canvas.create_text(w // 2, h // 2, text="PILOT\nSILHOUETTE", fill="#00bb55", font=("Consolas", 7), justify="center")
            self.portrait_preview_img = None
            return

        candidates = [
            path,
            os.path.join(BASE_DIR, path.lstrip("./\\")),
            os.path.join(PORTRAITS_DIR, os.path.basename(path)),
            os.path.join(BASE_DIR, "assets", os.path.basename(path))
        ]
        found = None
        for c in candidates:
            if os.path.isfile(c):
                found = c
                break

        if not found:
            self.dia_portrait_canvas.create_text(w // 2, h // 2, text="[?]\nMISSING", fill="#ff6644", font=("Consolas", 7, "bold"), justify="center")
            self.portrait_preview_img = None
            return

        try:
            im = Image.open(found).convert("RGBA")
            im.thumbnail((56, 56), Image.Resampling.LANCZOS)
            self.portrait_preview_img = ImageTk.PhotoImage(im)
            self.dia_portrait_canvas.create_image(w // 2, h // 2, image=self.portrait_preview_img, anchor="center")
        except Exception:
            self.dia_portrait_canvas.create_text(w // 2, h // 2, text="ERR", fill="#ff4444", font=("Consolas", 8))

    def browse_portrait(self):
        os.makedirs(PORTRAITS_DIR, exist_ok=True)
        f = filedialog.askopenfilename(initialdir=PORTRAITS_DIR, filetypes=[("Images", "*.png;*.jpg;*.jpeg;*.webp"), ("All Files", "*.*")])
        if f:
            rel = os.path.relpath(f, BASE_DIR).replace("\\", "/")
            if not rel.startswith("./") and not rel.startswith("../"):
                rel = "./" + rel
            self.ent_dia_portrait.delete(0, tk.END)
            self.ent_dia_portrait.insert(0, rel)
            self.update_portrait_preview()

    def clear_portrait(self):
        self.ent_dia_portrait.delete(0, tk.END)
        self.update_portrait_preview()

    def add_area(self, wx, wy, radius=2000.0, name=None):
        areas = self.mission["dynamics"].setdefault("areas", [])
        new_num = len(areas) + 1
        new_area = {
            "id": f"area_{new_num}",
            "name": name or f"Zone {new_num}",
            "x": round(float(wx), 1),
            "y": round(float(wy), 1),
            "radius": round(float(radius), 1),
            "color": "#00e5ff"
        }
        areas.append(new_area)
        self.mission["map"]["areas"] = areas
        self.populate_form_from_mission()
        self.select_area(len(areas) - 1)
        self.redraw_canvas()
        self.status_bar.config(text=f"Placed Area '{new_area['name']}' at ({new_area['x']}m, {new_area['y']}m) Radius={int(new_area['radius'])}m")

    def add_new_area_button(self):
        self.add_area(round(self.cam_x, 1), round(self.cam_y, 1))

    def select_area(self, idx):
        areas = self.mission["dynamics"].setdefault("areas", [])
        if idx >= len(areas): return
        area = areas[idx]
        self.selected_item = ("dynamics", "area", idx)
        self.selected_area_idx = idx
        self.selected_vertex_idx = None

        self.terrain_listbox.selection_clear(0, tk.END)
        self.spawns_listbox.selection_clear(0, tk.END)
        self.units_listbox.selection_clear(0, tk.END)

        if hasattr(self, "areas_listbox"):
            self.areas_listbox.selection_clear(0, tk.END)
            self.areas_listbox.selection_set(idx)
            self.areas_listbox.activate(idx)
            self.areas_listbox.see(idx)

        self.ent_area_id.delete(0, tk.END)
        self.ent_area_id.insert(0, str(area.get("id", f"area_{idx+1}")))
        self.ent_area_name.delete(0, tk.END)
        self.ent_area_name.insert(0, str(area.get("name", f"Zone {idx+1}")))
        self.ent_area_x.delete(0, tk.END)
        self.ent_area_x.insert(0, str(int(area.get("x", 0))))
        self.ent_area_y.delete(0, tk.END)
        self.ent_area_y.insert(0, str(int(area.get("y", 0))))
        self.ent_area_radius.delete(0, tk.END)
        self.ent_area_radius.insert(0, str(int(area.get("radius", 2000))))
        self.cb_area_color.set(area.get("color", "#00e5ff"))
        self.redraw_canvas()

    def on_select_area_item(self, event=None):
        sel = self.areas_listbox.curselection()
        if not sel: return
        self.select_area(sel[0])

    def update_area_from_form(self):
        if self.selected_area_idx is None: return
        areas = self.mission["dynamics"].setdefault("areas", [])
        if self.selected_area_idx < len(areas):
            area = areas[self.selected_area_idx]
            area["id"] = self.ent_area_id.get().strip() or area.get("id", "area_1")
            area["name"] = self.ent_area_name.get().strip() or "Unnamed Area"
            try:
                area["x"] = round(float(self.ent_area_x.get().strip()), 1)
                area["y"] = round(float(self.ent_area_y.get().strip()), 1)
                area["radius"] = max(100.0, round(float(self.ent_area_radius.get().strip()), 1))
            except ValueError:
                pass
            area["color"] = self.cb_area_color.get().strip() or "#00e5ff"
            self.populate_form_from_mission()
            self.redraw_canvas()
            self.status_bar.config(text=f"Updated Area '{area['name']}' [R={int(area['radius'])}m]")

    def nudge_area_radius(self, delta):
        if self.selected_area_idx is None: return
        areas = self.mission["dynamics"].setdefault("areas", [])
        if self.selected_area_idx < len(areas):
            area = areas[self.selected_area_idx]
            current_r = float(area.get("radius", 2000.0))
            area["radius"] = max(100.0, round(current_r + delta, 1))
            self.ent_area_radius.delete(0, tk.END)
            self.ent_area_radius.insert(0, str(int(area["radius"])))
            self.redraw_canvas()

    def duplicate_area(self):
        if self.selected_area_idx is None: return
        areas = self.mission["dynamics"].setdefault("areas", [])
        if self.selected_area_idx < len(areas):
            src = copy.deepcopy(areas[self.selected_area_idx])
            src["id"] = f"{src['id']}_copy"
            src["name"] = f"{src.get('name', 'Area')} (Copy)"
            src["x"] += 600.0
            src["y"] += 600.0
            areas.append(src)
            self.populate_form_from_mission()
            self.select_area(len(areas) - 1)

    def delete_area(self):
        if self.selected_area_idx is None: return
        areas = self.mission["dynamics"].setdefault("areas", [])
        if self.selected_area_idx < len(areas):
            del areas[self.selected_area_idx]
            self.selected_area_idx = None
            self.selected_item = None
            self.populate_form_from_mission()
            self.redraw_canvas()

    def add_area_trigger(self):
        trigs = self.mission["dynamics"].setdefault("triggers", [])
        areas = self.mission["dynamics"].get("areas", [])
        def_area = areas[0]["id"] if areas else "area_1"
        trigs.append({
            "id": f"trig_area_{len(trigs) + 1}",
            "name": f"Area Perimeter Trigger #{len(trigs) + 1}",
            "event": "PLAYER_ENTER_AREA",
            "areaId": def_area,
            "actions": [
                {
                    "type": "RADIO_MESSAGE",
                    "text": f"HQ // SECTOR BREACH DETECTED: {def_area.upper()}"
                }
            ]
        })
        self.populate_form_from_mission()

    def add_nuke_trigger(self, x=0, y=0):
        trigs = self.mission["dynamics"].setdefault("triggers", [])
        trigs.append({
            "id": f"trig_nuke_{len(trigs) + 1}",
            "name": f"Atmospheric Nuke Detonation #{len(trigs) + 1}",
            "event": "TIMER",
            "time": 45.0,
            "actions": [
                {
                    "type": "DETONATE_NUKE",
                    "x": float(x),
                    "y": float(y),
                    "duration": 2.5
                }
            ]
        })
        self.populate_form_from_mission()

    def add_explode_trigger(self):
        trigs = self.mission["dynamics"].setdefault("triggers", [])
        trigs.append({
            "id": f"trig_explode_{len(trigs) + 1}",
            "name": f"Scripted Explosion #{len(trigs) + 1}",
            "event": "TIMER",
            "time": 25.0,
            "actions": [
                {
                    "type": "EXPLODE_UNIT",
                    "unitId": "mig21_1"
                }
            ]
        })
        self.populate_form_from_mission()

    def delete_selected_unit(self):
        if not self.selected_item or self.selected_item[0] != "units": return
        u_type = self.selected_item[1]
        idx = self.selected_item[2]
        u = self.mission.get("units", {})
        key = f"{u_type}Units"
        if key in u and idx < len(u[key]):
            del u[key][idx]
            self.selected_item = None
            self.populate_form_from_mission()

    def add_objective(self):
        objs = self.mission["dynamics"].setdefault("objectives", [])
        objs.append({
            "id": f"obj_{len(objs) + 1}",
            "title": f"Objective #{len(objs) + 1}",
            "description": "Engage primary targets in theater.",
            "type": "DESTROY_TARGETS",
            "requiredCount": 5,
            "isPrimary": True
        })
        self.populate_form_from_mission()

    def delete_objective(self):
        sel = self.objs_listbox.curselection()
        if not sel: return
        objs = self.mission["dynamics"].get("objectives", [])
        if sel[0] < len(objs):
            del objs[sel[0]]
            self.populate_form_from_mission()

    def delete_trigger(self):
        sel = self.trigs_listbox.curselection()
        if not sel: return
        trigs = self.mission["dynamics"].get("triggers", [])
        if sel[0] < len(trigs):
            del trigs[sel[0]]
            self.selected_trigger_idx = None
            self.populate_form_from_mission()

    # ----------------------------------------------------
    # UNIT DUPLICATION & CLIPBOARD
    # ----------------------------------------------------
    def copy_unit(self):
        if not self.selected_item or self.selected_item[0] != "units":
            self.status_bar.config(text="Clipboard: No unit selected to copy.")
            return
        kind = self.selected_item[1]
        idx = self.selected_item[2]
        u = self.mission.get("units", {})
        key = f"{kind}Units" if kind != "spawn" else "playerSpawns"
        units_list = u.get(key, [])
        if idx >= len(units_list):
            return
        unit = units_list[idx]
        self.clipboard_unit = {
            "kind": kind,
            "data": copy.deepcopy(unit)
        }
        unit_name = unit.get("name", unit.get("id", kind))
        self.status_bar.config(text=f"Copied {kind.upper()} unit '{unit_name}' to clipboard.")

    def paste_unit(self):
        if not self.clipboard_unit:
            self.status_bar.config(text="Unit clipboard is empty. Select a unit and click Copy first.")
            return
        kind = self.clipboard_unit["kind"]
        new_unit = copy.deepcopy(self.clipboard_unit["data"])

        u = self.mission.setdefault("units", {})
        key = f"{kind}Units" if kind != "spawn" else "playerSpawns"
        units_list = u.setdefault(key, [])

        # Offset coordinates slightly so duplicate doesn't completely overlap original
        new_unit["x"] = round(float(new_unit.get("x", 0)) + 150.0, 1)
        new_unit["y"] = round(float(new_unit.get("y", 0)) + 150.0, 1)
        if "patrolCenterX" in new_unit:
            new_unit["patrolCenterX"] = round(float(new_unit["patrolCenterX"]) + 150.0, 1)
        if "patrolCenterY" in new_unit:
            new_unit["patrolCenterY"] = round(float(new_unit["patrolCenterY"]) + 150.0, 1)
        if "orders" in new_unit and isinstance(new_unit["orders"], dict):
            if "centerX" in new_unit["orders"]:
                new_unit["orders"]["centerX"] = round(float(new_unit["orders"]["centerX"]) + 150.0, 1)
            if "centerY" in new_unit["orders"]:
                new_unit["orders"]["centerY"] = round(float(new_unit["orders"]["centerY"]) + 150.0, 1)

        # Generate unique ID
        existing_ids = set()
        for cat in ("airUnits", "groundUnits", "navalUnits", "playerSpawns"):
            for item in u.get(cat, []):
                if "id" in item:
                    existing_ids.add(item["id"])

        old_id = str(new_unit.get("id", f"{kind}_unit"))
        base_id = old_id.split("_copy")[0] if "_copy" in old_id else old_id
        counter = 1
        new_id = f"{base_id}_copy{counter}"
        while new_id in existing_ids:
            counter += 1
            new_id = f"{base_id}_copy{counter}"
        new_unit["id"] = new_id

        # Update unit name
        old_name = str(new_unit.get("name", old_id))
        if " (Copy" not in old_name:
            new_unit["name"] = f"{old_name} (Copy)"
        else:
            base_name = old_name.split(" (Copy")[0]
            new_unit["name"] = f"{base_name} (Copy {counter})"

        if kind == "spawn":
            new_unit["isPrimary"] = False

        units_list.append(new_unit)
        new_idx = len(units_list) - 1

        self.populate_form_from_mission()
        self.select_unit(kind, new_idx)
        self.status_bar.config(text=f"Pasted {kind.upper()} unit: '{new_unit['name']}' ({new_unit['id']}).")

    def duplicate_unit(self):
        if not self.selected_item or self.selected_item[0] != "units":
            self.status_bar.config(text="Please select a unit to duplicate.")
            return
        self.copy_unit()
        self.paste_unit()

    # ----------------------------------------------------
    # TRIGGER DUPLICATION & CLIPBOARD
    # ----------------------------------------------------
    def copy_trigger(self):
        sel = self.trigs_listbox.curselection()
        idx = sel[0] if sel else self.selected_trigger_idx
        if idx is None:
            self.status_bar.config(text="Clipboard: No trigger selected to copy.")
            return
        trigs = self.mission["dynamics"].get("triggers", [])
        if idx >= len(trigs):
            return
        trig = trigs[idx]
        self.clipboard_trigger = copy.deepcopy(trig)
        trig_name = trig.get("name", trig.get("id", "trigger"))
        self.status_bar.config(text=f"Copied trigger '{trig_name}' to clipboard.")

    def paste_trigger(self):
        if not self.clipboard_trigger:
            self.status_bar.config(text="Trigger clipboard is empty. Select a trigger and click Copy first.")
            return
        new_trig = copy.deepcopy(self.clipboard_trigger)
        trigs = self.mission["dynamics"].setdefault("triggers", [])

        existing_ids = {t.get("id") for t in trigs if "id" in t}
        old_id = str(new_trig.get("id", "trig_1"))
        base_id = old_id.split("_copy")[0] if "_copy" in old_id else old_id
        counter = 1
        new_id = f"{base_id}_copy{counter}"
        while new_id in existing_ids:
            counter += 1
            new_id = f"{base_id}_copy{counter}"
        new_trig["id"] = new_id

        old_name = str(new_trig.get("name", old_id))
        if " (Copy" not in old_name:
            new_trig["name"] = f"{old_name} (Copy)"
        else:
            base_name = old_name.split(" (Copy")[0]
            new_trig["name"] = f"{base_name} (Copy {counter})"

        trigs.append(new_trig)
        new_idx = len(trigs) - 1

        self.selected_trigger_idx = new_idx
        self.populate_form_from_mission()
        self.trigs_listbox.selection_clear(0, tk.END)
        self.trigs_listbox.selection_set(new_idx)
        self.trigs_listbox.activate(new_idx)
        self.trigs_listbox.see(new_idx)
        self.on_select_trigger_item(None)
        self.status_bar.config(text=f"Pasted trigger: '{new_trig['name']}' ({new_trig['id']}).")

    def duplicate_trigger(self):
        sel = self.trigs_listbox.curselection()
        idx = sel[0] if sel else self.selected_trigger_idx
        if idx is None:
            self.status_bar.config(text="Please select a trigger to duplicate.")
            return
        self.copy_trigger()
        self.paste_trigger()

    # ----------------------------------------------------
    # KEYBOARD SHORTCUTS
    # ----------------------------------------------------
    def is_text_widget_focused(self):
        try:
            focused = self.focus_get()
            if isinstance(focused, (tk.Entry, ttk.Entry, tk.Text)):
                return True
        except Exception:
            pass
        return False

    def on_hotkey_copy(self, event=None):
        if self.is_text_widget_focused():
            return
        layer = self.get_active_layer()
        if layer == "units":
            self.copy_unit()
            return "break"
        elif layer == "dynamics":
            self.copy_trigger()
            return "break"

    def on_hotkey_paste(self, event=None):
        if self.is_text_widget_focused():
            return
        layer = self.get_active_layer()
        if layer == "units":
            self.paste_unit()
            return "break"
        elif layer == "dynamics":
            self.paste_trigger()
            return "break"

    def on_hotkey_duplicate(self, event=None):
        if self.is_text_widget_focused():
            return
        layer = self.get_active_layer()
        if layer == "units":
            self.duplicate_unit()
            return "break"
        elif layer == "dynamics":
            self.duplicate_trigger()
            return "break"

    # ----------------------------------------------------
    # INTERACTIVE 2D CANVAS RENDERING & NAVIGATION
    # ----------------------------------------------------
    def world_to_screen(self, wx, wy):
        w = self.canvas.winfo_width() or 600
        h = self.canvas.winfo_height() or 600
        sx = (w * 0.5) + (wx - self.cam_x) * self.zoom
        sy = (h * 0.5) + (wy - self.cam_y) * self.zoom
        return sx, sy

    def screen_to_world(self, sx, sy):
        w = self.canvas.winfo_width() or 600
        h = self.canvas.winfo_height() or 600
        wx = self.cam_x + (sx - w * 0.5) / self.zoom
        wy = self.cam_y + (sy - h * 0.5) / self.zoom
        return wx, wy

    def redraw_canvas(self):
        self.canvas.delete("all")
        w = self.canvas.winfo_width() or 600
        h = self.canvas.winfo_height() or 600

        self.canvas.create_rectangle(0, 0, w, h, fill="#040d16", outline="")

        half_size = self.mission["map"].get("halfMapSize", 15075)

        # 1. Map AO Bounds
        b_x1, b_y1 = self.world_to_screen(-half_size, -half_size)
        b_x2, b_y2 = self.world_to_screen(half_size, half_size)
        self.canvas.create_rectangle(b_x1, b_y1, b_x2, b_y2, outline="#004422", width=2, dash=(4, 4))
        self.canvas.create_text(b_x1 + 10, b_y1 + 10, text="// COMBAT AIRSPACE (AO) BOUNDARY", fill="#00ff66", anchor="nw", font=("Consolas", 8))

        # Ace Combat Return Line (Resupply Zone) rendering
        rl = self.mission.get("map", {}).get("returnLine", {})
        if rl.get("enabled"):
            side = rl.get("side", "bottom").lower()
            offset = float(rl.get("offset", 0.10))
            full_map = half_size * 2
            zone_depth = full_map * offset

            if side == "bottom":
                rl_wy = half_size - zone_depth
                rx1, ry1 = self.world_to_screen(-half_size, rl_wy)
                rx2, ry2 = self.world_to_screen(half_size, half_size)
                self.canvas.create_rectangle(rx1, ry1, rx2, ry2, fill="#051c2e", outline="#00e5ff", width=2, dash=(6, 4))
                self.canvas.create_text(rx1 + 12, ry1 + 12, text="<< RETURN LINE // RESUPPLY BASE (10%) >>", fill="#00e5ff", anchor="w", font=("Consolas", 8, "bold"))
            elif side == "top":
                rl_wy = -half_size + zone_depth
                rx1, ry1 = self.world_to_screen(-half_size, -half_size)
                rx2, ry2 = self.world_to_screen(half_size, rl_wy)
                self.canvas.create_rectangle(rx1, ry1, rx2, ry2, fill="#051c2e", outline="#00e5ff", width=2, dash=(6, 4))
                self.canvas.create_text(rx1 + 12, ry2 - 12, text="<< RETURN LINE // RESUPPLY BASE (10%) >>", fill="#00e5ff", anchor="w", font=("Consolas", 8, "bold"))
            elif side == "left":
                rl_wx = -half_size + zone_depth
                rx1, ry1 = self.world_to_screen(-half_size, -half_size)
                rx2, ry2 = self.world_to_screen(rl_wx, half_size)
                self.canvas.create_rectangle(rx1, ry1, rx2, ry2, fill="#051c2e", outline="#00e5ff", width=2, dash=(6, 4))
                self.canvas.create_text(rx2 - 12, ry1 + 20, text="RETURN LINE", fill="#00e5ff", anchor="e", font=("Consolas", 8, "bold"))
            elif side == "right":
                rl_wx = half_size - zone_depth
                rx1, ry1 = self.world_to_screen(rl_wx, -half_size)
                rx2, ry2 = self.world_to_screen(half_size, half_size)
                self.canvas.create_rectangle(rx1, ry1, rx2, ry2, fill="#051c2e", outline="#00e5ff", width=2, dash=(6, 4))
                self.canvas.create_text(rx1 + 12, ry1 + 20, text="RETURN LINE", fill="#00e5ff", anchor="w", font=("Consolas", 8, "bold"))

        # Grid lines (every 5000 meters)
        step = 5000
        start = int(-half_size // step) * step
        for gx in range(start, int(half_size) + 1, step):
            sx1, sy1 = self.world_to_screen(gx, -half_size)
            sx2, sy2 = self.world_to_screen(gx, half_size)
            self.canvas.create_line(sx1, sy1, sx2, sy2, fill="#0c1e28", width=1)
            self.canvas.create_text(sx1 + 4, b_y1 + 14, text=f"{gx}m", fill="#184030", anchor="nw", font=("Consolas", 7))

        for gy in range(start, int(half_size) + 1, step):
            sx1, sy1 = self.world_to_screen(-half_size, gy)
            sx2, sy2 = self.world_to_screen(half_size, gy)
            self.canvas.create_line(sx1, sy1, sx2, sy2, fill="#0c1e28", width=1)

        # 2. Layer 1: Terrain / Islands
        for idx, isl in enumerate(self.mission["map"].get("terrain", [])):
            is_sel = (self.selected_item == ("map", "island", idx))
            outline_col = "#00ffcc" if is_sel else isl.get("sandColor", "#45594b")
            fill_col = isl.get("color", "#1a382d")
            pts = isl.get("points")

            if pts and len(pts) >= 3:
                # Render polygon island
                scr_pts = [self.world_to_screen(p[0], p[1]) for p in pts]
                flat_coords = [c for p in scr_pts for c in p]
                self.canvas.create_polygon(flat_coords, fill=fill_col, outline=outline_col, width=2 if is_sel else 1)

                cx, cy = isl.get("x", 0), isl.get("y", 0)
                scx, scy = self.world_to_screen(cx, cy)
                self.canvas.create_text(scx, scy, text=isl.get("id", f"poly_{idx+1}"), fill="#88c0a0" if not is_sel else "#00ffcc", font=("Consolas", 7))

                # If island is selected, render draggable vertex handles
                if is_sel:
                    for v_idx, sp in enumerate(scr_pts):
                        v_col = "#ffcc00" if (self.selected_vertex_idx == v_idx) else "#00ffcc"
                        self.canvas.create_rectangle(sp[0] - 4, sp[1] - 4, sp[0] + 4, sp[1] + 4, fill=v_col, outline="#000000")
                        self.canvas.create_text(sp[0] + 6, sp[1] - 6, text=f"V{v_idx+1}", fill=v_col, font=("Consolas", 7))
            else:
                # Render circular island
                ix, iy = isl.get("x", 0), isl.get("y", 0)
                rad = isl.get("radius", 350)
                sx, sy = self.world_to_screen(ix, iy)
                s_rad = max(3, rad * self.zoom)
                self.canvas.create_oval(sx - s_rad, sy - s_rad, sx + s_rad, sy + s_rad,
                                        fill=fill_col, outline=outline_col, width=2 if is_sel else 1)

        # Operational Areas & Trigger Zones (Visible in Editor, Invisible In-Game)
        areas = self.mission.get("dynamics", {}).get("areas", [])
        for idx, area in enumerate(areas):
            ax, ay = area.get("x", 0), area.get("y", 0)
            rad = area.get("radius", 2000)
            col = area.get("color", "#00e5ff")
            is_sel = (self.selected_item == ("dynamics", "area", idx))

            sx, sy = self.world_to_screen(ax, ay)
            s_rad = max(4, rad * self.zoom)

            if is_sel:
                self.canvas.create_oval(sx - s_rad, sy - s_rad, sx + s_rad, sy + s_rad,
                                        outline=col, width=3)
                self.canvas.create_oval(sx - s_rad - 2, sy - s_rad - 2, sx + s_rad + 2, sy + s_rad + 2,
                                        outline="#ffffff", width=1, dash=(3, 3))
            else:
                self.canvas.create_oval(sx - s_rad, sy - s_rad, sx + s_rad, sy + s_rad,
                                        outline=col, width=1.5, dash=(6, 4))

            # Center crosshair
            ch = 6
            self.canvas.create_line(sx - ch, sy, sx + ch, sy, fill=col, width=1.5)
            self.canvas.create_line(sx, sy - ch, sx, sy + ch, fill=col, width=1.5)

            # Area label
            lbl_text = f"// AREA: {area.get('name', area.get('id', 'Zone'))} [R={int(rad)}m]"
            self.canvas.create_text(sx, sy - s_rad - 10, text=lbl_text,
                                    fill="#ffffff" if is_sel else col, font=("Consolas", 8, "bold"))

            # Radius resize handle on perimeter
            if is_sel:
                hx, hy = sx + s_rad, sy
                self.canvas.create_rectangle(hx - 5, hy - 5, hx + 5, hy + 5, fill="#ffea00", outline="#000000", width=1.5)
                self.canvas.create_text(hx + 10, hy, text="[↔ RESIZE]", fill="#ffea00", anchor="w", font=("Consolas", 8, "bold"))

        # 3. Layer 2: Player Spawns
        is_mp = (self.cb_mission_type.get() == "multiplayer") if hasattr(self, "cb_mission_type") else False
        try:
            req_players = int(self.spin_player_count.get() or "4") if is_mp else 1
        except Exception:
            req_players = 4 if is_mp else 1

        for idx, sp in enumerate(self.mission["units"].get("playerSpawns", [])):
            sx, sy = self.world_to_screen(sp.get("x", 0), sp.get("y", 0))
            is_sel = (self.selected_item == ("units", "spawn", idx))
            is_extra = is_mp and (idx >= req_players)

            col = "#00e5ff" if is_sel else ("#669988" if is_extra else "#00ff66")
            r = 7 if sp.get("isPrimary") else 5
            self.canvas.create_oval(sx - r, sy - r, sx + r, sy + r, fill=col, outline="#ffffff")
            hd = sp.get("heading", 0)
            hx = sx + math.cos(hd) * 20
            hy = sy + math.sin(hd) * 20
            self.canvas.create_line(sx, sy, hx, hy, fill=col, width=2, arrow=tk.LAST)

            slot_label = f"P{idx+1} [LEAD]" if (sp.get("isPrimary") or idx == 0) else f"P{idx+1}"
            if is_extra:
                slot_label += " (RESERVE)"
            self.canvas.create_text(sx, sy - 12, text=slot_label, fill=col, font=("Consolas", 8, "bold"))

        # 4. Layer 2: Air Units
        for idx, a in enumerate(self.mission["units"].get("airUnits", [])):
            sx, sy = self.world_to_screen(a.get("x", 0), a.get("y", 0))
            is_sel = (self.selected_item == ("units", "air", idx))
            is_active = a.get("active", True) if a.get("spawned") is None else a.get("spawned", True)
            col = "#ffff00" if is_sel else ("#ff3322" if a.get("team") == "enemy" else "#3399ff")
            if not is_active:
                col = "#888888"

            hd = a.get("heading", 0)
            cosH, sinH = math.cos(hd), math.sin(hd)
            p1 = (sx + cosH * 10, sy + sinH * 10)
            p2 = (sx - cosH * 7 - sinH * 6, sy - sinH * 7 + cosH * 6)
            p3 = (sx - cosH * 7 + sinH * 6, sy - sinH * 7 - cosH * 6)
            self.canvas.create_polygon([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]], fill=col,
                                        outline="#ffffff" if is_sel else ("#555555" if not is_active else ""))
            label = a.get("name", "Fighter")[:12] + (" (DORMANT)" if not is_active else "")
            self.canvas.create_text(sx, sy + 10, text=label, fill=col, font=("Consolas", 7))

            # Patrol radius ring if selected
            if is_sel and a.get("orders", {}).get("type") == "PATROL_AREA":
                prad = (a.get("orders", {}).get("radius") or 2000) * self.zoom
                self.canvas.create_oval(sx - prad, sy - prad, sx + prad, sy + prad, outline=col, dash=(3, 3))

        # 5. Layer 2: Ground / SAM Units
        for idx, g in enumerate(self.mission["units"].get("groundUnits", [])):
            sx, sy = self.world_to_screen(g.get("x", 0), g.get("y", 0))
            is_sel = (self.selected_item == ("units", "ground", idx))
            is_active = g.get("active", True) if g.get("spawned") is None else g.get("spawned", True)
            col = "#ffff00" if is_sel else ("#ff6600" if g.get("team") == "enemy" else "#00ccff")
            if not is_active: col = "#777777"

            self.canvas.create_rectangle(sx - 5, sy - 5, sx + 5, sy + 5, fill=col, outline="#ffffff" if is_sel else "")
            s_range = (g.get("range") or 3400) * self.zoom
            self.canvas.create_oval(sx - s_range, sy - s_range, sx + s_range, sy + s_range, outline=col, width=1, dash=(2, 4))
            self.canvas.create_text(sx, sy - 8, text=g.get("name", "SAM")[:10], fill=col, font=("Consolas", 7))

        # 6. Layer 2: Naval Units
        for idx, n in enumerate(self.mission["units"].get("navalUnits", [])):
            sx, sy = self.world_to_screen(n.get("x", 0), n.get("y", 0))
            is_sel = (self.selected_item == ("units", "naval", idx))
            col = "#ffff00" if is_sel else ("#ff2244" if n.get("team") == "enemy" else "#2288ff")
            self.canvas.create_oval(sx - 7, sy - 4, sx + 7, sy + 4, fill=col, outline="#ffffff" if is_sel else "")
            self.canvas.create_text(sx, sy + 8, text=n.get("name", "Ship")[:14], fill=col, font=("Consolas", 7, "bold"))

        # 7. Layer 3: Scripted Nukes Visual Indicators
        for tr in self.mission["dynamics"].get("triggers", []):
            for act in tr.get("actions", []):
                if act.get("type") == "DETONATE_NUKE":
                    nx, ny = act.get("x", 0), act.get("y", 0)
                    snx, sny = self.world_to_screen(nx, ny)
                    self.canvas.create_text(snx, sny, text="☢", fill="#ffaa00", font=("Consolas", 16, "bold"))
                    self.canvas.create_text(snx, sny + 14, text="NUKE DETONATION", fill="#ffaa00", font=("Consolas", 7))
                    self.canvas.create_oval(snx - 30, sny - 30, snx + 30, sny + 30, outline="#ffaa00", dash=(2, 2))

        # 8. Active In-Progress Polygon Island Drawing Rubberband
        if self.tool_mode == "poly_island" and len(self.poly_drawing_pts) > 0:
            scr_pts = [self.world_to_screen(p[0], p[1]) for p in self.poly_drawing_pts]
            msx, msy = self.world_to_screen(self.mouse_world_pos[0], self.mouse_world_pos[1])

            # Draw lines between existing vertices
            for i in range(len(scr_pts) - 1):
                p1 = scr_pts[i]
                p2 = scr_pts[i + 1]
                self.canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill="#00ffee", width=2)

            # Draw rubberband to current mouse cursor
            last_p = scr_pts[-1]
            self.canvas.create_line(last_p[0], last_p[1], msx, msy, fill="#00ff88", width=1.5, dash=(4, 3))

            # If >= 2 points, draw preview loop line back to first vertex
            if len(scr_pts) >= 2:
                first_p = scr_pts[0]
                self.canvas.create_line(msx, msy, first_p[0], first_p[1], fill="#00aa66", width=1, dash=(2, 3))

            # Draw vertex handle dots
            for i, p in enumerate(scr_pts):
                v_fill = "#ffea00" if i == 0 else "#00ffee"
                self.canvas.create_oval(p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4, fill=v_fill, outline="#ffffff")
                self.canvas.create_text(p[0] + 8, p[1] - 6, text=f"V{i+1}", fill=v_fill, font=("Consolas", 7, "bold"))

            # Highlight first vertex if mouse is close enough to close
            if len(scr_pts) >= 3:
                first_p = scr_pts[0]
                if math.hypot(msx - first_p[0], msy - first_p[1]) < 14:
                    self.canvas.create_oval(first_p[0] - 8, first_p[1] - 8, first_p[0] + 8, first_p[1] + 8, outline="#ffea00", width=2)
                    self.canvas.create_text(msx, msy - 14, text="[CLICK TO CLOSE]", fill="#ffea00", font=("Consolas", 8, "bold"))

    def adjust_zoom(self, factor):
        self.zoom = max(0.004, min(0.12, self.zoom * factor))
        self.redraw_canvas()

    def fit_map_view(self):
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()
        if w <= 50 or h <= 50:
            w, h = 700, 700
        size = self.mission["map"].get("size", 30150)
        self.cam_x = 0
        self.cam_y = 0
        self.zoom = max(0.004, min(0.12, min(w, h) / (size * 1.15)))
        self.redraw_canvas()

    def on_pan_start(self, event):
        self.drag_start = (event.x, event.y)

    def on_pan_drag(self, event):
        if not self.drag_start: return
        dx = event.x - self.drag_start[0]
        dy = event.y - self.drag_start[1]
        self.cam_x -= dx / self.zoom
        self.cam_y -= dy / self.zoom
        self.drag_start = (event.x, event.y)
        self.redraw_canvas()

    def on_mouse_wheel(self, event):
        factor = 1.15 if event.delta > 0 else 0.85
        self.adjust_zoom(factor)

    def on_mouse_move(self, event):
        wx, wy = self.screen_to_world(event.x, event.y)
        self.mouse_world_pos = (wx, wy)
        self.status_bar.config(text=f"Coordinates: (X: {int(wx)}m, Y: {int(wy)}m) | Zoom: {self.zoom:.4f} | Tool: {self.tool_mode.upper()}")
        if self.tool_mode == "poly_island" and len(self.poly_drawing_pts) > 0:
            self.redraw_canvas()

    def on_canvas_click(self, event):
        wx, wy = self.screen_to_world(event.x, event.y)

        if self.tool_mode == "poly_island":
            # Check if clicking near the first vertex to close polygon (when >= 3 points)
            if len(self.poly_drawing_pts) >= 3:
                sx0, sy0 = self.world_to_screen(*self.poly_drawing_pts[0])
                if math.hypot(event.x - sx0, event.y - sy0) < 14:
                    self.finish_polygon_island()
                    return
            self.poly_drawing_pts.append((round(wx, 1), round(wy, 1)))
            self.status_bar.config(text=f"Drawing Polygon Island: {len(self.poly_drawing_pts)} vertices placed. Click near start vertex, Double-Click, or press Enter to close/save.")
            self.redraw_canvas()
            return
        elif self.tool_mode == "island":
            self.add_island(wx, wy)
            return
        elif self.tool_mode == "spawn":
            self.add_spawn_point(wx, wy)
            return
        elif self.tool_mode == "air":
            self.add_air_unit(wx, wy)
            return
        elif self.tool_mode == "ground":
            self.add_sam_unit(wx, wy)
            return
        elif self.tool_mode == "naval":
            self.add_naval_unit(wx, wy)
            return
        elif self.tool_mode == "nuke":
            self.add_nuke_trigger(wx, wy)
            return
        elif self.tool_mode == "area":
            self.add_area(wx, wy)
            return

        # Select Tool: Click to select entity based on current active layer
        layer = self.get_active_layer()

        # Check if clicking on perimeter resize handle of currently selected area (Layer 3)
        if self.selected_item and self.selected_item[0] == "dynamics" and self.selected_item[1] == "area":
            a_idx = self.selected_item[2]
            areas = self.mission.get("dynamics", {}).get("areas", [])
            if a_idx < len(areas):
                a = areas[a_idx]
                asx, asy = self.world_to_screen(a.get("x", 0), a.get("y", 0))
                s_rad = max(4, a.get("radius", 2000) * self.zoom)
                hx, hy = asx + s_rad, asy
                if math.hypot(event.x - hx, event.y - hy) <= 14:
                    self.dragging_area_resize = True
                    self.drag_start = (event.x, event.y)
                    self.status_bar.config(text=f"Resizing Area '{a.get('name')}' - Drag outward/inward to resize radius.")
                    return

        # Check if clicking on vertex handle of currently selected polygon island (Layer 1 only)
        if layer == "map" and self.selected_item and self.selected_item[1] == "island":
            s_idx = self.selected_item[2]
            terrain = self.mission["map"].get("terrain", [])
            if s_idx < len(terrain):
                isl = terrain[s_idx]
                if isl.get("points"):
                    for v_idx, pt in enumerate(isl["points"]):
                        vsx, vsy = self.world_to_screen(pt[0], pt[1])
                        if math.hypot(event.x - vsx, event.y - vsy) <= 8:
                            self.selected_vertex_idx = v_idx
                            self.drag_start = (event.x, event.y)
                            self.redraw_canvas()
                            return

        self.drag_start = (event.x, event.y)

        # STRICT LAYER ISOLATION
        if layer == "units":
            # Layer 2: Units & Spawns ONLY. Impossible to select terrain!
            # Find closest unit or spawn within click radius (in screen pixels)
            u = self.mission.get("units", {})
            closest = None
            min_dist = float("inf")

            # 1. Player Spawns
            for idx, sp in enumerate(u.get("playerSpawns", [])):
                sx, sy = self.world_to_screen(sp.get("x", 0), sp.get("y", 0))
                d = math.hypot(event.x - sx, event.y - sy)
                if d <= 25 and d < min_dist:
                    min_dist = d
                    closest = ("spawn", idx)

            # 2. Air Units
            for idx, a in enumerate(u.get("airUnits", [])):
                sx, sy = self.world_to_screen(a.get("x", 0), a.get("y", 0))
                d = math.hypot(event.x - sx, event.y - sy)
                if d <= 30 and d < min_dist:
                    min_dist = d
                    closest = ("air", idx)

            # 3. Ground Units
            for idx, g in enumerate(u.get("groundUnits", [])):
                sx, sy = self.world_to_screen(g.get("x", 0), g.get("y", 0))
                d = math.hypot(event.x - sx, event.y - sy)
                if d <= 25 and d < min_dist:
                    min_dist = d
                    closest = ("ground", idx)

            # 4. Naval Units
            for idx, n in enumerate(u.get("navalUnits", [])):
                sx, sy = self.world_to_screen(n.get("x", 0), n.get("y", 0))
                d = math.hypot(event.x - sx, event.y - sy)
                if d <= 30 and d < min_dist:
                    min_dist = d
                    closest = ("naval", idx)

            if closest:
                self.select_unit(closest[0], closest[1])
                return

            # Clicked empty space in Layer 2
            self.selected_item = None
            self.selected_vertex_idx = None
            self.units_listbox.selection_clear(0, tk.END)
            self.spawns_listbox.selection_clear(0, tk.END)
            self.redraw_canvas()

        elif layer == "map":
            # Layer 1: Map & Terrain ONLY. Impossible to select units!
            terrain = self.mission["map"].get("terrain", [])
            # 1. Check vertex handles first
            for idx, isl in enumerate(terrain):
                pts = isl.get("points")
                if pts and len(pts) >= 3:
                    for v_idx, pt in enumerate(pts):
                        vsx, vsy = self.world_to_screen(pt[0], pt[1])
                        if math.hypot(event.x - vsx, event.y - vsy) <= 8:
                            self.select_island(idx, vertex_idx=v_idx)
                            return

            # 2. Check islands (polygonal & circular) - pick innermost/smallest if overlapping
            hit_island = None
            min_isl_rad = float("inf")
            for idx, isl in enumerate(terrain):
                pts = isl.get("points")
                if pts and len(pts) >= 3:
                    if is_point_in_polygon(wx, wy, pts):
                        rad = isl.get("radius", 350)
                        if rad < min_isl_rad:
                            min_isl_rad = rad
                            hit_island = idx
                else:
                    rad = isl.get("radius", 350)
                    if math.hypot(wx - isl.get("x", 0), wy - isl.get("y", 0)) <= rad:
                        if rad < min_isl_rad:
                            min_isl_rad = rad
                            hit_island = idx

            if hit_island is not None:
                self.select_island(hit_island)
                return

            # Clicked empty space in Layer 1
            self.selected_item = None
            self.selected_vertex_idx = None
            self.terrain_listbox.selection_clear(0, tk.END)
            self.redraw_canvas()

        elif layer == "dynamics":
            areas = self.mission.get("dynamics", {}).get("areas", [])
            hit_area = None
            min_area_rad = float("inf")
            for idx, a in enumerate(areas):
                d = math.hypot(wx - a.get("x", 0), wy - a.get("y", 0))
                rad = a.get("radius", 2000)
                asx, asy = self.world_to_screen(a.get("x", 0), a.get("y", 0))
                screen_d = math.hypot(event.x - asx, event.y - asy)
                s_rad = max(4, rad * self.zoom)
                if d <= rad or abs(screen_d - s_rad) <= 14:
                    if rad < min_area_rad:
                        min_area_rad = rad
                        hit_area = idx
            if hit_area is not None:
                self.select_area(hit_area)
                self.drag_start = (event.x, event.y)
                return
            self.selected_item = None
            self.selected_area_idx = None
            if hasattr(self, "areas_listbox"):
                self.areas_listbox.selection_clear(0, tk.END)
            self.redraw_canvas()

        else:
            # Other layers
            self.selected_item = None
            self.selected_vertex_idx = None
            self.redraw_canvas()

    def on_canvas_drag(self, event):
        if not self.drag_start: return
        wx, wy = self.screen_to_world(event.x, event.y)

        # 1. Resize selected area radius via perimeter handle
        if self.dragging_area_resize and self.selected_item and self.selected_item[1] == "area":
            idx = self.selected_item[2]
            areas = self.mission.get("dynamics", {}).get("areas", [])
            if idx < len(areas):
                area = areas[idx]
                new_rad = max(100.0, round(math.hypot(wx - area.get("x", 0), wy - area.get("y", 0)), 0))
                area["radius"] = new_rad
                self.ent_area_radius.delete(0, tk.END)
                self.ent_area_radius.insert(0, str(int(new_rad)))
                self.redraw_canvas()
                self.status_bar.config(text=f"Resizing Area '{area.get('name')}': Radius = {int(new_rad)}m")
            return

        # 2. Move selected vertex of polygon island
        if self.selected_item and self.selected_item[1] == "island" and self.selected_vertex_idx is not None:
            idx = self.selected_item[2]
            terrain = self.mission["map"].get("terrain", [])
            if idx < len(terrain):
                isl = terrain[idx]
                pts = isl.get("points", [])
                if self.selected_vertex_idx < len(pts):
                    pts[self.selected_vertex_idx] = [round(wx, 1), round(wy, 1)]
                    cx = sum(p[0] for p in pts) / len(pts)
                    cy = sum(p[1] for p in pts) / len(pts)
                    isl["x"] = round(cx, 1)
                    isl["y"] = round(cy, 1)
                    isl["radius"] = round(max(math.hypot(p[0] - cx, p[1] - cy) for p in pts) + 30, 1)
                    self.redraw_canvas()
            return

        # 3. Move selected entity (Island, Unit, or Area)
        if self.selected_item:
            layer, kind, idx = self.selected_item
            if layer == "map" and kind == "island":
                terrain = self.mission["map"].get("terrain", [])
                if idx < len(terrain):
                    isl = terrain[idx]
                    old_x = isl.get("x", 0)
                    old_y = isl.get("y", 0)
                    dx = wx - old_x
                    dy = wy - old_y
                    isl["x"] = round(wx, 1)
                    isl["y"] = round(wy, 1)
                    if isl.get("points"):
                        for pt in isl["points"]:
                            pt[0] = round(pt[0] + dx, 1)
                            pt[1] = round(pt[1] + dy, 1)
            elif layer == "units":
                u = self.mission.get("units", {})
                key = f"{kind}Units" if kind != "spawn" else "playerSpawns"
                if key in u and idx < len(u[key]):
                    u[key][idx]["x"] = round(wx, 1)
                    u[key][idx]["y"] = round(wy, 1)
            elif layer == "dynamics" and kind == "area":
                areas = self.mission.get("dynamics", {}).get("areas", [])
                if idx < len(areas):
                    area = areas[idx]
                    area["x"] = round(wx, 1)
                    area["y"] = round(wy, 1)
                    self.ent_area_x.delete(0, tk.END)
                    self.ent_area_x.insert(0, str(int(area["x"])))
                    self.ent_area_y.delete(0, tk.END)
                    self.ent_area_y.insert(0, str(int(area["y"])))
            self.redraw_canvas()
        else:
            dx = event.x - self.drag_start[0]
            dy = event.y - self.drag_start[1]
            self.cam_x -= dx / self.zoom
            self.cam_y -= dy / self.zoom
            self.drag_start = (event.x, event.y)
            self.redraw_canvas()

    def on_canvas_release(self, event):
        self.dragging_area_resize = False
        self.drag_start = None
        self.populate_form_from_mission()
        if self.selected_item:
            layer, kind, idx = self.selected_item
            if layer == "map" and kind == "island":
                terrain = self.mission["map"].get("terrain", [])
                if idx < len(terrain):
                    isl = terrain[idx]
                    self.ent_isl_x.delete(0, tk.END)
                    self.ent_isl_x.insert(0, str(int(isl.get("x", 0))))
                    self.ent_isl_y.delete(0, tk.END)
                    self.ent_isl_y.insert(0, str(int(isl.get("y", 0))))
                    self.ent_isl_rad.delete(0, tk.END)
                    self.ent_isl_rad.insert(0, str(int(isl.get("radius", 350))))
            elif layer == "dynamics" and kind == "area":
                areas = self.mission.get("dynamics", {}).get("areas", [])
                if idx < len(areas):
                    a = areas[idx]
                    self.ent_area_x.delete(0, tk.END)
                    self.ent_area_x.insert(0, str(int(a.get("x", 0))))
                    self.ent_area_y.delete(0, tk.END)
                    self.ent_area_y.insert(0, str(int(a.get("y", 0))))
                    self.ent_area_radius.delete(0, tk.END)
                    self.ent_area_radius.insert(0, str(int(a.get("radius", 2000))))

    # ----------------------------------------------------
    # FILE LOAD & SAVE
    # ----------------------------------------------------
    def new_mission(self):
        self.mission = self.get_empty_mission()
        self.current_mission_id = "new_mission"
        self.populate_form_from_mission()
        self.fit_map_view()

    def load_mission_by_id(self, mission_id):
        m_file = os.path.join(MISSIONS_DIR, f"{mission_id}.json")
        if os.path.exists(m_file):
            try:
                with open(m_file, "r", encoding="utf-8") as f:
                    self.mission = json.load(f)
                self.normalize_mission_areas()
                self.current_mission_id = mission_id
                self.populate_form_from_mission()
                self.fit_map_view()
                self.status_bar.config(text=f"Loaded mission: {mission_id} ({m_file})")
            except Exception as e:
                messagebox.showerror("Load Error", str(e))

    def open_mission_file(self):
        f = filedialog.askopenfilename(initialdir=MISSIONS_DIR, filetypes=[("Mission JSON", "*.json"), ("All Files", "*.*")])
        if f:
            try:
                with open(f, "r", encoding="utf-8") as jf:
                    self.mission = json.load(jf)
                self.normalize_mission_areas()
                self.current_mission_id = os.path.splitext(os.path.basename(f))[0]
                self.populate_form_from_mission()
                self.fit_map_view()
            except Exception as e:
                messagebox.showerror("Error", str(e))

    def normalize_mission_areas(self):
        d = self.mission.setdefault("dynamics", {})
        if "areas" not in d:
            if "areas" in self.mission.get("map", {}):
                d["areas"] = self.mission["map"]["areas"]
            elif "areas" in self.mission:
                d["areas"] = self.mission["areas"]
            else:
                d["areas"] = []
        self.mission.setdefault("map", {})["areas"] = d["areas"]

    def save_mission(self):
        m_id = self.ent_mission_id.get().strip() or "mission_custom"
        self.mission["map"]["id"] = m_id
        self.mission["dynamics"]["meta"]["id"] = m_id
        self.normalize_mission_areas()

        m_type = self.cb_mission_type.get()
        self.mission["missionType"] = m_type

        # Dynamics win & lose conditions
        d = self.mission.setdefault("dynamics", {})
        wc = d.setdefault("winConditions", {})
        wc["allPrimaryComplete"] = bool(self.var_win_all_primary.get())
        try:
            wc["requiredKills"] = int(self.ent_win_kills.get().strip() or "0")
        except ValueError:
            wc["requiredKills"] = 0

        lc = d.setdefault("loseConditions", {})
        lc["playerDestroyed"] = bool(self.var_lose_destroyed.get())
        try:
            lc["timeLimit"] = int(self.ent_lose_time.get().strip() or "0")
        except ValueError:
            lc["timeLimit"] = 0

        # Validate by mission type
        if m_type == "multiplayer":
            self.mission["noRespawn"] = False
            lc["noRespawn"] = False
            try:
                p_count = int(self.spin_player_count.get() or "4")
            except ValueError:
                p_count = 4
            self.mission["playerCount"] = p_count

            # Multiplayer ALWAYS uses player equipped aircraft & loadout
            self.mission["loadout"] = {"mode": "player"}

            # Requirement 1: Spawns for amount of players specified
            spawns = self.mission.get("units", {}).get("playerSpawns", [])
            if len(spawns) < p_count:
                messagebox.showerror(
                    "Multiplayer Validation Error",
                    f"Multiplayer missions require spawns for the amount of players specified.\n\n"
                    f"Specified Players: {p_count}\n"
                    f"Configured Spawns: {len(spawns)}\n\n"
                    f"Please add {p_count - len(spawns)} more spawn point(s) or click 'Auto-Generate Spawns'."
                )
                return

            # Requirement 2: Proper Win Condition
            has_win = wc["allPrimaryComplete"] or (wc["requiredKills"] > 0)
            if not has_win:
                messagebox.showerror(
                    "Multiplayer Validation Error",
                    "Multiplayer missions require proper game win/lose conditions.\n\n"
                    "Please configure at least one Win Condition (e.g. check 'All Primary Objectives Completed' or set 'Target Kills' > 0)."
                )
                return

            # Requirement 3: Proper Lose Condition
            has_lose = lc["playerDestroyed"] or (lc["timeLimit"] > 0)
            if not has_lose:
                messagebox.showerror(
                    "Multiplayer Validation Error",
                    "Multiplayer missions require proper game win/lose conditions.\n\n"
                    "Please configure at least one Lose Condition (e.g. check 'Player Aircraft Destroyed' or set 'Time Limit' > 0)."
                )
                return

        else: # Singleplayer
            self.mission["playerCount"] = 1
            l_mode = "forced" if self.cb_loadout_mode.get() == "Forced Aircraft & Loadout" else "player"
            self.mission["loadout"] = {
                "mode": l_mode,
                "aircraft": self.cb_forced_plane.get() if l_mode == "forced" else "f15c",
                "specialWeapon": self.cb_forced_spw.get() if l_mode == "forced" else "qaam"
            }
            no_resp = bool(self.var_no_respawn.get()) if hasattr(self, "var_no_respawn") else False
            self.mission["noRespawn"] = no_resp
            lc["noRespawn"] = no_resp
            if no_resp:
                lc["playerDestroyed"] = True

        out_file = os.path.join(MISSIONS_DIR, f"{m_id}.json")
        os.makedirs(MISSIONS_DIR, exist_ok=True)
        try:
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(self.mission, f, indent=2)

            manifest_data = {"version": "1.0", "missions": ["test_flight"], "defaultMission": "test_flight"}
            if os.path.exists(MANIFEST_FILE):
                try:
                    with open(MANIFEST_FILE, "r", encoding="utf-8") as mf:
                        manifest_data = json.load(mf)
                except Exception:
                    pass

            missions_list = manifest_data.setdefault("missions", [])
            if m_id not in missions_list:
                missions_list.append(m_id)

            with open(MANIFEST_FILE, "w", encoding="utf-8") as mf:
                json.dump(manifest_data, mf, indent=2)

            messagebox.showinfo("Mission Saved", f"Mission successfully saved to:\n{out_file}")
            self.status_bar.config(text=f"Saved mission '{m_id}' to {out_file}")
        except Exception as e:
            messagebox.showerror("Save Error", str(e))


if __name__ == "__main__":
    app = MissionEditorApp()
    app.mainloop()
