from PIL import Image
from pathlib import Path

def png_to_c_arrays(path: Path, outdir: Path, prefix: str = "sprite"):
    img = Image.open(path).convert("RGBA")
    img_q = img.convert("P", palette=Image.ADAPTIVE, colors=16)
    
    # Get palette
    pal = img_q.getpalette()[:16*3]
    palette = [tuple(pal[i*3:(i+1)*3]) for i in range(16)]
    
    # Write palette C file
    pal_c = outdir / f"{prefix}_palette.c"
    with pal_c.open("w") as f:
        f.write('#include <stdint.h>\n')
        f.write(f'const uint8_t {prefix}_palette[] = {{\n')
        for r,g,b in palette:
            f.write(f' {r},{g},{b},\n')
        f.write('};\n')
    
    # Split into 8x8 tiles
    tw, th = 8, 8
    w, h = img_q.size
    tiles = []
    tilemap = []
    for y in range(0,h,th):
        row = []
        for x in range(0,w,tw):
            tile = img_q.crop((x,y,x+tw,y+th))
            data = tuple(tile.getdata())
            if data in tiles:
                idx = tiles.index(data)
            else:
                idx = len(tiles)
                tiles.append(data)
            row.append(idx)
        tilemap.append(row)
    
    # Write tiles C file
    tiles_c = outdir / f"{prefix}_tiles.c"
    with tiles_c.open("w") as f:
        f.write('#include <stdint.h>\n')
        f.write(f'const uint16_t {prefix}_tile_count = {len(tiles)};\n')
        f.write(f'const uint8_t {prefix}_tile_w = {tw};\n')
        f.write(f'const uint8_t {prefix}_tile_h = {th};\n')
        f.write(f'const uint8_t {prefix}_tiles[] = {{\n')
        for t in tiles:
            f.write('  ' + ','.join(str(x) for x in t) + ',\n')
        f.write('};\n')
    
    # Write map C file
    map_c = outdir / f"{prefix}_map.c"
    with map_c.open("w") as f:
        f.write('#include <stdint.h>\n')
        f.write(f'const uint16_t {prefix}_map_h = {len(tilemap)};\n')
        f.write(f'const uint16_t {prefix}_map_w = {len(tilemap[0]) if tilemap else 0};\n')
        f.write(f'const uint16_t {prefix}_map[] = {{\n')
        for r in tilemap:
            f.write('  ' + ','.join(str(x) for x in r) + ',\n')
        f.write('};\n')
    
    return [pal_c, tiles_c, map_c]
