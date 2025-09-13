const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const convertBtn = document.getElementById("convert-btn");
const downloadLink = document.getElementById("download-link");
let files = [];

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", e => {
  dropZone.classList.remove("dragover");
});

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

convertBtn.addEventListener("click", async () => {
  if(files.length===0){ alert("Add files first"); return;}
  const form = new FormData();
  files.forEach(f => form.append("files", f));
  const resp = await fetch("http://localhost:8000/convert", { method:"POST", body: form });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = "ti84_project.zip";
  downloadLink.style.display = "inline";
});
