import wave
from pathlib import Path

def wav_to_c_array(path: Path, outdir: Path, prefix: str = "sfx"):
    with wave.open(str(path),'rb') as w:
        frames = w.readframes(w.getnframes())
    out = outdir / f"{prefix}_audio.c"
    with out.open("w") as f:
        f.write('#include <stdint.h>\n')
        f.write(f'const uint32_t {prefix}_audio_len = {len(frames)};\n')
        f.write(f'const uint8_t {prefix}_audio[] = {{\n')
        for i in range(0,len(frames),16):
            chunk = frames[i:i+16]
            f.write('  ' + ','.join(str(b) for b in chunk) + ',\n')
        f.write('};\n')
    return out
