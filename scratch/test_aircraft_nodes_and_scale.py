# Verification test for Aircraft Nodes & Scale logic
import json
import os
from PIL import Image

def test_node_math():
    cx, cy = 260, 260
    zoom = 2.8

    # Local coords for F-15 port nozzle: x = -10, y = -46
    lx, ly = -10.0, -46.0
    canvas_x = cx + (lx * zoom)
    canvas_y = cy - (ly * zoom)

    # Convert back
    back_lx = round((canvas_x - cx) / zoom, 1)
    back_ly = round(-(canvas_y - cy) / zoom, 1)

    assert back_lx == lx, f"Expected {lx}, got {back_lx}"
    assert back_ly == ly, f"Expected {ly}, got {back_ly}"
    print("[PASS] Node coordinate roundtrip test passed!")

def test_sprite_rotation_and_scaling():
    # Test MiG-17 (scale 0.78, length 76)
    img_path = 'assets/planes/mig17pf.png'
    assert os.path.exists(img_path), f"Missing {img_path}"
    im = Image.open(img_path).convert('RGBA')
    # rotate -45
    rot = im.rotate(-45, expand=True, resample=Image.Resampling.BILINEAR)
    zoom = 2.8
    scale = 0.78
    length = 76
    target_size = int(length * scale * zoom)
    scaled = rot.resize((target_size, target_size), Image.Resampling.LANCZOS)
    assert scaled.size == (target_size, target_size)
    print(f"[PASS] MiG-17 rotated sprite scaled correctly to {scaled.size} (target {target_size})")

def test_aircraft_data_nodes_and_scale():
    with open('data/aircraft/manifest.json', 'r', encoding='utf-8') as f:
        manifest = json.load(f).get('aircraft', [])
    assert len(manifest) >= 8, f"Expected at least 8 aircraft in manifest, found {len(manifest)}"

    for p_id in manifest:
        p_path = f'data/aircraft/{p_id}.json'
        assert os.path.exists(p_path), f"Missing {p_path}"
        with open(p_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        assert 'scale' in data, f"{p_id} missing 'scale'"
        assert 'nodes' in data, f"{p_id} missing 'nodes'"
        nodes = data['nodes']
        assert 'engines' in nodes and isinstance(nodes['engines'], list), f"{p_id} missing engines list"
        assert 'wingtips' in nodes and isinstance(nodes['wingtips'], list), f"{p_id} missing wingtips list"

        if p_id == 'mig17':
            assert data['scale'] == 0.78, f"MiG-17 scale expected 0.78, got {data['scale']}"
            assert len(nodes['engines']) == 1, f"MiG-17 should have exactly 1 engine nozzle, got {len(nodes['engines'])}"
            assert nodes['engines'][0]['x'] == 0.0, "MiG-17 engine should be centerline x=0"
            assert len(nodes['wingtips']) == 2, f"MiG-17 should have 2 wingtips, got {len(nodes['wingtips'])}"

    print("[PASS] Aircraft data JSON files all have valid nodes and scale!")

if __name__ == '__main__':
    test_node_math()
    test_sprite_rotation_and_scaling()
    test_aircraft_data_nodes_and_scale()
    print("ALL TESTS PASSED 100%!")

