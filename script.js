const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const convertBtn = document.getElementById("convert-btn");
let files = [];

// Drag & drop UI
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

// Convert PNG -> C array (16x16 tiles, simple grayscale)
async function pngToC(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0,0,img.width,img.height).data;
      let cArray = `const uint8_t ${file.name.split('.')[0]}[] = {\n`;
      for(let i=0;i<data.length;i+=4){
        // Simple grayscale conversion
        const gray = Math.round(0.3*data[i]+0.59*data[i+1]+0.11*data[i+2]);
        cArray += gray + ",";
      }
      cArray += `\n};\n`;
      resolve({name:file.name.split('.')[0]+".c", content:cArray});
    };
    const reader = new FileReader();
    reader.onload = e => img.src = e.target.result;
    reader.readAsDataURL(file);
  });
}

// Convert WAV -> C array
async function wavToC(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const arrayBuffer = e.target.result;
      const bytes = new Uint8Array(arrayBuffer);
      let cArray = `const uint8_t ${file.name.split('.')[0]}[] = {\n`;
      for(let i=0;i<bytes.length;i++){ cArray += bytes[i]+","; }
      cArray += `\n};\n`;
      resolve({name:file.name.split('.')[0]+".c", content:cArray});
    };
    reader.readAsArrayBuffer(file);
  });
}

// Generate main.c skeleton for simple moveable sprite game
function generateMainC(spriteFiles) {
  let spriteInclude = spriteFiles.map(f => `#include "${f}"`).join("\n");
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
    uint8_t c = kb_Data[6]; // simplified key read
    if(c&0x01) x--; // left
    if(c&0x02) x++; // right
    if(c&0x04) y--; // up
    if(c&0x08) y++; // down
    gfx_FillScreen(0);
    // draw first sprite at x,y
    // real drawing code depends on your sprite data
    gfx_SwapDraw();
  }
  gfx_End();
  return 0;
}`;
}

convertBtn.addEventListener("click", async () => {
  if(files.length===0) return alert("Add files first");
  const zip = new JSZip();
  let spriteNames = [];

  for(const f of files){
    if(f.name.endsWith(".png")){
      const c = await pngToC(f);
      zip.file(c.name, c.content);
      spriteNames.push(c.name);
    } else if(f.name.endsWith(".wav")){
      const c = await wavToC(f);
      zip.file(c.name, c.content);
    }
  }

  zip.file("main.c", generateMainC(spriteNames));

  const blob = await zip.generateAsync({type:"blob"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ti84_game.8pk";
  link.click();
});
