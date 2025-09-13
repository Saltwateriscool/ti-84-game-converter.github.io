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

// PNG -> C array (8x8 tiles, 16 colors)
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
const demoFiles = [
  {name:"player.c", content:`const uint8_t player_sprite[]={
0,0,0,15,15,0,0,0,
0,0,15,15,15,15,0,0,
0,15,15,15,15,15,15,0,
15,15,15,15,15,15,15,15,
15,15,15,15,15,15,15,15,
0,15,15,15,15,15,15,0,
0,0,15,15,15,15,0,0,
0,0,0,15,15,0,0,0};`},
  {name:"tiles.c", content:`const uint8_t tile_wall[] = {15,15,15,15,15,15,15,15};`},
  {name:"demo_map.c", content:`const uint8_t demo_map[6][10]={
{0,0,0,0,0,0,0,0,0,0},
{0,1,1,1,1,1,1,1,1,0},
{0,1,0,0,0,0,0,0,1,0},
{0,1,0,0,0,0,0,0,1,0},
{0,1,1,1,1,1,1,1,1,0},
{0,0,0,0,0,0,0,0,0,0}};`}
];

// Generate assets.h
function generateAssetsH(filesC) {
  let includes = filesC.map(f=>`#include "${f}"`).join("\n");
  return `#ifndef ASSETS_H\n#define ASSETS_H\n#include <stdint.h>\n${includes}\n#endif`;
}

// Generate main.c with sprites, collectibles, enemies
function generateMainC(spriteFiles){
  let includes = spriteFiles.map(f=>`#include "assets/${f}"`).join("\n");
  return `
#include <tice.h>
#include <graphx.h>
#include <keypadc.h>
#include <stdint.h>
${includes}

int main(void){
  gfx_Begin();
  gfx_SetDrawBuffer();
  int tileSize=16;
  int playerX=16,playerY=16;
  int coinX=64,coinY=32;
  int enemyX=100,enemyY=32;

  while(!os_GetCSC()){
    kb_Scan();
    uint8_t c=kb_Data[6];
    if(c&0x01 && demo_map[playerY/tileSize][(playerX-1)/tileSize]==0) playerX--; // left
    if(c&0x02 && demo_map[playerY/tileSize][(playerX+1)/tileSize]==0) playerX++; // right
    if(c&0x04 && demo_map[(playerY-1)/tileSize][playerX/tileSize]==0) playerY--; // up
    if(c&0x08 && demo_map[(playerY+1)/tileSize][playerX/tileSize]==0) playerY++; // down

    gfx_FillScreen(0);
    // Draw map
    for(int y=0;y<6;y++)
      for(int x=0;x<10;x++)
        if(demo_map[y][x]==1) gfx_FillRectangle(x*tileSize,y*tileSize,tileSize,tileSize);
    // Draw collectibles
    gfx_FillRectangle(coinX,coinY,8,8);
    // Draw enemy
    gfx_FillRectangle(enemyX,enemyY,8,8);
    // Draw player
    gfx_FillRectangle(playerX,playerY,8,8);

    gfx_SwapDraw();
  }
  gfx_End();
  return 0;
}`;
}

// Generate .8pk
convertBtn.addEventListener("click", async () => {
  const zip = new JSZip();
  let spriteFiles = [];

  if(files.length===0){
    demoFiles.forEach(f => {
      zip.file(`assets/${f.name}`, f.content);
      spriteFiles.push(f.name);
    });
  } else {
    for(const f of files){
      if(f.name.endsWith(".png")){
        const c = await pngToTilesC(f);
        zip.file(`assets/${c.name}`, c.content);
        spriteFiles.push(c.name);
      } else if(f.name.endsWith(".wav")){
        const c = await wavToC(f);
        zip.file(`assets/${c.name}`, c.content);
        spriteFiles.push(c.name);
      }
    }
  }

  zip.file("assets/assets.h", generateAssetsH(spriteFiles));
  zip.file("main.c", generateMainC(spriteFiles));

  const blob = await zip.generateAsync({type:"blob"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ti84_upgraded_game.8pk";
  link.click();
});
