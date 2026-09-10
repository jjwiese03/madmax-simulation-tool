let optWorker;
let isOptimizing = false;
let latestPositions = null;
const startBtn = document.getElementById("opt-start-btn");
const statusDisplay = document.getElementById("opt-status-display");

function initWorker() {
    optWorker = new Worker("src/Optimizer/worker.js");
    
    optWorker.onmessage = (event) => {
        if (event.data.status === "progress") {
            latestPositions = event.data.best_positions;

            const discs = window.discplot.discConfig.discs;
            for (let i = 0; i < discs.length; i++) {
                discs[i].position = event.data.current_positions[i] * 100.0;
            }

            requestAnimationFrame(() => {
                if (window.discplot.adjustAxisOnDemand) window.discplot.adjustAxisOnDemand();
                window.discplot.draw(true, true);
                if (window.updateBoostplot) window.updateBoostplot(window.discplot.discConfig);
                if (window.updateEFieldPlot) window.updateEFieldPlot();
            });
            
            const percent = Math.round((event.data.current / event.data.max) * 100);
            let stuckHtml = "";
            
            if (event.data.stuck_max > 0) {
                const stuckPercent = Math.round((event.data.stuck_current / event.data.stuck_max) * 100);
                stuckHtml = ` | Stuck: <b>${stuckPercent}%</b> (${event.data.stuck_current}/${event.data.stuck_max})`;
            }

            statusDisplay.innerHTML = `
                <span style="color: #333;">Running 三三ᕕ( ᐛ )ᕗ</span><br>
                <span style="font-weight: normal; font-size: 11px;">
                    Progress: <b>${percent}%</b> (${event.data.current}/${event.data.max})${stuckHtml}
                </span>`;
            return;
        }

        if (event.data.status === "success") {
            isOptimizing = false;
            startBtn.textContent = "Run Optimization";
            
            const positions_m = event.data.positions;
            const metrics = event.data.metrics;
            const discs = window.discplot.discConfig.discs;

            for (let i = 0; i < discs.length; i++) {
                discs[i].position = positions_m[i] * 100.0;
            }

            if (window.discplot.adjustAxisOnDemand) window.discplot.adjustAxisOnDemand();
            window.discplot.draw(true, true);
            if (window.updateBoostplot) window.updateBoostplot(window.discplot.discConfig);
            if (window.updateEFieldPlot) window.updateEFieldPlot();

            statusDisplay.innerHTML = `
                <span style="color: green;">Complete ᕙ(  •̀ ᗜ •́  )ᕗ: ${metrics.message}</span><br>
                <span style="font-weight: normal; font-size: 11px;"> 
                    Avg Boost: <b>${metrics.avg_boost.toFixed(2)}</b> |
                    Iterations: <b>${metrics.nit}</b> | 
                    Evaluations: <b>${metrics.nfev}</b>
                </span>
            `;
        } else if (event.data.status === "error") {
            isOptimizing = false;
            startBtn.textContent = "Run Optimization";
            statusDisplay.textContent = "Error: " + event.data.message;
            statusDisplay.style.color = "red";
            console.error(event.data.message);
        }
    };
}

initWorker();

startBtn.addEventListener("click", () => {
    if (isOptimizing) {
        optWorker.terminate();
        isOptimizing = false;
        startBtn.textContent = "Run Optimization";
        statusDisplay.innerHTML = `
           <span style="color: rgba(255, 210, 64, 0.8);">Interrupted ( ꩜ ᯅ ꩜;)⁭</span><br>
           <span style="font-weight: normal; font-size: 11px;">
                Showing best intermediate result.
           </span>
        `;

        if (latestPositions) {
            const discs = window.discplot?.discConfig?.discs;
            if (discs) {
                for (let i = 0; i < discs.length; i++) {
                    discs[i].position = latestPositions[i] * 100.0;
                }
                if (window.discplot.adjustAxisOnDemand) window.discplot.adjustAxisOnDemand();
                window.discplot.draw(true, true);
                if (window.updateBoostplot) window.updateBoostplot(window.discplot.discConfig);
                if (window.updateEFieldPlot) window.updateEFieldPlot();
            }
        }

        initWorker();
        return;
    }


    const discs = window.discplot?.discConfig?.discs;

    if (!discs || discs.length ===0) {
        statusDisplay.textContent = "( ͡• _•) where are the discs?"
        statusDisplay.style.color = "red";
        return;
    }

    isOptimizing = true;
    latestPositions = null;
    startBtn.textContent = "Stop Optimization";

    statusDisplay.innerHTML = `
        <span style="color: #333;">Running 三三ᕕ( ᐛ )ᕗ</span><br>
        <span style="font-weight: normal; font-size: 11px;">Starting up...</span>`;

    const fminInput = parseFloat(document.getElementById('opt-fmin').value);
    const fmaxInput = parseFloat(document.getElementById('opt-fmax').value);
    const freq_min = fminInput * 1e9;
    const freq_max = fmaxInput * 1e9;
    const algorithm = document.getElementById("opt-algorithm").value;

    const eps = parseFloat(document.getElementById("eps").value) || 24.0;
    const tand = (parseFloat(document.getElementById("tand").value) || 0.0) * 1e-6; 

    const distances = [];
    const thicknesses = [];
    let currentPosCm = 0.0;

    for (let i = 0; i < discs.length; i++) {
        let discPos = discs[i].position;
        let widthCm = discs[i].width;

        let dist_m = Math.max(0, (discPos - currentPosCm) / 100.0);
        distances.push(dist_m);
        thicknesses.push(widthCm / 100.0);

        currentPosCm = discPos + widthCm;
    }

    optWorker.postMessage({
        freq_min: freq_min,
        freq_max: freq_max,
        distances: distances,
        thicknesses: thicknesses,
        eps: eps,
        tand: tand,
        algorithm: algorithm
    });
});