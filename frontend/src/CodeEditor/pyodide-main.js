/**
 * needs to be loaded as module because it contains async functions
 */

const pyodide = await loadPyodide();

// OPTIONAL: load Packages
// await pyodide.loadPackage(["numpy"]);

document.getElementById("run").addEventListener("click", async (event) => {
    
    if(window.editor == null) return;

    await pyodide.runPythonAsync(window.editor.getValue());
})
