#!/usr/bin/env python3
"""
Web Legion - Aircraft Editor GUI
Allows viewing, editing, creating, and removing aircraft definitions.
Saves directly into data/aircraft/<id>.json, data/aircraft/manifest.json, and js/aircraft.js.
"""

import os
import sys
import json
import re
import glob
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from PIL import Image, ImageTk, ImageDraw

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "aircraft")
MANIFEST_FILE = os.path.join(DATA_DIR, "manifest.json")
PLANES_DIR = os.path.join(BASE_DIR, "assets", "planes")
JS_AIRCRAFT_FILE = os.path.join(BASE_DIR, "js", "aircraft.js")

STANDARD_TAGS = [
    "VTOL",
    "NAVAL",
    "CARRIER_CAPABLE",
    "STEALTH",
    "SUPERCRUISE",
    "PSM",
    "THRUST_VECTORING",
    "VARIABLE_GEOMETRY",
    "AIR_SUPERIORITY",
    "STRIKE",
    "MULTIROLE",
    "INTERCEPTOR",
    "ELECTRONIC_WARFARE",
    "HEAVY_FIGHTER",
    "TERRAIN_FOLLOWING",
    "HIGH_SPEED",
    "GUNSHIP",
    "DRONE"
]

SPECIAL_WEAPONS_LIST = ["qaam", "saam", "4aam", "hpaa", "ugb", "lasm", "sffs", "mpbm"]
ABILITIES_LIST = ["aoaLimiter", "emDispenser", "sensorFusion", "cobraManeuver", "emergencyAfterburner"]
PLANE_ROLES = ["FIGHTER", "STRIKE", "MULTIROLE", "ECM"]

DEFAULT_PLANE = {
    "id": "new_fighter",
    "name": "F-XX Custom",
    "shortName": "F-XX",
    "role": "Next-Gen Air Superiority Fighter",
    "planeRole": "FIGHTER",
    "tier": 0,
    "partSlots": 3,
    "cost": 0,
    "sprite": "./assets/planes/f15c.png",
    "tags": ["AIR_SUPERIORITY", "SUPERCRUISE"],
    "stats": {"spd": 80, "def": 70, "air": 85, "gnd": 50, "stealth": 0},
    "weapons": {
        "gunAmmo": 800,
        "maxGunAmmo": 800,
        "gunRpm": 3000,
        "gunDamage": 1.0,
        "mslCount": 80,
        "maxMslCount": 80,
        "mslCooldown": 4.4,
        "flareCount": 32,
        "maxFlareCount": 32,
        "flarePool": 2,
        "flareCooldown": 20.0,
        "specialWeapons": ["qaam", "4aam", "hpaa"],
        "equippedSpecialWeapon": "qaam",
        "spwAmmo": {"qaam": 24, "4aam": 32, "hpaa": 18},
        "ability": "emergencyAfterburner",
        "abilityCharges": 1,
        "maxAbilityCharges": 1,
        "abilityRecharge": 45.0
    },
    "physics": {
        "mass": 18000,
        "accelCruise": 65,
        "accelAfterburner": 150,
        "airbrakeDecel": 85,
        "baseTurnRate": 2.3,
        "turnResponse": 10.5,
        "cornerSpeed": 280,
        "normalMinSpeed": 152.8,
        "forcedMinSpeed": 97.22,
        "stallSpeed": 270,
        "cruiseSpeed": 330,
        "maxSpeed": 540,
        "compressionFactor": 0.50,
        "maxG": 11.5,
        "grip": 3.0,
        "highAlphaDrag": 70,
        "inducedDragFactor": 10.0,
        "driftTolerance": 0.80,
        "hasThrustVectoring": False,
        "engineCount": 2,
        "nozzleSpacing": 20,
        "wingspan": 80,
        "wingtipChord": -18,
        "length": 108,
        "engineOffset": -46
    },
    "scale": 1.0,
    "nodes": {
        "engines": [
            {"x": -10.0, "y": -46.0},
            {"x": 10.0, "y": -46.0}
        ],
        "wingtips": [
            {"x": -40.0, "y": -18.0},
            {"x": 40.0, "y": -18.0}
        ]
    },
    "description": "High performance custom fighter platform."
}


class AircraftEditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Web Legion - Aircraft Editor & Modularizer")
        self.geometry("1100x780")
        self.minsize(980, 680)
        self.configure(bg="#0b131e")

        self.aircraft_cache = {}
        self.current_id = None
        self.tag_vars = {}
        self.sprite_photo_main = None
        self.sprite_photo_sidebar = None

        # Node Editor & Scale state
        self.nodes_data = {"engines": [], "wingtips": []}
        self.selected_node = None
        self.node_tool_mode = tk.StringVar(value="select")
        self.auto_symmetry_var = tk.BooleanVar(value=True)
        self.drag_data = {"active": False, "node_type": None, "node_idx": None}
        self.node_zoom = 2.8
        self.node_canvas_center = (260, 260)
        self.node_canvas_photo = None

        self.setup_styles()
        self.build_ui()
        self.load_all_aircraft()

    def setup_styles(self):
        self.style = ttk.Style(self)
        try:
            self.style.theme_use("clam")
        except Exception:
            pass

        self.style.configure(".", background="#0b131e", foreground="#00ff66", font=("Consolas", 10))
        self.style.configure("TNotebook", background="#0b131e", borderwidth=0)
        self.style.configure("TNotebook.Tab", background="#152232", foreground="#88c0a0", padding=[12, 6], font=("Consolas", 10, "bold"))
        self.style.map("TNotebook.Tab",
            background=[("selected", "#1e334a"), ("active", "#1b2c40")],
            foreground=[("selected", "#00ff66"), ("active", "#ffffff")]
        )
        self.style.configure("TFrame", background="#0b131e")
        self.style.configure("Card.TFrame", background="#121d2b", relief="solid", borderwidth=1)
        self.style.configure("TLabel", background="#0b131e", foreground="#88c0a0")
        self.style.configure("Header.TLabel", font=("Consolas", 12, "bold"), foreground="#00ffcc")
        self.style.configure("TEntry", fieldbackground="#152332", foreground="#ffffff", insertcolor="#00ff66")
        self.style.configure("TCombobox", fieldbackground="#152332", foreground="#ffffff", background="#1a2d42")
        self.style.configure("TCheckbutton", background="#0b131e", foreground="#b0e0c0")
        self.style.map("TCheckbutton", foreground=[("active", "#00ff66")])

    def build_ui(self):
        # Top Header Bar
        top_bar = tk.Frame(self, bg="#0e1a29", height=50, bd=1, relief="ridge")
        top_bar.pack(side="top", fill="x")
        
        title_lbl = tk.Label(top_bar, text="AIRCRAFT MODULAR CONFIGURATION // TAC-SYS", 
                             bg="#0e1a29", fg="#00ff66", font=("Consolas", 13, "bold"), padx=15, pady=10)
        title_lbl.pack(side="left")

        btn_save = tk.Button(top_bar, text="[ SAVE ALL & SYNC CODE ]", bg="#006633", fg="#ffffff",
                             activebackground="#00994d", activeforeground="#ffffff",
                             font=("Consolas", 10, "bold"), bd=1, relief="raised", padx=12, pady=4,
                             command=self.save_current_aircraft)
        btn_save.pack(side="right", padx=15, pady=8)

        # Main Layout: Left Sidebar + Right Notebook
        main_pane = tk.PanedWindow(self, orient="horizontal", bg="#050a10", bd=0, sashwidth=4)
        main_pane.pack(fill="both", expand=True, padx=8, pady=8)

        # ------------------ LEFT SIDEBAR ------------------
        sidebar = tk.Frame(main_pane, bg="#0e1724", width=260)
        main_pane.add(sidebar, minsize=240)

        side_title = tk.Label(sidebar, text="// AIRCRAFT REGISTRY", bg="#0e1724", fg="#00ffcc", 
                              font=("Consolas", 11, "bold"), anchor="w", padx=10, pady=8)
        side_title.pack(fill="x")

        self.listbox = tk.Listbox(sidebar, bg="#132030", fg="#c0f0d0", selectbackground="#00aa55",
                                  selectforeground="#ffffff", font=("Consolas", 10), bd=0,
                                  highlightthickness=1, highlightcolor="#00ff66")
        self.listbox.pack(fill="both", expand=True, padx=8, pady=4)
        self.listbox.bind("<<ListboxSelect>>", self.on_select_aircraft)

        # Sidebar Buttons
        btn_frame = tk.Frame(sidebar, bg="#0e1724")
        btn_frame.pack(fill="x", padx=8, pady=8)

        btn_new = tk.Button(btn_frame, text="+ New", bg="#183048", fg="#00ffcc", font=("Consolas", 9, "bold"),
                            command=self.create_new_aircraft)
        btn_new.pack(side="left", expand=True, fill="x", padx=2)

        btn_clone = tk.Button(btn_frame, text="Clone", bg="#183048", fg="#00ffcc", font=("Consolas", 9, "bold"),
                              command=self.clone_aircraft)
        btn_clone.pack(side="left", expand=True, fill="x", padx=2)

        btn_del = tk.Button(btn_frame, text="- Delete", bg="#4a1818", fg="#ff8888", font=("Consolas", 9, "bold"),
                            command=self.delete_aircraft)
        btn_del.pack(side="left", expand=True, fill="x", padx=2)

        # Sidebar Sprite Preview
        side_preview_frame = tk.Frame(sidebar, bg="#101c2b", bd=1, relief="ridge", padx=6, pady=6)
        side_preview_frame.pack(fill="x", padx=8, pady=(4, 8))
        tk.Label(side_preview_frame, text="// SPRITE PREVIEW", bg="#101c2b", fg="#00ffcc",
                 font=("Consolas", 8, "bold")).pack(anchor="w")
        self.sidebar_sprite_canvas = tk.Canvas(side_preview_frame, width=220, height=125, bg="#071018",
                                               highlightthickness=1, highlightbackground="#1b3044")
        self.sidebar_sprite_canvas.pack(fill="x", pady=4)
        self.sidebar_sprite_label = tk.Label(side_preview_frame, text="No sprite", bg="#101c2b", fg="#88c0a0",
                                             font=("Consolas", 8))
        self.sidebar_sprite_label.pack(anchor="w")

        # ------------------ RIGHT NOTEBOOK ------------------
        right_panel = tk.Frame(main_pane, bg="#0b131e")
        main_pane.add(right_panel, minsize=680)

        self.notebook = ttk.Notebook(right_panel)
        self.notebook.pack(fill="both", expand=True)

        self.tab_general = ttk.Frame(self.notebook)
        self.tab_tags = ttk.Frame(self.notebook)
        self.tab_stats = ttk.Frame(self.notebook)
        self.tab_weapons = ttk.Frame(self.notebook)
        self.tab_physics = ttk.Frame(self.notebook)
        self.tab_nodes = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_general, text="  1. General & Visuals  ")
        self.notebook.add(self.tab_tags, text="  2. Tags System  ")
        self.notebook.add(self.tab_stats, text="  3. Combat Stats  ")
        self.notebook.add(self.tab_weapons, text="  4. Weapons & Ability  ")
        self.notebook.add(self.tab_physics, text="  5. Flight Physics  ")
        self.notebook.add(self.tab_nodes, text="  6. Nodes & Visual Scale  ")

        self.build_tab_general()
        self.build_tab_tags()
        self.build_tab_stats()
        self.build_tab_weapons()
        self.build_tab_physics()
        self.build_tab_nodes()

        # Status Bar
        self.status_bar = tk.Label(self, text="Ready.", bg="#081018", fg="#88b0a0", 
                                   font=("Consolas", 9), anchor="w", padx=10, pady=3)
        self.status_bar.pack(side="bottom", fill="x")

    # ----------------------------------------------------
    # TAB 1: GENERAL & VISUALS
    # ----------------------------------------------------
    def build_tab_general(self):
        container = tk.Frame(self.tab_general, bg="#0b131e", padx=16, pady=16)
        container.pack(fill="both", expand=True)

        # Left Column: Form Fields
        form_frame = tk.Frame(container, bg="#0b131e")
        form_frame.pack(side="left", fill="both", expand=True, padx=(0, 16))

        # Right Column: Visual Sprite Schematic Viewer
        preview_frame = tk.Frame(container, bg="#101c2b", bd=1, relief="ridge", padx=14, pady=14)
        preview_frame.pack(side="right", fill="both", expand=False)

        self.fields_gen = {}
        rows = [
            ("id", "Aircraft ID (key):", "su27"),
            ("name", "Full Name:", "Su-27 Flanker"),
            ("shortName", "HUD / Radar Callout:", "Su-27"),
            ("role", "Military Designation:", "Air Superiority Fighter"),
            ("planeRole", "Combat Damage Role:", PLANE_ROLES),
            ("scale", "Visual Scale Multiplier:", 1.0),
            ("tier", "Aircraft Tier (0-10):", 0),
            ("partSlots", "Upgrade Part Slots:", 3),
            ("cost", "Shop Purchase Cost ($):", 150000),
            ("sprite", "Sprite Asset Path:", "./assets/planes/su27.png"),
            ("description", "Description / Lore:", "Text...")
        ]

        for i, (k, lbl, default) in enumerate(rows):
            tk.Label(form_frame, text=lbl, bg="#0b131e", fg="#00ffcc", font=("Consolas", 10, "bold"), anchor="w").grid(row=i, column=0, sticky="w", pady=5)
            if k == "planeRole":
                cb = ttk.Combobox(form_frame, values=default, state="readonly", width=34)
                cb.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                self.fields_gen[k] = cb
            elif k == "scale":
                sf = tk.Frame(form_frame, bg="#0b131e")
                sf.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                sp = tk.Spinbox(sf, from_=0.30, to=2.50, increment=0.05, width=6, bg="#132030", fg="#00ffcc",
                                buttonbackground="#183048", font=("Consolas", 10, "bold"),
                                command=self.on_scale_changed_from_general)
                sp.delete(0, tk.END)
                sp.insert(0, "1.00")
                sp.pack(side="left")
                sp.bind("<KeyRelease>", lambda e: self.on_scale_changed_from_general())
                self.fields_gen[k] = sp
                tk.Label(sf, text="(e.g. 0.78 MiG-17, 1.00 standard, 1.15 F-111)", bg="#0b131e",
                         fg="#88b0a0", font=("Consolas", 9), padx=8).pack(side="left")
            elif k == "tier":
                tf = tk.Frame(form_frame, bg="#0b131e")
                tf.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                sp = tk.Spinbox(tf, from_=0, to=10, width=5, bg="#132030", fg="#00ffcc",
                                buttonbackground="#183048", font=("Consolas", 10, "bold"),
                                command=self.update_tier_badge)
                sp.pack(side="left")
                sp.bind("<KeyRelease>", lambda e: self.update_tier_badge())
                self.fields_gen[k] = sp
                self.lbl_tier_badge = tk.Label(tf, text="Tier 0 // STARTER AIRCRAFT", bg="#0b131e",
                                               fg="#00e5ff", font=("Consolas", 9, "bold"), padx=8)
                self.lbl_tier_badge.pack(side="left")
            elif k == "partSlots":
                sf = tk.Frame(form_frame, bg="#0b131e")
                sf.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                sp = tk.Spinbox(sf, from_=0, to=10, width=5, bg="#132030", fg="#00ffcc",
                                buttonbackground="#183048", font=("Consolas", 10, "bold"))
                sp.pack(side="left")
                self.fields_gen[k] = sp
                tk.Label(sf, text="(Slots for upgrade pods: Flare Pod, IRST, Tuners)", bg="#0b131e",
                         fg="#88b0a0", font=("Consolas", 9), padx=8).pack(side="left")
            elif k == "cost":
                cf = tk.Frame(form_frame, bg="#0b131e")
                cf.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                ent = ttk.Entry(cf, width=16)
                ent.pack(side="left")
                self.fields_gen[k] = ent
                tk.Label(cf, text="Credits (Purchase cost to unlock in Shop / Hangar)", bg="#0b131e",
                         fg="#88b0a0", font=("Consolas", 9), padx=8).pack(side="left")
            elif k == "sprite":
                sf = tk.Frame(form_frame, bg="#0b131e")
                sf.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                ent = ttk.Entry(sf, width=34)
                ent.pack(side="left")
                ent.bind("<KeyRelease>", lambda e: self.update_sprite_preview())
                btn_browse = tk.Button(sf, text="Browse...", bg="#1a2e44", fg="#00ffcc", font=("Consolas", 9),
                                       command=self.browse_sprite)
                btn_browse.pack(side="left", padx=6)
                self.fields_gen[k] = ent
            elif k == "description":
                txt = tk.Text(form_frame, height=4, width=44, bg="#132030", fg="#ffffff", font=("Consolas", 10), insertbackground="#00ff66")
                txt.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                self.fields_gen[k] = txt
            else:
                ent = ttk.Entry(form_frame, width=38)
                ent.grid(row=i, column=1, sticky="w", padx=10, pady=5)
                self.fields_gen[k] = ent

        # Right Frame Components: HUD Canvas + Metadata
        tk.Label(preview_frame, text="// AIRCRAFT SPRITE SCHEMATIC", bg="#101c2b", fg="#00ffcc",
                 font=("Consolas", 11, "bold")).pack(anchor="w", pady=(0, 6))

        self.sprite_canvas = tk.Canvas(preview_frame, width=320, height=320, bg="#071018",
                                       highlightthickness=1, highlightbackground="#00ff66")
        self.sprite_canvas.pack(pady=4)

        self.lbl_sprite_info = tk.Label(preview_frame, text="Sprite: None", bg="#101c2b", fg="#88e0c0",
                                        font=("Consolas", 9), justify="left", anchor="w")
        self.lbl_sprite_info.pack(fill="x", pady=6)

        btn_box = tk.Frame(preview_frame, bg="#101c2b")
        btn_box.pack(fill="x", pady=2)
        tk.Button(btn_box, text="Open Assets Folder", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"),
                  command=self.open_sprites_folder).pack(side="left", expand=True, fill="x", padx=2)
        tk.Button(btn_box, text="Reload Sprite", bg="#183048", fg="#00ffcc", font=("Consolas", 8, "bold"),
                  command=lambda: self.update_sprite_preview()).pack(side="left", expand=True, fill="x", padx=2)

    def update_tier_badge(self, val=None):
        if not hasattr(self, "lbl_tier_badge") or not hasattr(self, "fields_gen") or "tier" not in self.fields_gen:
            return
        if val is None:
            try:
                val = int(self.fields_gen["tier"].get() or 0)
            except Exception:
                val = 0
        val = max(0, min(10, val))
        tier_names = {
            0: "Tier 0 // STARTER AIRCRAFT",
            1: "Tier 1 // EARLY COMBAT / LIGHT",
            2: "Tier 2 // TACTICAL / INTERDICTOR",
            3: "Tier 3 // EARLY 4TH-GEN FIGHTER",
            4: "Tier 4 // MAINLINE 4TH-GEN SUPERIORITY",
            5: "Tier 5 // ADVANCED 4TH-GEN + COBRA",
            6: "Tier 6 // 4.5-GEN HEAVY COMBAT",
            7: "Tier 7 // ADVANCED 4.5+ GEN MULTIROLE",
            8: "Tier 8 // 5TH-GEN STEALTH FIGHTER",
            9: "Tier 9 // ADVANCED 5TH-GEN APEX",
            10: "Tier 10 // TOP TIER // EXPERIMENTAL DOMINANCE"
        }
        self.lbl_tier_badge.config(text=tier_names.get(val, f"Tier {val}"))

    def draw_hud_grid(self, canvas, w, h, center_color="#004422", line_color="#002214"):
        canvas.delete("all")
        cx, cy = w // 2, h // 2
        for r in [w * 0.20, w * 0.35, w * 0.46]:
            canvas.create_oval(cx - r, cy - r, cx + r, cy + r, outline=line_color, width=1, dash=(3, 3))
        canvas.create_line(0, cy, w, cy, fill=center_color, width=1)
        canvas.create_line(cx, 0, cx, h, fill=center_color, width=1)
        # Corner brackets
        b = 10
        canvas.create_line(4, 4, 4 + b, 4, fill="#00aa55")
        canvas.create_line(4, 4, 4, 4 + b, fill="#00aa55")
        canvas.create_line(w - 4, 4, w - 4 - b, 4, fill="#00aa55")
        canvas.create_line(w - 4, 4, w - 4, 4 + b, fill="#00aa55")
        canvas.create_line(4, h - 4, 4 + b, h - 4, fill="#00aa55")
        canvas.create_line(4, h - 4, 4, h - 4 - b, fill="#00aa55")
        canvas.create_line(w - 4, h - 4, w - 4 - b, h - 4, fill="#00aa55")
        canvas.create_line(w - 4, h - 4, w - 4, h - 4 - b, fill="#00aa55")

    def update_sprite_preview(self, path=None):
        if path is None:
            if hasattr(self, "fields_gen") and "sprite" in self.fields_gen:
                path = self.fields_gen["sprite"].get().strip()
            else:
                path = ""

        clean_path = str(path).strip().replace("\\", "/")
        if not clean_path:
            if hasattr(self, "sprite_canvas"):
                self.draw_hud_grid(self.sprite_canvas, 320, 320)
                self.sprite_canvas.create_text(160, 160, text="NO SPRITE ASSIGNED", fill="#668877", font=("Consolas", 10, "bold"))
            if hasattr(self, "sidebar_sprite_canvas"):
                self.draw_hud_grid(self.sidebar_sprite_canvas, 220, 125)
                self.sidebar_sprite_canvas.create_text(110, 62, text="NO SPRITE", fill="#557766", font=("Consolas", 8))
                self.sidebar_sprite_label.config(text="No sprite assigned", fg="#88c0a0")
            if hasattr(self, "lbl_sprite_info"):
                self.lbl_sprite_info.config(text="No sprite asset specified.", fg="#88c0a0")
            return

        candidates = [
            clean_path,
            os.path.join(BASE_DIR, clean_path.lstrip("./\\")),
            os.path.join(PLANES_DIR, os.path.basename(clean_path)),
            os.path.join(BASE_DIR, "assets", "planes", os.path.basename(clean_path))
        ]
        found_path = None
        for c in candidates:
            if os.path.isfile(c):
                found_path = os.path.abspath(c)
                break

        if not found_path:
            if hasattr(self, "sprite_canvas"):
                self.draw_hud_grid(self.sprite_canvas, 320, 320)
                self.sprite_canvas.create_text(160, 140, text="[ SPRITE NOT FOUND ]", fill="#ff6644", font=("Consolas", 10, "bold"))
                self.sprite_canvas.create_text(160, 175, text=os.path.basename(clean_path), fill="#ffaa88", font=("Consolas", 9))
            if hasattr(self, "sidebar_sprite_canvas"):
                self.draw_hud_grid(self.sidebar_sprite_canvas, 220, 125)
                self.sidebar_sprite_canvas.create_text(110, 62, text="NOT FOUND", fill="#ff6644", font=("Consolas", 8, "bold"))
                self.sidebar_sprite_label.config(text="File missing on disk", fg="#ff7777")
            if hasattr(self, "lbl_sprite_info"):
                self.lbl_sprite_info.config(text=f"Asset Missing:\n{clean_path}", fg="#ff7777")
            return

        try:
            pil_img = Image.open(found_path).convert("RGBA")
            orig_w, orig_h = pil_img.size

            # Main preview: max 290x290
            main_max_w, main_max_h = 290, 290
            scale_main = min(main_max_w / orig_w, main_max_h / orig_h, 1.0)
            target_main_w = max(1, int(orig_w * scale_main))
            target_main_h = max(1, int(orig_h * scale_main))
            resized_main = pil_img.resize((target_main_w, target_main_h), Image.Resampling.LANCZOS)
            self.sprite_photo_main = ImageTk.PhotoImage(resized_main)

            if hasattr(self, "sprite_canvas"):
                self.draw_hud_grid(self.sprite_canvas, 320, 320)
                self.sprite_canvas.create_image(160, 160, image=self.sprite_photo_main, anchor="center")
                self.sprite_canvas.create_text(8, 312, text=f"{orig_w}x{orig_h}px", fill="#00ff66", anchor="sw", font=("Consolas", 8))

            # Sidebar thumbnail: max 190x105
            side_max_w, side_max_h = 190, 105
            scale_side = min(side_max_w / orig_w, side_max_h / orig_h, 1.0)
            target_side_w = max(1, int(orig_w * scale_side))
            target_side_h = max(1, int(orig_h * scale_side))
            resized_side = pil_img.resize((target_side_w, target_side_h), Image.Resampling.LANCZOS)
            self.sprite_photo_sidebar = ImageTk.PhotoImage(resized_side)

            if hasattr(self, "sidebar_sprite_canvas"):
                self.draw_hud_grid(self.sidebar_sprite_canvas, 220, 125)
                self.sidebar_sprite_canvas.create_image(110, 62, image=self.sprite_photo_sidebar, anchor="center")
                self.sidebar_sprite_label.config(text=f"{os.path.basename(found_path)} ({orig_w}x{orig_h})", fg="#88c0a0")

            if hasattr(self, "lbl_sprite_info"):
                rel_display = os.path.relpath(found_path, BASE_DIR).replace("\\", "/")
                self.lbl_sprite_info.config(
                    text=f"Asset: ./{rel_display}\nResolution: {orig_w} x {orig_h} px | RGBA\nStatus: Online & Ready",
                    fg="#88e0c0"
                )
        except Exception as e:
            print("Error rendering sprite:", e)

    def open_sprites_folder(self):
        try:
            if sys.platform == "win32":
                os.startfile(PLANES_DIR)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", PLANES_DIR])
            else:
                subprocess.Popen(["xdg-open", PLANES_DIR])
        except Exception:
            messagebox.showinfo("Planes Directory", f"Planes directory path:\n{PLANES_DIR}")

    def browse_sprite(self):
        f = filedialog.askopenfilename(initialdir=PLANES_DIR, filetypes=[("PNG Images", "*.png"), ("All Files", "*.*")])
        if f:
            rel = os.path.relpath(f, BASE_DIR).replace("\\", "/")
            if not rel.startswith("./") and not rel.startswith("../"):
                rel = "./" + rel
            self.fields_gen["sprite"].delete(0, tk.END)
            self.fields_gen["sprite"].insert(0, rel)
            self.update_sprite_preview(rel)

    # ----------------------------------------------------
    # TAB 2: TAGS SYSTEM
    # ----------------------------------------------------
    def build_tab_tags(self):
        frame = tk.Frame(self.tab_tags, bg="#0b131e", padx=20, pady=20)
        frame.pack(fill="both", expand=True)

        header = tk.Label(frame, text="// AIRCRAFT TAGS (CARRIER / MISSION GATING / ATTRIBUTES)",
                          bg="#0b131e", fg="#00ffcc", font=("Consolas", 11, "bold"))
        header.pack(anchor="w", pady=(0, 10))

        sub = tk.Label(frame, text="Tags govern mission suitability, carrier operations, and stealth/flight rules.",
                       bg="#0b131e", fg="#88b0a0", font=("Consolas", 9))
        sub.pack(anchor="w", pady=(0, 15))

        tags_box = tk.Frame(frame, bg="#101c2b", bd=1, relief="ridge", padx=15, pady=15)
        tags_box.pack(fill="both", expand=True)

        self.tag_vars = {}
        cols = 3
        for i, tag in enumerate(STANDARD_TAGS):
            v = tk.BooleanVar(value=False)
            self.tag_vars[tag] = v
            cb = tk.Checkbutton(tags_box, text=tag, variable=v, bg="#101c2b", fg="#b8e8d0",
                                selectcolor="#006633", activebackground="#101c2b", activeforeground="#00ff66",
                                font=("Consolas", 10))
            cb.grid(row=i // cols, column=i % cols, sticky="w", padx=15, pady=6)

        # Custom tag field
        cust_frame = tk.Frame(frame, bg="#0b131e", pady=10)
        cust_frame.pack(fill="x")
        tk.Label(cust_frame, text="Additional Custom Tags (comma-separated):", bg="#0b131e", fg="#00ffcc", font=("Consolas", 10, "bold")).pack(anchor="w")
        self.custom_tags_entry = ttk.Entry(cust_frame, width=60)
        self.custom_tags_entry.pack(anchor="w", pady=4)

    # ----------------------------------------------------
    # TAB 3: COMBAT STATS
    # ----------------------------------------------------
    def build_tab_stats(self):
        frame = tk.Frame(self.tab_stats, bg="#0b131e", padx=20, pady=20)
        frame.pack(fill="both", expand=True)

        tk.Label(frame, text="// CORE COMBAT PERFORMANCE STATS (0 - 100)",
                 bg="#0b131e", fg="#00ffcc", font=("Consolas", 11, "bold")).pack(anchor="w", pady=(0, 15))

        self.stat_vars = {}
        stats = [
            ("spd", "Maneuverability / Turn Authority (SPD):", 85),
            ("def", "Airframe Armor / Defense (DEF):", 70),
            ("air", "Air-to-Air Combat Rating (AIR):", 90),
            ("gnd", "Surface Strike Rating (GND):", 60)
        ]

        for k, lbl, def_val in stats:
            row = tk.Frame(frame, bg="#0b131e", pady=8)
            row.pack(fill="x")
            tk.Label(row, text=lbl, bg="#0b131e", fg="#c0f0d0", font=("Consolas", 10), width=38, anchor="w").pack(side="left")
            var = tk.IntVar(value=def_val)
            self.stat_vars[k] = var
            scale = tk.Scale(row, from_=10, to_=100, orient="horizontal", variable=var,
                             bg="#142234", fg="#00ff66", highlightbackground="#0b131e", length=280)
            scale.pack(side="left", padx=10)
            val_lbl = tk.Label(row, textvariable=var, bg="#0b131e", fg="#00ffcc", font=("Consolas", 10, "bold"), width=4)
            val_lbl.pack(side="left")

        # Stealth Signature Rating (0 - 4)
        box_stealth = tk.LabelFrame(frame, text=" Radar Stealth Signature & Cross-Section (0 - 4) ", bg="#101c2b", fg="#00e5ff", font=("Consolas", 10, "bold"), padx=12, pady=10)
        box_stealth.pack(fill="x", pady=(18, 5))

        s_row = tk.Frame(box_stealth, bg="#101c2b")
        s_row.pack(fill="x", pady=4)
        tk.Label(s_row, text="Stealth Stat (0 - 4):", bg="#101c2b", fg="#c0f0d0", font=("Consolas", 10, "bold"), width=34, anchor="w").pack(side="left")

        var_stealth = tk.IntVar(value=0)
        self.stat_vars["stealth"] = var_stealth

        self.lbl_stealth_desc = tk.Label(box_stealth, text="", bg="#101c2b", fg="#00ffcc", font=("Consolas", 9), justify="left", wraplength=700)

        def on_stealth_change(*args):
            try:
                val = var_stealth.get()
            except Exception:
                val = 0
            descs = {
                0: "LEVEL 0 [STANDARD]: Full radar cross-section. Always appears on the minimap radar anywhere on map.",
                1: "LEVEL 1 [LOW STEALTH]: Reduced radar cross-section. Only appears on radar minimap within 1/4th of the map distance.",
                2: "LEVEL 2 [MEDIUM STEALTH]: Moderate stealth shaping. Only appears on radar minimap within 1/8th of the map distance.",
                3: "LEVEL 3 [HIGH STEALTH]: Advanced stealth. Only appears on radar minimap within visual distance (on screen). Slightly reduced lock-on range (must be on screen to lock, lock lost if off-screen).",
                4: "LEVEL 4 [RADAR GHOST]: Ultimate stealth. NEVER appears on the radar minimap. Lockable in visual range with slightly reduced lock-on range (must be on screen to lock, lock lost if off-screen)."
            }
            self.lbl_stealth_desc.config(text=descs.get(val, ""))

        var_stealth.trace_add("write", on_stealth_change)

        scale_stealth = tk.Scale(s_row, from_=0, to_=4, resolution=1, orient="horizontal", variable=var_stealth,
                                 bg="#142234", fg="#00e5ff", highlightbackground="#101c2b", length=280)
        scale_stealth.pack(side="left", padx=10)

        val_stl_lbl = tk.Label(s_row, textvariable=var_stealth, bg="#101c2b", fg="#00e5ff", font=("Consolas", 10, "bold"), width=4)
        val_stl_lbl.pack(side="left")

        self.lbl_stealth_desc.pack(anchor="w", pady=(8, 2))
        on_stealth_change()

    # ----------------------------------------------------
    # TAB 4: WEAPONS & ABILITY
    # ----------------------------------------------------
    def build_tab_weapons(self):
        canvas = tk.Canvas(self.tab_weapons, bg="#0b131e", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.tab_weapons, orient="vertical", command=canvas.yview)
        frame = tk.Frame(canvas, bg="#0b131e", padx=15, pady=15)
        
        frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self.fields_wep = {}

        # Machine Gun
        sec1 = tk.LabelFrame(frame, text=" Machine Gun Armament ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        sec1.pack(fill="x", pady=6)
        for i, (k, l, v) in enumerate([("gunAmmo", "Gun Ammo:", 800), ("gunRpm", "Gun RPM:", 3000), ("gunDamage", "Gun Damage (per hit):", 1.0)]):
            tk.Label(sec1, text=l, bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=i, column=0, sticky="w", pady=3)
            ent = ttk.Entry(sec1, width=16)
            ent.grid(row=i, column=1, sticky="w", padx=10, pady=3)
            self.fields_wep[k] = ent

        # Standard Missile & Flares
        sec2 = tk.LabelFrame(frame, text=" Standard Missiles & Flares ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        sec2.pack(fill="x", pady=6)
        for i, (k, l, v) in enumerate([
            ("mslCount", "Standard MSL Count:", 80),
            ("mslCooldown", "MSL Slot Recharge (s):", 4.4),
            ("flareCount", "Flare Count:", 32),
            ("flarePool", "Flare Reload Slots [||]:", 2),
            ("flareCooldown", "Flare Recharge (s):", 20.0)
        ]):
            tk.Label(sec2, text=l, bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=i, column=0, sticky="w", pady=3)
            ent = ttk.Entry(sec2, width=16)
            ent.grid(row=i, column=1, sticky="w", padx=10, pady=3)
            self.fields_wep[k] = ent

        # Special Weapons
        sec3 = tk.LabelFrame(frame, text=" Special Weapons Loadout ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        sec3.pack(fill="x", pady=6)

        tk.Label(sec3, text="Slot 1 Weapon:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w", pady=3)
        self.spw1_cb = ttk.Combobox(sec3, values=SPECIAL_WEAPONS_LIST, state="readonly", width=14)
        self.spw1_cb.grid(row=0, column=1, sticky="w", padx=6, pady=3)
        tk.Label(sec3, text="Ammo:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=0, column=2, sticky="w")
        self.spw1_ammo = ttk.Entry(sec3, width=8)
        self.spw1_ammo.grid(row=0, column=3, sticky="w", padx=6)

        tk.Label(sec3, text="Slot 2 Weapon:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=1, column=0, sticky="w", pady=3)
        self.spw2_cb = ttk.Combobox(sec3, values=SPECIAL_WEAPONS_LIST, state="readonly", width=14)
        self.spw2_cb.grid(row=1, column=1, sticky="w", padx=6, pady=3)
        tk.Label(sec3, text="Ammo:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=1, column=2, sticky="w")
        self.spw2_ammo = ttk.Entry(sec3, width=8)
        self.spw2_ammo.grid(row=1, column=3, sticky="w", padx=6)

        tk.Label(sec3, text="Slot 3 Weapon:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=2, column=0, sticky="w", pady=3)
        self.spw3_cb = ttk.Combobox(sec3, values=SPECIAL_WEAPONS_LIST, state="readonly", width=14)
        self.spw3_cb.grid(row=2, column=1, sticky="w", padx=6, pady=3)
        tk.Label(sec3, text="Ammo:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=2, column=2, sticky="w")
        self.spw3_ammo = ttk.Entry(sec3, width=8)
        self.spw3_ammo.grid(row=2, column=3, sticky="w", padx=6)

        # Ability
        sec4 = tk.LabelFrame(frame, text=" Tactical Ability ", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold"), padx=10, pady=8)
        sec4.pack(fill="x", pady=6)
        tk.Label(sec4, text="Ability Type:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w", pady=3)
        self.ability_cb = ttk.Combobox(sec4, values=ABILITIES_LIST, state="readonly", width=18)
        self.ability_cb.grid(row=0, column=1, sticky="w", padx=6, pady=3)

        tk.Label(sec4, text="Charges:", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=0, column=2, sticky="w")
        self.ability_charges = ttk.Entry(sec4, width=6)
        self.ability_charges.grid(row=0, column=3, sticky="w", padx=6)

        tk.Label(sec4, text="Recharge (s):", bg="#101c2b", fg="#c0e0d0", font=("Consolas", 9)).grid(row=0, column=4, sticky="w")
        self.ability_recharge = ttk.Entry(sec4, width=8)
        self.ability_recharge.grid(row=0, column=5, sticky="w", padx=6)

        self.lbl_ability_desc = tk.Label(sec4, text="", bg="#101c2b", fg="#00e5ff", font=("Consolas", 8), wraplength=700, justify="left")
        self.lbl_ability_desc.grid(row=1, column=0, columnspan=6, sticky="w", pady=(4, 2))

        def on_ability_changed(event=None):
            a_id = self.ability_cb.get()
            info = {
                "aoaLimiter": ("Bypasses angle-of-attack limits below 400 kph, locking flight trajectory for up to 1.5s while allowing nose to point anywhere, followed by 1s mouse pointing. Cancels below 130 kph. 5s cooldown starts after ability ends.", 1, 5.0),
                "emDispenser": ("Rapid-fires an intense continuous string of flares behind the plane for 2 seconds. Flares linger in the air 1 second longer. 35s cooldown starts after ability ends.", 1, 35.0),
                "sensorFusion": ("Integrates radar and optical sensor arrays, making planes with stealth 1, 2, and 3 visible from 150% further distance for 5 seconds. 20s cooldown starts after ability ends.", 1, 20.0),
                "cobraManeuver": ("Pitches airframe vertically into a Pugachev Cobra, rapidly shedding speed to just above stall speed while generating thick wing vapor. 25s cooldown starts after ability ends.", 1, 25.0),
                "emergencyAfterburner": ("Injects emergency stage fuel boosting acceleration to 160% and top speed to 110% for 4 seconds before returning to normal. 45s cooldown starts after ability ends.", 1, 45.0)
            }
            if a_id in info:
                desc, chg, cd = info[a_id]
                self.lbl_ability_desc.config(text=desc)
                if event:
                    self.ability_charges.delete(0, tk.END)
                    self.ability_charges.insert(0, str(chg))
                    self.ability_recharge.delete(0, tk.END)
                    self.ability_recharge.insert(0, str(cd))

        self.ability_cb.bind("<<ComboboxSelected>>", on_ability_changed)
        self.on_ability_changed_fn = on_ability_changed

    # ----------------------------------------------------
    # TAB 5: FLIGHT PHYSICS
    # ----------------------------------------------------
    def build_tab_physics(self):
        canvas = tk.Canvas(self.tab_physics, bg="#0b131e", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.tab_physics, orient="vertical", command=canvas.yview)
        frame = tk.Frame(canvas, bg="#0b131e", padx=15, pady=15)

        frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self.fields_phys = {}

        phys_params = [
            ("mass", "Airframe Mass (kg):", 18000),
            ("accelCruise", "Forward Cruise Thrust Accel (m/s²):", 65),
            ("accelAfterburner", "Afterburner Accel (m/s²):", 150),
            ("airbrakeDecel", "Airbrake Deceleration (m/s²):", 85),
            ("baseTurnRate", "Base Turn Pitch Rate (rad/s):", 2.3),
            ("turnResponse", "Rotational Agility (turnResponse):", 10.5),
            ("cornerSpeed", "Corner Speed (m/s):", 280),
            ("cruiseSpeed", "Cruise Speed (m/s):", 330),
            ("maxSpeed", "Max Speed (m/s):", 540),
            ("stallSpeed", "Displayed Stall Speed Threshold (KPH):", 270),
            ("compressionFactor", "High-Speed Compression (0.3 - 0.9):", 0.50),
            ("maxG", "Structural Max G (e.g. 11.5):", 11.5),
            ("grip", "Lateral Grip (e.g. 3.0):", 3.0),
            ("highAlphaDrag", "High-Alpha Induced Drag (e.g. 70):", 70),
            ("inducedDragFactor", "Afterburner Turn Drag Factor (e.g. 10.0):", 10.0),
            ("driftTolerance", "Post-Stall Drift Tolerance (0.4 - 1.0):", 0.80),
            ("wingspan", "Wingspan Sprite Scale:", 80),
            ("length", "Length Sprite Scale:", 108),
            ("engineCount", "Engine Count (1 or 2):", 2),
            ("nozzleSpacing", "Twin Engine Nozzle Spacing:", 20)
        ]

        for i, (k, l, v) in enumerate(phys_params):
            r = i // 2
            c = (i % 2) * 2
            tk.Label(frame, text=l, bg="#0b131e", fg="#c0f0d0", font=("Consolas", 9), anchor="w").grid(row=r, column=c, sticky="w", padx=6, pady=4)
            ent = ttk.Entry(frame, width=12)
            ent.grid(row=r, column=c+1, sticky="w", padx=6, pady=4)
            self.fields_phys[k] = ent

        self.tvc_var = tk.BooleanVar(value=False)
        cb_tvc = tk.Checkbutton(frame, text="Thrust Vectoring TVC (Maintains nose control in stalls)",
                                variable=self.tvc_var, bg="#0b131e", fg="#00ffcc", selectcolor="#006633",
                                font=("Consolas", 10, "bold"))
        cb_tvc.grid(row=(len(phys_params) // 2) + 1, column=0, columnspan=3, sticky="w", pady=10)

    def on_scale_changed_from_general(self):
        if not hasattr(self, "fields_gen") or "scale" not in self.fields_gen:
            return
        val_str = self.fields_gen["scale"].get().strip()
        if hasattr(self, "node_scale_spin") and self.node_scale_spin.get().strip() != val_str:
            self.node_scale_spin.delete(0, tk.END)
            self.node_scale_spin.insert(0, val_str)
        self.refresh_node_canvas(rebuild_sprite=True)

    # ----------------------------------------------------
    # TAB 6: NODES & VISUAL SCALE
    # ----------------------------------------------------
    def build_tab_nodes(self):
        container = tk.Frame(self.tab_nodes, bg="#0b131e", padx=12, pady=12)
        container.pack(fill="both", expand=True)

        # Left / Center Area: Canvas & Controls
        left_area = tk.Frame(container, bg="#0b131e")
        left_area.pack(side="left", fill="both", expand=True, padx=(0, 10))

        # Top Control Bar (Scale, Mode, Symmetry)
        ctrl_bar = tk.Frame(left_area, bg="#101c2b", bd=1, relief="ridge", padx=10, pady=8)
        ctrl_bar.pack(fill="x", pady=(0, 8))

        # Scale Spinbox & Presets
        scale_subframe = tk.Frame(ctrl_bar, bg="#101c2b")
        scale_subframe.pack(side="top", fill="x", pady=(0, 6))

        tk.Label(scale_subframe, text="AIRCRAFT SCALE:", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold")).pack(side="left", padx=(0, 6))
        self.node_scale_spin = tk.Spinbox(scale_subframe, from_=0.30, to=2.50, increment=0.05, width=6,
                                          bg="#132030", fg="#00ffcc", buttonbackground="#183048",
                                          font=("Consolas", 10, "bold"), command=self.on_node_scale_spin_change)
        self.node_scale_spin.delete(0, tk.END)
        self.node_scale_spin.insert(0, "1.00")
        self.node_scale_spin.pack(side="left", padx=(0, 10))
        self.node_scale_spin.bind("<KeyRelease>", lambda e: self.on_node_scale_spin_change())

        # Quick preset scale buttons
        presets = [("0.78 Tiny (MiG-17)", 0.78), ("0.82 Light", 0.82), ("1.00 Standard", 1.00), ("1.15 Heavy", 1.15)]
        for lbl, val in presets:
            tk.Button(scale_subframe, text=lbl, bg="#183048", fg="#c0f0d0", font=("Consolas", 8),
                      command=lambda v=val: self.set_scale_preset(v)).pack(side="left", padx=2)

        # Tool Mode Row
        mode_row = tk.Frame(ctrl_bar, bg="#101c2b")
        mode_row.pack(side="top", fill="x")

        tk.Label(mode_row, text="TOOL MODE:", bg="#101c2b", fg="#00ffcc", font=("Consolas", 10, "bold")).pack(side="left", padx=(0, 6))

        modes = [
            ("Select / Move", "select"),
            ("+ Engine Nozzle", "add_engine"),
            ("+ Wingtip Trail", "add_wingtip")
        ]
        self.mode_radios = {}
        for m_lbl, m_val in modes:
            rb = tk.Radiobutton(mode_row, text=m_lbl, value=m_val, variable=self.node_tool_mode,
                                indicatoron=False, bg="#152636", fg="#ffffff", selectcolor="#008855",
                                activebackground="#203d58", font=("Consolas", 9, "bold"),
                                padx=8, pady=3, command=self.on_tool_mode_changed)
            rb.pack(side="left", padx=4)
            self.mode_radios[m_val] = rb

        # Auto-Symmetry Checkbox
        cb_sym = tk.Checkbutton(mode_row, text="Auto-Symmetry (Mirror X)", variable=self.auto_symmetry_var,
                                bg="#101c2b", fg="#00ffcc", selectcolor="#006633", font=("Consolas", 9, "bold"))
        cb_sym.pack(side="right", padx=6)

        # Canvas Frame
        canvas_frame = tk.Frame(left_area, bg="#101c2b", bd=1, relief="ridge", padx=6, pady=6)
        canvas_frame.pack(fill="both", expand=True)

        self.node_canvas = tk.Canvas(canvas_frame, width=520, height=520, bg="#051015",
                                     highlightthickness=1, highlightbackground="#00ff66")
        self.node_canvas.pack(fill="both", expand=True)

        # Canvas Bindings
        self.node_canvas.bind("<Motion>", self.on_node_canvas_motion)
        self.node_canvas.bind("<Button-1>", self.on_node_canvas_click)
        self.node_canvas.bind("<B1-Motion>", self.on_node_canvas_drag)
        self.node_canvas.bind("<ButtonRelease-1>", self.on_node_canvas_release)

        # Bottom HUD Info Bar
        self.node_hud_lbl = tk.Label(canvas_frame, text="Cursor: X: +0.0, Y: +0.0 | No node selected",
                                     bg="#051015", fg="#88e0c0", font=("Consolas", 9), anchor="w", padx=6, pady=4)
        self.node_hud_lbl.pack(fill="x")

        # Right Area: Inspector & Action Sidebar
        right_side = tk.Frame(container, bg="#101c2b", bd=1, relief="ridge", width=290, padx=10, pady=10)
        right_side.pack(side="right", fill="both", expand=False)
        right_side.pack_propagate(False)

        tk.Label(right_side, text="// NODE INSPECTOR", bg="#101c2b", fg="#00ffcc",
                 font=("Consolas", 11, "bold")).pack(anchor="w", pady=(0, 6))

        # Node Listbox
        self.node_listbox = tk.Listbox(right_side, bg="#07121b", fg="#c0f0d0", selectbackground="#008855",
                                       selectforeground="#ffffff", font=("Consolas", 9), height=7, bd=0,
                                       highlightthickness=1, highlightcolor="#00ff66")
        self.node_listbox.pack(fill="x", pady=4)
        self.node_listbox.bind("<<ListboxSelect>>", self.on_node_listbox_select)

        # Numeric Edit Frame
        edit_box = tk.LabelFrame(right_side, text=" [ Selected Node Coordinates ] ", bg="#101c2b", fg="#00ffcc",
                                 font=("Consolas", 9, "bold"), padx=8, pady=8)
        edit_box.pack(fill="x", pady=8)

        tk.Label(edit_box, text="Lateral X (-Port / +Stbd):", bg="#101c2b", fg="#88e0c0", font=("Consolas", 9)).grid(row=0, column=0, sticky="w", pady=3)
        self.node_x_spin = tk.Spinbox(edit_box, from_=-150, to=150, increment=1.0, width=8,
                                      bg="#07121b", fg="#00ffcc", buttonbackground="#183048",
                                      font=("Consolas", 9, "bold"), command=self.on_inspector_coord_change)
        self.node_x_spin.grid(row=0, column=1, sticky="e", pady=3)
        self.node_x_spin.bind("<KeyRelease>", lambda e: self.on_inspector_coord_change())

        tk.Label(edit_box, text="Longitudinal Y (+Nose / -Tail):", bg="#101c2b", fg="#88e0c0", font=("Consolas", 9)).grid(row=1, column=0, sticky="w", pady=3)
        self.node_y_spin = tk.Spinbox(edit_box, from_=-150, to=150, increment=1.0, width=8,
                                      bg="#07121b", fg="#00ffcc", buttonbackground="#183048",
                                      font=("Consolas", 9, "bold"), command=self.on_inspector_coord_change)
        self.node_y_spin.grid(row=1, column=1, sticky="e", pady=3)
        self.node_y_spin.bind("<KeyRelease>", lambda e: self.on_inspector_coord_change())

        # Inspector Action Buttons
        btn_box1 = tk.Frame(right_side, bg="#101c2b")
        btn_box1.pack(fill="x", pady=4)

        tk.Button(btn_box1, text="Mirror X", bg="#183048", fg="#00ffcc", font=("Consolas", 9, "bold"),
                  command=self.mirror_selected_node).pack(side="left", expand=True, fill="x", padx=2)
        tk.Button(btn_box1, text="Delete Node", bg="#4a1818", fg="#ff8888", font=("Consolas", 9, "bold"),
                  command=self.delete_selected_node).pack(side="left", expand=True, fill="x", padx=2)

        btn_box2 = tk.Frame(right_side, bg="#101c2b")
        btn_box2.pack(fill="x", pady=4)
        tk.Button(btn_box2, text="Reset to Airframe Defaults", bg="#183048", fg="#c0f0d0", font=("Consolas", 9),
                  command=self.reset_nodes_to_defaults).pack(fill="x", pady=2)
        tk.Button(btn_box2, text="Clear All Nodes", bg="#2a1a1a", fg="#ff9999", font=("Consolas", 9),
                  command=self.clear_all_nodes).pack(fill="x", pady=2)

        # Legend & Guide
        legend = tk.LabelFrame(right_side, text=" [ Legend & Guide ] ", bg="#101c2b", fg="#00ffcc",
                               font=("Consolas", 9, "bold"), padx=8, pady=8)
        legend.pack(fill="both", expand=True, pady=(8, 0))

        guide_text = (
            "• Orange Marker [E]: Engine Nozzle\n"
            "  Spawns afterburner plumes/exhaust.\n"
            "  Single engine -> 1 plume on center.\n\n"
            "• Cyan Marker [W]: Wingtip Trail\n"
            "  Spawns condensation vapor trails\n"
            "  during high-G / high-alpha turns.\n\n"
            "• Coordinate System:\n"
            "  X = 0: Centerline\n"
            "  -X / +X: Left / Right Wings\n"
            "  +Y: Nose / Forward\n"
            "  -Y: Tail / Nozzle Exhaust\n\n"
            "• Tips:\n"
            "  Click & drag nodes directly on canvas.\n"
            "  Auto-Symmetry keeps port & stbd even."
        )
        tk.Label(legend, text=guide_text, bg="#101c2b", fg="#88b8a8", font=("Consolas", 8),
                 justify="left", anchor="nw").pack(fill="both", expand=True)

    def on_node_scale_spin_change(self):
        if not hasattr(self, "node_scale_spin"):
            return
        val_str = self.node_scale_spin.get().strip()
        if hasattr(self, "fields_gen") and "scale" in self.fields_gen:
            if self.fields_gen["scale"].get().strip() != val_str:
                self.fields_gen["scale"].delete(0, tk.END)
                self.fields_gen["scale"].insert(0, val_str)
        self.refresh_node_canvas(rebuild_sprite=True)

    def set_scale_preset(self, val):
        val_str = f"{val:.2f}"
        if hasattr(self, "node_scale_spin"):
            self.node_scale_spin.delete(0, tk.END)
            self.node_scale_spin.insert(0, val_str)
        if hasattr(self, "fields_gen") and "scale" in self.fields_gen:
            self.fields_gen["scale"].delete(0, tk.END)
            self.fields_gen["scale"].insert(0, val_str)
        self.refresh_node_canvas(rebuild_sprite=True)

    def on_tool_mode_changed(self):
        mode = self.node_tool_mode.get()
        if mode != "select":
            self.selected_node = None
            self.refresh_node_inspector()
            self.refresh_node_canvas(rebuild_sprite=False)

    def get_aircraft_sprite_up(self, p_id, target_length, scale, canvas_size=520):
        data = self.aircraft_cache.get(p_id, {})
        clean_path = str(data.get("sprite", "")).strip().replace("\\", "/")
        if not clean_path and hasattr(self, "fields_gen") and "sprite" in self.fields_gen:
            clean_path = self.fields_gen["sprite"].get().strip().replace("\\", "/")

        candidates = [
            clean_path,
            os.path.join(BASE_DIR, clean_path.lstrip("./\\")),
            os.path.join(PLANES_DIR, os.path.basename(clean_path)),
            os.path.join(BASE_DIR, "assets", "planes", os.path.basename(clean_path))
        ]
        found_path = None
        for c in candidates:
            if c and os.path.isfile(c):
                found_path = os.path.abspath(c)
                break
        if not found_path:
            return None

        try:
            pil_img = Image.open(found_path).convert("RGBA")
            rot = pil_img.rotate(-45, expand=True, resample=Image.Resampling.BILINEAR)
            target_size = max(16, int(target_length * scale * self.node_zoom))
            scaled = rot.resize((target_size, target_size), Image.Resampling.LANCZOS)
            return ImageTk.PhotoImage(scaled)
        except Exception as e:
            print(f"Error loading rotated sprite for {p_id}:", e)
            return None

    def refresh_node_canvas(self, rebuild_sprite=True):
        if not hasattr(self, "node_canvas"):
            return

        cw = self.node_canvas.winfo_width()
        ch = self.node_canvas.winfo_height()
        if cw < 50 or ch < 50:
            cw, ch = 520, 520
        cx, cy = cw // 2, ch // 2
        self.node_canvas_center = (cx, cy)

        if rebuild_sprite:
            self.node_canvas.delete("all")
            self.draw_hud_grid(self.node_canvas, cw, ch, center_color="#006633", line_color="#002214")

            length = 105.0
            if hasattr(self, "fields_phys") and "length" in self.fields_phys:
                try:
                    length = float(self.fields_phys["length"].get() or 105)
                except Exception:
                    length = 105.0

            scale = 1.0
            if hasattr(self, "node_scale_spin"):
                try:
                    scale = float(self.node_scale_spin.get() or 1.0)
                except Exception:
                    scale = 1.0

            self.node_canvas_photo = self.get_aircraft_sprite_up(self.current_id, length, scale, max(cw, ch))
            if self.node_canvas_photo:
                self.node_canvas.create_image(cx, cy, image=self.node_canvas_photo, anchor="center", tags="plane_sprite")

            # Draw tactical axis guidelines
            self.node_canvas.create_line(cx, 0, cx, ch, fill="#00aa55", dash=(4, 4), width=1, tags="axis_lines")
            self.node_canvas.create_line(0, cy, cw, cy, fill="#005533", dash=(4, 4), width=1, tags="axis_lines")
            self.node_canvas.create_text(cx + 6, 12, text="NOSE (+Y)", fill="#00ff66", anchor="nw", font=("Consolas", 8, "bold"), tags="axis_lines")
            self.node_canvas.create_text(cx + 6, ch - 16, text="TAIL (-Y)", fill="#ff6644", anchor="nw", font=("Consolas", 8, "bold"), tags="axis_lines")
            self.node_canvas.create_text(10, cy - 14, text="PORT (-X)", fill="#00e5ff", anchor="nw", font=("Consolas", 8, "bold"), tags="axis_lines")
            self.node_canvas.create_text(cw - 80, cy - 14, text="STBD (+X)", fill="#00e5ff", anchor="nw", font=("Consolas", 8, "bold"), tags="axis_lines")
        else:
            self.node_canvas.delete("marker")

        # Draw Engine Nodes
        for i, en in enumerate(self.nodes_data.get("engines", [])):
            nx = cx + (en["x"] * self.node_zoom)
            ny = cy - (en["y"] * self.node_zoom)
            is_sel = (self.selected_node == ("engines", i))

            # Directional exhaust vector arrow pointing down (aft)
            self.node_canvas.create_line(nx, ny + 4, nx, ny + 26, fill="#ff5500", width=2, arrow="last", tags="marker")

            r = 8
            self.node_canvas.create_oval(nx - r, ny - r, nx + r, ny + r, fill="#3a1400", outline="#ff7700", width=2, tags="marker")
            self.node_canvas.create_oval(nx - 2, ny - 2, nx + 2, ny + 2, fill="#ffee44", outline="", tags="marker")
            self.node_canvas.create_text(nx, ny - 13, text=f"E{i+1}", fill="#ffaa44", font=("Consolas", 9, "bold"), tags="marker")

            if is_sel:
                self.node_canvas.create_oval(nx - 13, ny - 13, nx + 13, ny + 13, outline="#ffff00", width=2, tags="marker")

        # Draw Wingtip Nodes
        for i, wt in enumerate(self.nodes_data.get("wingtips", [])):
            nx = cx + (wt["x"] * self.node_zoom)
            ny = cy - (wt["y"] * self.node_zoom)
            is_sel = (self.selected_node == ("wingtips", i))

            # Vapor trail streak extending aft
            self.node_canvas.create_line(nx, ny + 4, nx, ny + 30, fill="#0099bb", dash=(3, 3), width=1.5, tags="marker")

            r = 7
            self.node_canvas.create_oval(nx - r, ny - r, nx + r, ny + r, fill="#002233", outline="#00e5ff", width=2, tags="marker")
            self.node_canvas.create_oval(nx - 2, ny - 2, nx + 2, ny + 2, fill="#ffffff", outline="", tags="marker")
            self.node_canvas.create_text(nx, ny - 12, text=f"W{i+1}", fill="#00ffcc", font=("Consolas", 9, "bold"), tags="marker")

            if is_sel:
                self.node_canvas.create_oval(nx - 12, ny - 12, nx + 12, ny + 12, outline="#ffff00", width=2, tags="marker")

    def refresh_node_inspector(self):
        if not hasattr(self, "node_listbox"):
            return
        self.node_listbox.delete(0, tk.END)

        for i, en in enumerate(self.nodes_data.get("engines", [])):
            x_val = en.get("x", 0.0)
            y_val = en.get("y", 0.0)
            self.node_listbox.insert(tk.END, f"[E{i+1}] Engine:  x: {x_val:+5.1f}, y: {y_val:+5.1f}")

        for i, wt in enumerate(self.nodes_data.get("wingtips", [])):
            x_val = wt.get("x", 0.0)
            y_val = wt.get("y", 0.0)
            side = "(Port)" if x_val < 0 else "(Stbd)" if x_val > 0 else "(Center)"
            self.node_listbox.insert(tk.END, f"[W{i+1}] Wingtip: x: {x_val:+5.1f}, y: {y_val:+5.1f} {side}")

        if self.selected_node:
            ntype, nidx = self.selected_node
            items = self.nodes_data.get(ntype, [])
            if 0 <= nidx < len(items):
                cur = items[nidx]
                offset = 0 if ntype == "engines" else len(self.nodes_data.get("engines", []))
                self.node_listbox.selection_clear(0, tk.END)
                self.node_listbox.selection_set(offset + nidx)

                self.node_x_spin.delete(0, tk.END)
                self.node_x_spin.insert(0, f"{cur.get('x', 0.0):.1f}")
                self.node_y_spin.delete(0, tk.END)
                self.node_y_spin.insert(0, f"{cur.get('y', 0.0):.1f}")
                return

        self.node_x_spin.delete(0, tk.END)
        self.node_y_spin.delete(0, tk.END)

    def on_node_canvas_motion(self, event):
        cx, cy = self.node_canvas_center
        lx = round((event.x - cx) / self.node_zoom, 1)
        ly = round(-(event.y - cy) / self.node_zoom, 1)

        sel_str = "No node selected"
        if self.selected_node:
            ntype, nidx = self.selected_node
            items = self.nodes_data.get(ntype, [])
            if 0 <= nidx < len(items):
                prefix = f"E{nidx+1}" if ntype == "engines" else f"W{nidx+1}"
                sel_str = f"Selected: [{prefix}] (x: {items[nidx].get('x', 0):+.1f}, y: {items[nidx].get('y', 0):+.1f})"

        self.node_hud_lbl.config(text=f"Cursor: X: {lx:+5.1f}, Y: {ly:+5.1f} | {sel_str}")

        # Check hover distance to node
        hovered = self.find_node_near(event.x, event.y, max_dist=12)
        if hovered:
            self.node_canvas.config(cursor="hand2")
        elif self.node_tool_mode.get() != "select":
            self.node_canvas.config(cursor="crosshair")
        else:
            self.node_canvas.config(cursor="")

    def find_node_near(self, canvas_x, canvas_y, max_dist=12):
        cx, cy = self.node_canvas_center
        best = None
        best_dist = max_dist

        for i, en in enumerate(self.nodes_data.get("engines", [])):
            nx = cx + (en["x"] * self.node_zoom)
            ny = cy - (en["y"] * self.node_zoom)
            d = ((canvas_x - nx) ** 2 + (canvas_y - ny) ** 2) ** 0.5
            if d < best_dist:
                best_dist = d
                best = ("engines", i)

        for i, wt in enumerate(self.nodes_data.get("wingtips", [])):
            nx = cx + (wt["x"] * self.node_zoom)
            ny = cy - (wt["y"] * self.node_zoom)
            d = ((canvas_x - nx) ** 2 + (canvas_y - ny) ** 2) ** 0.5
            if d < best_dist:
                best_dist = d
                best = ("wingtips", i)

        return best

    def on_node_canvas_click(self, event):
        cx, cy = self.node_canvas_center
        lx = round((event.x - cx) / self.node_zoom, 1)
        ly = round(-(event.y - cy) / self.node_zoom, 1)

        mode = self.node_tool_mode.get()

        if mode == "select":
            clicked = self.find_node_near(event.x, event.y, max_dist=14)
            if clicked:
                self.selected_node = clicked
                self.drag_data = {"active": True, "node_type": clicked[0], "node_idx": clicked[1]}
            else:
                self.selected_node = None
                self.drag_data = {"active": False, "node_type": None, "node_idx": None}
            self.refresh_node_inspector()
            self.refresh_node_canvas(rebuild_sprite=False)

        elif mode == "add_engine":
            self.nodes_data["engines"].append({"x": lx, "y": ly})
            if self.auto_symmetry_var.get() and abs(lx) > 2.0:
                self.nodes_data["engines"].append({"x": -lx, "y": ly})
            self.node_tool_mode.set("select")
            self.selected_node = ("engines", len(self.nodes_data["engines"]) - 1)
            self.refresh_node_inspector()
            self.refresh_node_canvas(rebuild_sprite=False)

        elif mode == "add_wingtip":
            self.nodes_data["wingtips"].append({"x": lx, "y": ly})
            if self.auto_symmetry_var.get() and abs(lx) > 2.0:
                self.nodes_data["wingtips"].append({"x": -lx, "y": ly})
            self.node_tool_mode.set("select")
            self.selected_node = ("wingtips", len(self.nodes_data["wingtips"]) - 1)
            self.refresh_node_inspector()
            self.refresh_node_canvas(rebuild_sprite=False)

    def on_node_canvas_drag(self, event):
        if not self.drag_data.get("active") or not self.selected_node:
            return

        ntype, nidx = self.selected_node
        items = self.nodes_data.get(ntype, [])
        if not (0 <= nidx < len(items)):
            return

        cx, cy = self.node_canvas_center
        new_lx = round((event.x - cx) / self.node_zoom, 1)
        new_ly = round(-(event.y - cy) / self.node_zoom, 1)

        old_x = items[nidx]["x"]
        items[nidx]["x"] = new_lx
        items[nidx]["y"] = new_ly

        # Auto-symmetry mirror counterpart
        if self.auto_symmetry_var.get():
            for j, other in enumerate(items):
                if j != nidx and abs(other["x"] + old_x) < 4.0 and abs(other["y"] - items[nidx]["y"]) < 8.0:
                    other["x"] = -new_lx
                    other["y"] = new_ly
                    break

        if hasattr(self, "node_x_spin"):
            self.node_x_spin.delete(0, tk.END)
            self.node_x_spin.insert(0, f"{new_lx:.1f}")
        if hasattr(self, "node_y_spin"):
            self.node_y_spin.delete(0, tk.END)
            self.node_y_spin.insert(0, f"{new_ly:.1f}")

        self.refresh_node_canvas(rebuild_sprite=False)

    def on_node_canvas_release(self, event):
        self.drag_data = {"active": False, "node_type": None, "node_idx": None}
        self.refresh_node_inspector()

    def on_node_listbox_select(self, event):
        sel = self.node_listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        n_eng = len(self.nodes_data.get("engines", []))
        if idx < n_eng:
            self.selected_node = ("engines", idx)
        else:
            self.selected_node = ("wingtips", idx - n_eng)

        self.refresh_node_inspector()
        self.refresh_node_canvas(rebuild_sprite=False)

    def on_inspector_coord_change(self):
        if not self.selected_node:
            return
        ntype, nidx = self.selected_node
        items = self.nodes_data.get(ntype, [])
        if not (0 <= nidx < len(items)):
            return

        try:
            val_x = round(float(self.node_x_spin.get()), 1)
            val_y = round(float(self.node_y_spin.get()), 1)
        except Exception:
            return

        items[nidx]["x"] = val_x
        items[nidx]["y"] = val_y
        self.refresh_node_canvas(rebuild_sprite=False)

    def mirror_selected_node(self):
        if not self.selected_node:
            return
        ntype, nidx = self.selected_node
        items = self.nodes_data.get(ntype, [])
        if 0 <= nidx < len(items):
            items[nidx]["x"] = round(-items[nidx]["x"], 1)
            self.refresh_node_inspector()
            self.refresh_node_canvas(rebuild_sprite=False)

    def delete_selected_node(self):
        if not self.selected_node:
            return
        ntype, nidx = self.selected_node
        items = self.nodes_data.get(ntype, [])
        if 0 <= nidx < len(items):
            items.pop(nidx)
            self.selected_node = None
            self.refresh_node_inspector()
            self.refresh_node_canvas(rebuild_sprite=False)

    def reset_nodes_to_defaults(self):
        data = self.aircraft_cache.get(self.current_id, {})
        def_nodes = self.generate_default_nodes(data)
        self.nodes_data = {
            "engines": [dict(en) for en in def_nodes.get("engines", [])],
            "wingtips": [dict(wt) for wt in def_nodes.get("wingtips", [])]
        }
        self.selected_node = None
        self.refresh_node_inspector()
        self.refresh_node_canvas(rebuild_sprite=False)

    def clear_all_nodes(self):
        self.nodes_data = {"engines": [], "wingtips": []}
        self.selected_node = None
        self.refresh_node_inspector()
        self.refresh_node_canvas(rebuild_sprite=False)

    def generate_default_nodes(self, data):
        phys = data.get("physics", {})
        engine_count = int(phys.get("engineCount", 2) or 2)
        engine_offset = float(phys.get("engineOffset", -46) or -46)
        nozzle_spacing = float(phys.get("nozzleSpacing", 20) or 20)
        wingspan = float(phys.get("wingspan", 80) or 80)
        wingtip_chord = float(phys.get("wingtipChord", -16) or -16)

        engines = []
        if engine_count == 1:
            engines.append({"x": 0.0, "y": round(engine_offset, 1)})
        else:
            half_sp = round(nozzle_spacing * 0.5, 1)
            engines.append({"x": -half_sp, "y": round(engine_offset, 1)})
            engines.append({"x": half_sp, "y": round(engine_offset, 1)})

        half_span = round(wingspan * 0.5, 1)
        wingtips = [
            {"x": -half_span, "y": round(wingtip_chord, 1)},
            {"x": half_span, "y": round(wingtip_chord, 1)}
        ]
        return {"engines": engines, "wingtips": wingtips}

    # ----------------------------------------------------
    # DATA LOADING & SELECTION
    # ----------------------------------------------------
    def load_all_aircraft(self):
        self.aircraft_cache.clear()
        self.listbox.delete(0, tk.END)

        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR, exist_ok=True)

        # Load manifest
        manifest_planes = []
        if os.path.exists(MANIFEST_FILE):
            try:
                with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    manifest_planes = data.get("aircraft", [])
            except Exception as e:
                print("Manifest load error:", e)

        # Load json files
        for p_id in manifest_planes:
            p_file = os.path.join(DATA_DIR, f"{p_id}.json")
            if os.path.exists(p_file):
                try:
                    with open(p_file, "r", encoding="utf-8") as f:
                        self.aircraft_cache[p_id] = json.load(f)
                except Exception as e:
                    print(f"Error reading {p_file}:", e)

        # Catch any stray json files in directory
        for f in glob.glob(os.path.join(DATA_DIR, "*.json")):
            base = os.path.splitext(os.path.basename(f))[0]
            if base != "manifest" and base not in self.aircraft_cache:
                try:
                    with open(f, "r", encoding="utf-8") as jf:
                        self.aircraft_cache[base] = json.load(jf)
                except Exception:
                    pass

        # Populate listbox
        for p_id, p_data in self.aircraft_cache.items():
            name = p_data.get("name", p_id)
            role = p_data.get("planeRole", "FIGHTER")
            tier = p_data.get("tier", 0)
            self.listbox.insert(tk.END, f"[T{tier}] {p_id.ljust(8)} | {name} [{role}]")

        if self.aircraft_cache:
            self.listbox.selection_set(0)
            first_id = list(self.aircraft_cache.keys())[0]
            self.display_aircraft(first_id)
        self.status_bar.config(text=f"Loaded {len(self.aircraft_cache)} aircraft from {DATA_DIR}")

    def on_select_aircraft(self, event):
        sel = self.listbox.curselection()
        if not sel:
            return
        keys = list(self.aircraft_cache.keys())
        idx = sel[0]
        if idx < len(keys):
            self.display_aircraft(keys[idx])

    def display_aircraft(self, p_id):
        self.current_id = p_id
        data = self.aircraft_cache.get(p_id, {})

        # Tab 1: General
        for k in ["id", "name", "shortName", "role", "sprite"]:
            ent = self.fields_gen[k]
            ent.delete(0, tk.END)
            ent.insert(0, str(data.get(k, "")))

        self.fields_gen["planeRole"].set(data.get("planeRole", "FIGHTER"))

        tier_val = data.get("tier", 0)
        if "tier" in self.fields_gen:
            self.fields_gen["tier"].delete(0, tk.END)
            self.fields_gen["tier"].insert(0, str(tier_val))
            self.update_tier_badge(tier_val)

        if "partSlots" in self.fields_gen:
            slots_val = data.get("partSlots", 3)
            self.fields_gen["partSlots"].delete(0, tk.END)
            self.fields_gen["partSlots"].insert(0, str(slots_val))

        if "cost" in self.fields_gen:
            cost_val = data.get("cost", 0)
            self.fields_gen["cost"].delete(0, tk.END)
            self.fields_gen["cost"].insert(0, str(cost_val))

        self.fields_gen["description"].delete("1.0", tk.END)
        self.fields_gen["description"].insert("1.0", data.get("description", ""))
        self.update_sprite_preview(str(data.get("sprite", "")))

        # Tab 2: Tags
        plane_tags = [t.upper() for t in data.get("tags", [])]
        custom_tags = []
        for tag, var in self.tag_vars.items():
            var.set(tag in plane_tags)
        for t in plane_tags:
            if t not in STANDARD_TAGS:
                custom_tags.append(t)
        self.custom_tags_entry.delete(0, tk.END)
        self.custom_tags_entry.insert(0, ", ".join(custom_tags))

        # Tab 3: Stats
        stats = data.get("stats", {})
        for k, var in self.stat_vars.items():
            var.set(stats.get(k, 0 if k == "stealth" else 75))

        # Tab 4: Weapons
        weps = data.get("weapons", {})
        for k in ["gunAmmo", "gunRpm", "gunDamage", "mslCount", "mslCooldown", "flareCount", "flarePool", "flareCooldown"]:
            ent = self.fields_wep.get(k)
            if ent:
                ent.delete(0, tk.END)
                ent.insert(0, str(weps.get(k, "")))

        sp_list = weps.get("specialWeapons", ["qaam", "4aam", "ugb"])
        sp_ammo = weps.get("spwAmmo", {})

        s1 = sp_list[0] if len(sp_list) > 0 else "qaam"
        s2 = sp_list[1] if len(sp_list) > 1 else "4aam"
        s3 = sp_list[2] if len(sp_list) > 2 else "ugb"

        self.spw1_cb.set(s1)
        self.spw1_ammo.delete(0, tk.END)
        self.spw1_ammo.insert(0, str(sp_ammo.get(s1, 24)))

        self.spw2_cb.set(s2)
        self.spw2_ammo.delete(0, tk.END)
        self.spw2_ammo.insert(0, str(sp_ammo.get(s2, 32)))

        self.spw3_cb.set(s3)
        self.spw3_ammo.delete(0, tk.END)
        self.spw3_ammo.insert(0, str(sp_ammo.get(s3, 40)))

        self.ability_cb.set(weps.get("ability", "emergencyAfterburner"))
        self.ability_charges.delete(0, tk.END)
        self.ability_charges.insert(0, str(weps.get("abilityCharges", 1)))
        self.ability_recharge.delete(0, tk.END)
        self.ability_recharge.insert(0, str(weps.get("abilityRecharge", 45.0)))
        if hasattr(self, "on_ability_changed_fn"):
            self.on_ability_changed_fn()

        # Tab 5: Physics
        phys = data.get("physics", {})
        for k, ent in self.fields_phys.items():
            ent.delete(0, tk.END)
            ent.insert(0, str(phys.get(k, "")))
        self.tvc_var.set(bool(phys.get("hasThrustVectoring", False)))

        # Tab 6: Nodes & Visual Scale
        plane_scale = float(data.get("scale", data.get("physics", {}).get("scale", 1.0)) or 1.0)
        if "scale" in self.fields_gen:
            self.fields_gen["scale"].delete(0, tk.END)
            self.fields_gen["scale"].insert(0, f"{plane_scale:.2f}")

        if hasattr(self, "node_scale_spin"):
            self.node_scale_spin.delete(0, tk.END)
            self.node_scale_spin.insert(0, f"{plane_scale:.2f}")

        nodes_dict = data.get("nodes", data.get("physics", {}).get("nodes", None))
        if not nodes_dict or not isinstance(nodes_dict, dict) or ("engines" not in nodes_dict and "wingtips" not in nodes_dict):
            nodes_dict = self.generate_default_nodes(data)

        self.nodes_data = {
            "engines": [dict(en) for en in nodes_dict.get("engines", [])],
            "wingtips": [dict(wt) for wt in nodes_dict.get("wingtips", [])]
        }
        self.selected_node = None
        self.refresh_node_inspector()
        self.refresh_node_canvas(rebuild_sprite=True)

        self.status_bar.config(text=f"Editing: {p_id} ({data.get('name', '')})")

    # ----------------------------------------------------
    # CREATE, CLONE, DELETE
    # ----------------------------------------------------
    def create_new_aircraft(self):
        new_plane = json.loads(json.dumps(DEFAULT_PLANE))
        new_id = f"custom_{len(self.aircraft_cache) + 1}"
        new_plane["id"] = new_id
        new_plane["name"] = f"F/A-{len(self.aircraft_cache) + 1} Phoenix"
        self.aircraft_cache[new_id] = new_plane
        self.listbox.insert(tk.END, f"[T{new_plane.get('tier', 0)}] {new_id.ljust(8)} | {new_plane['name']} [FIGHTER]")
        self.listbox.selection_clear(0, tk.END)
        self.listbox.selection_set(tk.END)
        self.display_aircraft(new_id)

    def clone_aircraft(self):
        if not self.current_id or self.current_id not in self.aircraft_cache:
            return
        src = self.aircraft_cache[self.current_id]
        cloned = json.loads(json.dumps(src))
        new_id = f"{src['id']}_copy"
        cloned["id"] = new_id
        cloned["name"] = f"{src.get('name', 'Plane')} (Copy)"
        self.aircraft_cache[new_id] = cloned
        self.listbox.insert(tk.END, f"[T{cloned.get('tier', 0)}] {new_id.ljust(8)} | {cloned['name']} [{cloned.get('planeRole','FIGHTER')}]")
        self.listbox.selection_clear(0, tk.END)
        self.listbox.selection_set(tk.END)
        self.display_aircraft(new_id)

    def delete_aircraft(self):
        if not self.current_id or self.current_id not in self.aircraft_cache:
            return
        if len(self.aircraft_cache) <= 1:
            messagebox.showwarning("Warning", "Cannot delete the last remaining aircraft.")
            return
        confirm = messagebox.askyesno("Confirm Delete", f"Delete aircraft '{self.current_id}' from code and data files?")
        if not confirm:
            return

        del_id = self.current_id
        file_path = os.path.join(DATA_DIR, f"{del_id}.json")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print("Error removing file:", e)

        del self.aircraft_cache[del_id]
        self.save_manifest()
        self.sync_to_js()
        self.load_all_aircraft()
        messagebox.showinfo("Deleted", f"Aircraft '{del_id}' removed.")

    # ----------------------------------------------------
    # SAVE & SYNC TO CODE
    # ----------------------------------------------------
    def collect_form_data(self):
        p_id = self.fields_gen["id"].get().strip().lower()
        if not p_id:
            raise ValueError("Aircraft ID cannot be blank.")

        # Tags
        tags = []
        for tag, var in self.tag_vars.items():
            if var.get():
                tags.append(tag)
        cust_str = self.custom_tags_entry.get().strip()
        if cust_str:
            for ct in cust_str.split(","):
                ct = ct.strip().upper()
                if ct and ct not in tags:
                    tags.append(ct)

        # Stats
        stats = {k: var.get() for k, var in self.stat_vars.items()}

        # Weapons
        weps = {
            "gunAmmo": int(self.fields_wep["gunAmmo"].get() or 800),
            "maxGunAmmo": int(self.fields_wep["gunAmmo"].get() or 800),
            "gunRpm": int(self.fields_wep["gunRpm"].get() or 3000),
            "gunDamage": float(self.fields_wep["gunDamage"].get() or 1.0),
            "mslCount": int(self.fields_wep["mslCount"].get() or 80),
            "maxMslCount": int(self.fields_wep["mslCount"].get() or 80),
            "mslCooldown": float(self.fields_wep["mslCooldown"].get() or 4.4),
            "flareCount": int(self.fields_wep["flareCount"].get() or 32),
            "maxFlareCount": int(self.fields_wep["flareCount"].get() or 32),
            "flarePool": int(self.fields_wep["flarePool"].get() or 2),
            "flareCooldown": float(self.fields_wep["flareCooldown"].get() or 20.0),
            "specialWeapons": [self.spw1_cb.get(), self.spw2_cb.get(), self.spw3_cb.get()],
            "equippedSpecialWeapon": self.spw1_cb.get(),
            "spwAmmo": {
                self.spw1_cb.get(): int(self.spw1_ammo.get() or 24),
                self.spw2_cb.get(): int(self.spw2_ammo.get() or 32),
                self.spw3_cb.get(): int(self.spw3_ammo.get() or 40)
            },
            "ability": self.ability_cb.get(),
            "abilityCharges": int(self.ability_charges.get() or 3),
            "maxAbilityCharges": int(self.ability_charges.get() or 3),
            "abilityRecharge": float(self.ability_recharge.get() or 10.0)
        }

        # Physics
        phys = {
            "mass": float(self.fields_phys["mass"].get() or 18000),
            "accelCruise": float(self.fields_phys["accelCruise"].get() or 65),
            "accelAfterburner": float(self.fields_phys["accelAfterburner"].get() or 150),
            "airbrakeDecel": float(self.fields_phys["airbrakeDecel"].get() or 85),
            "baseTurnRate": float(self.fields_phys["baseTurnRate"].get() or 2.3),
            "turnResponse": float(self.fields_phys["turnResponse"].get() or 10.5),
            "cornerSpeed": float(self.fields_phys["cornerSpeed"].get() or 280),
            "normalMinSpeed": 152.8,
            "forcedMinSpeed": 97.22,
            "stallSpeed": float(self.fields_phys["stallSpeed"].get() or 270),
            "cruiseSpeed": float(self.fields_phys["cruiseSpeed"].get() or 330),
            "maxSpeed": float(self.fields_phys["maxSpeed"].get() or 540),
            "compressionFactor": float(self.fields_phys["compressionFactor"].get() or 0.50),
            "maxG": float(self.fields_phys["maxG"].get() or 11.5),
            "grip": float(self.fields_phys["grip"].get() or 3.0),
            "highAlphaDrag": float(self.fields_phys["highAlphaDrag"].get() or 70),
            "inducedDragFactor": float(self.fields_phys["inducedDragFactor"].get() or 10.0),
            "driftTolerance": float(self.fields_phys["driftTolerance"].get() or 0.80),
            "hasThrustVectoring": bool(self.tvc_var.get()),
            "engineCount": int(self.fields_phys["engineCount"].get() or 2),
            "nozzleSpacing": float(self.fields_phys["nozzleSpacing"].get() or 20),
            "wingspan": float(self.fields_phys["wingspan"].get() or 80),
            "wingtipChord": -18,
            "length": float(self.fields_phys["length"].get() or 108),
            "engineOffset": -46
        }

        try:
            tier_val = max(0, min(10, int(self.fields_gen["tier"].get() or 0)))
        except Exception:
            tier_val = 0

        try:
            slots_val = max(0, int(self.fields_gen["partSlots"].get() or 0))
        except Exception:
            slots_val = 0

        try:
            cost_val = max(0, int(self.fields_gen["cost"].get() or 0))
        except Exception:
            cost_val = 0

        try:
            scale_val = round(float(self.node_scale_spin.get() if hasattr(self, "node_scale_spin") else (self.fields_gen.get("scale", None) and self.fields_gen["scale"].get()) or 1.0), 2)
        except Exception:
            scale_val = 1.0

        nodes_clean = {
            "engines": [{"x": round(float(e.get("x", 0)), 1), "y": round(float(e.get("y", 0)), 1)} for e in self.nodes_data.get("engines", [])],
            "wingtips": [{"x": round(float(w.get("x", 0)), 1), "y": round(float(w.get("y", 0)), 1)} for w in self.nodes_data.get("wingtips", [])]
        }

        data = {
            "id": p_id,
            "name": self.fields_gen["name"].get().strip(),
            "shortName": self.fields_gen["shortName"].get().strip(),
            "role": self.fields_gen["role"].get().strip(),
            "planeRole": self.fields_gen["planeRole"].get().strip(),
            "scale": scale_val,
            "tier": tier_val,
            "partSlots": slots_val,
            "cost": cost_val,
            "sprite": self.fields_gen["sprite"].get().strip(),
            "tags": tags,
            "stats": stats,
            "weapons": weps,
            "physics": phys,
            "nodes": nodes_clean,
            "description": self.fields_gen["description"].get("1.0", tk.END).strip()
        }
        phys["scale"] = scale_val
        phys["nodes"] = nodes_clean
        return data

    def save_current_aircraft(self):
        try:
            data = self.collect_form_data()
        except Exception as e:
            messagebox.showerror("Validation Error", str(e))
            return

        p_id = data["id"]
        # If ID changed, clean old key
        if self.current_id and self.current_id != p_id and self.current_id in self.aircraft_cache:
            old_file = os.path.join(DATA_DIR, f"{self.current_id}.json")
            if os.path.exists(old_file):
                try:
                    os.remove(old_file)
                except Exception:
                    pass
            del self.aircraft_cache[self.current_id]

        self.aircraft_cache[p_id] = data
        self.current_id = p_id

        # Write json
        json_file = os.path.join(DATA_DIR, f"{p_id}.json")
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        self.save_manifest()
        self.sync_to_js()

        messagebox.showinfo("Saved", f"Aircraft '{p_id}' ({data['name']}) saved and synchronized to game code!")
        self.load_all_aircraft()

    def save_manifest(self):
        manifest_data = {
            "version": "1.0",
            "aircraft": list(self.aircraft_cache.keys())
        }
        with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

    def sync_to_js(self):
        """Re-writes AIRCRAFT_DATA object in js/aircraft.js with all current aircraft."""
        if not os.path.exists(JS_AIRCRAFT_FILE):
            return

        try:
            with open(JS_AIRCRAFT_FILE, "r", encoding="utf-8") as f:
                content = f.read()

            pattern = r"(export const AIRCRAFT_DATA = )\{.*?\};(\r?\n\r?\n// -{10,})"
            js_dict = json.dumps(self.aircraft_cache, indent=2)
            # Use lambda to avoid template backslash escape issues
            new_content = re.sub(pattern, lambda m: m.group(1) + js_dict + ";" + m.group(2), content, flags=re.DOTALL)

            with open(JS_AIRCRAFT_FILE, "w", encoding="utf-8") as f:
                f.write(new_content)
            self.status_bar.config(text=f"Synced {len(self.aircraft_cache)} aircraft to js/aircraft.js!")
        except Exception as e:
            print("Error syncing to JS:", e)


if __name__ == "__main__":
    app = AircraftEditorApp()
    app.mainloop()

