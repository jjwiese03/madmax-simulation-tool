function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}


const download_btn = document.getElementById("download")
const copy_btn = document.getElementById("copy")
const sel_format = document.getElementById("sel_format")


copy_btn.addEventListener("click", async () => {
    const config = window.discplot.discConfig

    const type = "text/plain";

    var clipboardItemData;
    switch (sel_format.value) {
        case "JSON":
            clipboardItemData = {[type]: config.toJSON()};
            break;
        case "CSV":
            clipboardItemData = {[type]: config.toCSV()};
            break;


    }
    const clipboardItem = new ClipboardItem(clipboardItemData);
    await navigator.clipboard.write([clipboardItem]);

})

download_btn.addEventListener("click", () => {
    const config = window.discplot.discConfig
    switch (sel_format.value) {
        case "JSON":
            download("discSettings.txt", config.toJSON())
            break;
        case "CSV":
            download("discSettings.txt", config.toCSV())
            break;

    }
})

