/**
 * @file discplotActions.js
 * @author Jan Wiesmann
 * @version 0.0.1
 * @created 2026-06-05
 *
 * Discplot Actions Module
 *
 * This file implements actions triggered by changes in the discplot (f.e. update input fields etc.).
 *
 *
 * Usage:
 * No public API is exposed by this module. It is used internally by the Discplot component to manage user interactions and update the plot accordingly.
 */

import discplot from "./discplot.js";
import updateBoostplot from "../boostplot.js";
import { transfer_matrix } from "../transfer_matrix.js";

let eFieldTimeout = null;
function throttledUpdateEField() {
    if (window.updateEFieldPlot) {
        eFieldTimeout = setTimeout(() => {
            window.updateEFieldPlot();
        }, 50);
    }
}

// Section Material:
const mirror_checkbox = document.getElementById("mirror_checkbox");
const epsilon_input = document.getElementById("eps");
const tan_delta_input = document.getElementById("tand");


// Section Positioning:
const discNumberString = document.getElementById("discNumberString");
const counter_field = document.getElementById("disc-number-input");
const position_input = document.getElementById("position-input");
const rel_poisition_input = document.getElementById("rel-position-input");
const width_input = document.getElementById("width-input");

discplot.discConfig.on("disc:position", function ()  {
    const selection = this.selectedDiscs
    position_input.value = (selection.length > 0) ? selection[0].position : "-";
    rel_poisition_input.value = (selection.length > 0 && selection[0].before != null) ? selection[0].position - selection[0].before.rightEdge : "-";
    
    updateBoostplot(this);
    if (typeof window.updateNoisePlots === "function") {
        window.updateNoisePlots();
    }
    discplot.draw();

    throttledUpdateEField();
})


discplot.discConfig.on("disc:selected", function (selection) {
    if (selection.length > 0) {
        position_input.value = selection[0].position;
        rel_poisition_input.value = (selection[0].before != null) ? selection[0].position - selection[0].before.rightEdge : selection[0].position;
        width_input.value = selection[0].width

        discNumberString.innerHTML = (selection.length == 1) ? "selected disc: " + String(selection[0].index + 1) : "selected disc " + String(selection[0].index + 1) + " - " + String(selection[selection.length-1].index + 1)
    }
    else {
        position_input.value = "-";
        rel_poisition_input.value = "-";
        width_input.value = "-";
        discNumberString.innerHTML = "no disc selected"
    }

    discplot.draw();
})

discplot.discConfig.on(["disc:removed", "disc:added"], function () {
    counter_field.value = String(this.discs.length);

    updateBoostplot(this);
    discplot.draw();
    if (typeof window.updateNoisePlots === "function") {
        window.updateNoisePlots();
    }

    throttledUpdateEField();
})

discplot.discConfig.on("disc:property", function () {
    window.discplot.draw();

    if (typeof window.updateBoostplot === "function") {
        updateBoostplot(this);
    }
    if (typeof window.updateEFieldPlot === "function") {
        throttledUpdateEField();
    }
    if (typeof window.updateNoisePlots === "function") {
        window.updateNoisePlots();
    }
})

window.discplot.discConfig.addDiscs(4)


let compilationStatus = true;


document.addEventListener("DOMContentLoaded", () => {

    const slider = document.getElementById("freq-slider");
    const input = document.getElementById("freq-input");
    const selection = document.getElementById("induction-type");
    const fminGlobal = document.getElementById("fmin");
    const fmaxGlobal = document.getElementById("fmax");
    const eFieldToggle = document.getElementById("efield-toggle-switch");

    if (selection) {
        selection.addEventListener("change", () => {
            if (typeof window.updateEFieldPlot === "function") window.updateEFieldPlot();
        });
    }

    if (slider && input) {
        slider.addEventListener("input", (e) => {
            input.value = e.target.value;
            if (typeof window.updateEFieldPlot === "function") window.updateEFieldPlot();
        });

        input.addEventListener("change", (e) => {
            slider.value = e.target.value;
            if (typeof window.updateEFieldPlot === "function") window.updateEFieldPlot();
        });
    }

    if (fminGlobal && slider) fminGlobal.addEventListener("change", (e) => slider.min = parseFloat(e.target.value));
    if (fmaxGlobal && slider) fmaxGlobal.addEventListener("change", (e) => slider.max = parseFloat(e.target.value));

    if (eFieldToggle) {
        eFieldToggle.addEventListener("change", () => {
            if (typeof window.updateEFieldPlot === "function") window.updateEFieldPlot();
        });
    }

    const visTabLink = document.querySelector('a[href="#tab-Visualisation"]');
    if (visTabLink) {
        visTabLink.addEventListener("click", () => {
            setTimeout(() => {
                if (typeof window.updateEFieldPlot === "function") window.updateEFieldPlot();
            }, 10);
        });
    }

    setTimeout(() => {
        if (typeof window.updateEFieldPlot === "function") window.updateEFieldPlot();
    }, 100);

    if (typeof window.initNoisePlots === "function") {
        window.initNoisePlots();
    }

    const noiseInputs = ["noise-bfield", "noise-area", "noise-tsys", "noise-time", "noise-gtarget", "fmin", "fmax"];
    noiseInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener("change", () => {
                if (typeof window.updateNoisePlots === "function") window.updateNoisePlots(); 
            });
        }
    });

    const plotToggle = document.getElementById("plot-toggle-switch");
    if (plotToggle) {
        plotToggle.addEventListener("change", (e) => {
            const isNoiseMode = e.target.checked;
            const plotsContainer = document.querySelector('.plots');
            
            if (plotsContainer) plotsContainer.classList.toggle('noise-mode', isNoiseMode);

            const wrapBoost = document.getElementById("wrapper-boost");
            const wrapRefl = document.getElementById("wrapper-reflectivity");
            const wrapSNR = document.getElementById("wrapper-snr");
            const wrapCoupling = document.getElementById("wrapper-coupling");

            if (wrapBoost) wrapBoost.style.display = isNoiseMode ? "none" : "block";
            if (wrapRefl) wrapRefl.style.display = isNoiseMode ? "none" : "block";
            if (wrapSNR) wrapSNR.style.display = isNoiseMode ? "block" : "none";
            if (wrapCoupling) wrapCoupling.style.display = isNoiseMode ? "block" : "none";

            if (isNoiseMode && typeof window.updateNoisePlots === "function") {
                window.updateNoisePlots();
            } 
        });
    }

    const noiseTabLink = document.querySelector('a[href="#tab-Noise"]');
    if (noiseTabLink) {
        noiseTabLink.addEventListener("click", () => {
            setTimeout(() => {
                if (typeof window.updateNoisePlots === "function") window.updateNoisePlots();
            }, 10);
        });
    }
});

//heatmap controls
const openHeatmapBtn = document.getElementById("open-heatmap-btn");
const closeHeatmapBtn = document.getElementById("close-heatmap-btn");
const heatmapModal = document.getElementById("heatmap-modal");

if (openHeatmapBtn && heatmapModal) {
    openHeatmapBtn.addEventListener("click", () => {
        heatmapModal.style.display = "flex";

        if (typeof window.generateHeatmap === "function") {
            window.generateHeatmap();
        }
    });
}

if (closeHeatmapBtn) {
    closeHeatmapBtn.addEventListener("click", () => {
        heatmapModal.style.display = "none";
    });
}

window.addEventListener("click", (e) => {
    if (e.target === heatmapModal) {
        heatmapModal.style.display = "none";
    }
});

export default compilationStatus;