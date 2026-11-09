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
ABILITIES_LIST = ["highGBreak", "afterburnerSurge", "ecmJammer", "flareRing"]
PLANE_ROLES = ["FIGHTER", "STRIKE", "MULTIROLE", "ECM"]

DEFAULT_PLANE = {
    "id": "new_fighter",
    "name": "F-XX Custom",
    "shortName": "F-XX",
    "role": "Next-Gen Air Superiority Fighter",
    "planeRole": "FIGHTER",
    "sprite": "./assets/planes/f15c.png",
    "tags": ["AIR_SUPERIORITY", "SUPERCRUISE"],
    "stats": {"spd": 80, "def": 70, "air": 85, "gnd": 50},
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
        "ability": "highGBreak",
        "abilityCharges": 3,
        "maxAbilityCharges": 3,
        "abilityRecharge": 10.0
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

        self.notebook.add(self.tab_general, text="  1. General & Visuals  ")
        self.notebook.add(self.tab_tags, text="  2. Tags System  ")
        self.notebook.add(self.tab_stats, text="  3. Combat Stats  ")
        self.notebook.add(self.tab_weapons, text="  4. Weapons & Ability  ")
        self.notebook.add(self.tab_physics, text="  5. Flight Physics  ")

        self.build_tab_general()
        self.build_tab_tags()
        self.build_tab_stats()
        self.build_tab_weapons()
        self.build_tab_physics()

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
            ("sprite", "Sprite Asset Path:", "./assets/planes/su27.png"),
            ("description", "Description / Lore:", "Text...")
        ]

        for i, (k, lbl, default) in enumerate(rows):
            tk.Label(form_frame, text=lbl, bg="#0b131e", fg="#00ffcc", font=("Consolas", 10, "bold"), anchor="w").grid(row=i, column=0, sticky="w", pady=6)
            if k == "planeRole":
                cb = ttk.Combobox(form_frame, values=default, state="readonly", width=34)
                cb.grid(row=i, column=1, sticky="w", padx=10, pady=6)
                self.fields_gen[k] = cb
            elif k == "sprite":
                sf = tk.Frame(form_frame, bg="#0b131e")
                sf.grid(row=i, column=1, sticky="w", padx=10, pady=6)
                ent = ttk.Entry(sf, width=34)
                ent.pack(side="left")
                ent.bind("<KeyRelease>", lambda e: self.update_sprite_preview())
                btn_browse = tk.Button(sf, text="Browse...", bg="#1a2e44", fg="#00ffcc", font=("Consolas", 9),
                                       command=self.browse_sprite)
                btn_browse.pack(side="left", padx=6)
                self.fields_gen[k] = ent
            elif k == "description":
                txt = tk.Text(form_frame, height=4, width=44, bg="#132030", fg="#ffffff", font=("Consolas", 10), insertbackground="#00ff66")
                txt.grid(row=i, column=1, sticky="w", padx=10, pady=6)
                self.fields_gen[k] = txt
            else:
                ent = ttk.Entry(form_frame, width=38)
                ent.grid(row=i, column=1, sticky="w", padx=10, pady=6)
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
            self.listbox.insert(tk.END, f"{p_id.ljust(8)} | {name} [{role}]")

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
            var.set(stats.get(k, 75))

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

        self.ability_cb.set(weps.get("ability", "highGBreak"))
        self.ability_charges.delete(0, tk.END)
        self.ability_charges.insert(0, str(weps.get("abilityCharges", 3)))
        self.ability_recharge.delete(0, tk.END)
        self.ability_recharge.insert(0, str(weps.get("abilityRecharge", 10.0)))

        # Tab 5: Physics
        phys = data.get("physics", {})
        for k, ent in self.fields_phys.items():
            ent.delete(0, tk.END)
            ent.insert(0, str(phys.get(k, "")))
        self.tvc_var.set(bool(phys.get("hasThrustVectoring", False)))

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
        self.listbox.insert(tk.END, f"{new_id.ljust(8)} | {new_plane['name']} [FIGHTER]")
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
        self.listbox.insert(tk.END, f"{new_id.ljust(8)} | {cloned['name']} [{cloned.get('planeRole','FIGHTER')}]")
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

        data = {
            "id": p_id,
            "name": self.fields_gen["name"].get().strip(),
            "shortName": self.fields_gen["shortName"].get().strip(),
            "role": self.fields_gen["role"].get().strip(),
            "planeRole": self.fields_gen["planeRole"].get().strip(),
            "sprite": self.fields_gen["sprite"].get().strip(),
            "tags": tags,
            "stats": stats,
            "weapons": weps,
            "physics": phys,
            "description": self.fields_gen["description"].get("1.0", tk.END).strip()
        }
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
            # Adjust indent to match JS export
            replacement = r"\g<1>" + js_dict + r";\g<2>"
            new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

            with open(JS_AIRCRAFT_FILE, "w", encoding="utf-8") as f:
                f.write(new_content)
            self.status_bar.config(text=f"Synced {len(self.aircraft_cache)} aircraft to js/aircraft.js!")
        except Exception as e:
            print("Error syncing to JS:", e)


if __name__ == "__main__":
    app = AircraftEditorApp()
    app.mainloop()

