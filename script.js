const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const convertBtn = document.getElementById("convert-btn");
let files = [];

// Drag & drop
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", e => { dropZone.classList.remove("dragover"); });
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  files.push(...e.dataTransfer.files);
  renderFileList();
});

function renderFileList() {
  fileList.innerHTML = "";
  files.forEach(f => {
    const li = document.createElement("li");
    li.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
    fileList.appendChild(li);
  });
}

// Convert PNG -> simple 16-color 8x8 tiles
async function pngToTilesC(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img,0,0);
      const data = ctx.getImageData(0,0,img.width,img.height).data;
      let cArray = `const uint8_t ${file.name.split('.')[0]}[] = {\n`;
      for(let i=0;i<data.length;i+=4){
        const gray = Math.round((data[i]+data[i+1]+data[i+2])/48); // 0-15
        cArray += gray + ",";
      }
      cArray += "\n};\n";
      resolve({name:file.name.split('.')[0]+".c", content:cArray});
    };
    const reader = new FileReader();
    reader.onload = e => img.src = e.target.result;
    reader.readAsDataURL(file);
  });
}

// WAV -> C array
async function wavToC(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const bytes = new Uint8Array(e.target.result);
      let cArray = `const uint8_t ${file.name.split('.')[0]}[] = {\n`;
      for(let b of bytes) cArray += b + ",";
      cArray += "\n};\n";
      resolve({name:file.name.split('.')[0]+".c", content:cArray});
    };
    reader.readAsArrayBuffer(file);
  });
}

// Demo assets if no files uploaded
const demoSpriteC = `const uint8_t player_sprite[] = {
0,0,0,15,15,0,0,0,
0,0,15,15,15,15,0,0,
0,15,15,15,15,15,15,0,
15,15,15,15,15,15,15,15,
15,15,15,15,15,15,15,15,
0,15,15,15,15,15,15,0,
0,0,15,15,15,15,0,0,
0,0,0,15,15,0,0,0
};`;

const demoMapC = `const uint8_t demo_map[] = {
0,0,0,0,0,0,0,0,0,0,
0,1,1,1,1,1,1,1,1,0,
0,1,0,0,0,0,0,0,1,0,
0,1,0,0,0,0,0,0,1,0,
0,1,1,1,1,1,1,1,1,0,
0,0,0,0,0,0,0,0,0,0
};`;

function generateAssetsH(filesC) {
  let includes = filesC.map(f=>`#include "${f}"`).join("\n");
  return `#ifndef ASSETS_H\n#define ASSETS_H\n#include <stdint.h>\n${includes}\n#endif`;
}

function generateMainC(spriteFiles) {
  let spriteInclude = spriteFiles.map(f=>`#include "${f}"`).join("\n");
  return `
#include <tice.h>
#include <graphx.h>
#include <keypadc.h>
#include <stdint.h>
${spriteInclude}

int main(void){
  gfx_Begin();
  gfx_SetDrawBuffer();
  int x=50,y=50;
  while(!os_GetCSC()){
    kb_Scan();
    uint8_t c = kb_Data[6];
    if(c&0x01) x--;
    if(c&0x02) x++;
    if(c&0x04) y--;
    if(c&0x08) y++;
    gfx_FillScreen(0);
    // draw demo sprite
    // actual draw code depends on tile handling
    gfx_SwapDraw();
  }
  gfx_End();
  return 0;
}`;
}

convertBtn.addEventListener("click", async () => {
  const zip = new JSZip();
  let spriteFiles = [], soundFiles = [];

  if(files.length===0){
    // use demo assets
    zip.file("player_sprite.c", demoSpriteC);
    zip.file("demo_map.c", demoMapC);
    spriteFiles.push("player_sprite.c");
    spriteFiles.push("demo_map.c");
  } else {
    for(const f of files){
      if(f.name.endsWith(".png")){
        const c = await pngToTilesC(f);
        zip.file(c.name,c.content);
        spriteFiles.push(c.name);
      } else if(f.name.endsWith(".wav")){
        const c = await wavToC(f);
        zip.file(c.name,c.content);
        soundFiles.push(c.name);
      }
    }
  }

  zip.file("assets.h", generateAssetsH(spriteFiles.concat(soundFiles)));
  zip.file("main.c", generateMainC(spriteFiles));

  const blob = await zip.generateAsync({type:"blob"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ti84_full_game.8pk";
  link.click();
});
