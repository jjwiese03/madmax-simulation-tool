importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js");

let pyodideReadyPromise = (async () => {
    self.pyodide = await loadPyodide();
    await self.pyodide.loadPackage(["numpy", "scipy"]);

    const response = await fetch("./transfer_matrix.py");
    const pythonCode = await response.text();
    await self.pyodide.runPythonAsync(pythonCode);
})();

self.onmessage = async (event) => {
    const { freq_min, freq_max, distances, thicknesses, eps, tand, algorithm } = event.data;

    try {
        await pyodideReadyPromise;
        
        const run_optimization = self.pyodide.globals.get("run_optimize");
        const pyResult = run_optimization(freq_min, freq_max, distances, thicknesses, eps, tand, algorithm);

        const result = pyResult.toJs({dict_converter: Object.fromEntries });
        pyResult.destroy();

        const optimized_distances = result.distances;

        let current_pos = 0.0;
        const optimized_positions = new Float64Array(optimized_distances.length);

        for (let i = 0; i < optimized_distances.length; i++) {
            current_pos += optimized_distances[i];
            optimized_positions[i] = current_pos;
            current_pos += thicknesses[i];
        }

        self.postMessage({
            status: "success",
            positions: optimized_positions,
            metrics: {
                nit: result.nit,
                nfev: result.nfev,
                message: result.message
            }
        });

    } catch (error) {
        self.postMessage({
            status: "error",
            message: error.message
        });
    }
};