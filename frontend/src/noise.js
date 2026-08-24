import {transfer_matrix } from "./transfer_matrix.js";
import discplot from "./DiscPlot/discplot.js";

const kB = 1.380649e-23; // Boltzmann constant
const P0 = 2.2e-27; // Reference power from MADMAX Paper
const gRef = 1e-15; // Reference coupling from MADMAX Paper

/**
 * First part is dedicated to get time t until axion noise is detected for specific
 * parameters, and calculate minimal axion photon coupling constant for conversion to happen
 **/
function getNoiseArrays(fMin, fMax, setup, eps, tand, BE, A, TSys, tIntSec, gTarget) {
    let gVals = [];
    let timeVals = [];

    const BRel = BE / 10.0;
    const ARel = A / 1.0;

    const nSteps = 500;
    const freqsGHz = [];
    const freqsHz = [];

    for (let i = 0; i <=nSteps; i++) {
        let fGHz = fMin + (fMax - fMin) * (i / nSteps);
        freqsGHz.push(fGHz);
        freqsHz.push(fGHz * 1e9);
    }

    const kwargs = {};
    if (!isNaN(eps)) {
        kwargs["eps"] = eps;
    }

    if (!isNaN(tand)) {
        kwargs["tand"] = tand;
    }
    
    const positions = setup.discs.map(d => d.position / 100.0);
    const widths = setup.discs.map(d => d.width / 100.0);

    const {boostfactor} = transfer_matrix(freqsHz, positions, widths, kwargs);

    for (let i = 0; i <= nSteps; i++) {
        let fGHz = freqsGHz[i];
        let fHz = freqsHz[i];
        let deltaNuA = fHz * 1e-6; // Derivation also in MADMAX Paper

        let betaSquare = boostfactor[i];
        if (betaSquare < 1e-10) {
            betaSquare = 1e-10; //fallback to not divide by zero
        }

        let numerator = (5.0 * kB * TSys) / (betaSquare * P0 * ARel * Math.pow(BRel, 2));
        let denominator = deltaNuA / tIntSec;
        let gSens = gRef * Math.sqrt(numerator) * Math.pow(denominator, 0.25);

        let powerRatio = (5.0 * kB * TSys) / (betaSquare * P0 * ARel * Math.pow(BRel, 2) * Math.pow(gTarget / gRef, 2));
        let tReqSec = deltaNuA * Math.pow(powerRatio, 2);
        let tReqDays = tReqSec / (24 * 3600);

        gVals.push({x: fGHz, y: gSens});
        timeVals.push({x: fGHz, y: tReqDays});
    }

    return {gVals, timeVals};
}

// Next we need to render the charts using Charts.js logic
window.couplingPlot = null;
window.timePlot = null;

function getNoiseColors() {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    return {
        lineCoupling: dark ? '#90A4AE' : '#607D8B',
        lineTime: dark ? '#90A4AE' : '#607D8B',
        gridColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
        tickColor: dark ? '#888780' : '#5F5E5A',
        tooltipBg: dark ? '#2C2C2A' : '#ffffff',
        tooltipText: dark ? '#F1EFE8' : '#2C2C2A',    
    };
}


function makeNoiseChartConfig(data, yLabel, lineColor, c, reverseY = false) {
    const xS = data.length > 0 ? Math.min(...data.map(d => d.x)) : parseFloat(document.getElementById("fmin")?.value || 20);
    const xE = data.length > 0 ? Math.max(...data.map(d => d.x)) : parseFloat(document.getElementById("fmax")?.value || 30);

    return {
        type: "line",
        defaults: {font: {family: "sans-serif"}},
        data: {
            datasets: [{
                data: data,
                parsing: {xAxisKey: "x", yAxisKey: "y"},
                borderColor: lineColor,
                backgroundColor: lineColor + "22",
                borderWidth: data.length > 300 ? 1 : 1.5,
                pointRadius: data.length > 200 ? 0 : data.length > 80 ? 1 : 3,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.35,
            }]
        },
        options: {
            locale: "en-US",
            responsive: true,
            maintainAspectRatio: false,
            animation: {duration: 180},
            plugins: {
                tooltip: {
                    backgroundColor: c.tooltipBg,
                    titleColor: c.tooltipText,
                    bodyColor: c.tooltipText,
                    borderColor: c.gridColor,
                    borderWidth: 1,
                    callbacks: {
                        title: items => "Freq: " + items[0].parsed.x.toFixed(3) + " GHz",
                        label: item => yLabel + ": " + item.parsed.y.toExponential(1)
                    }
                },
                legend: {display: false}
            },
            scales: {
                x: {
                    type: "linear",
                    min: xS,
                    max: xE,
                    ticks: {color: c.tickColor, font: {size: 11}, maxTicksLimit: 10},
                    grid: {color: c.gridColor},
                    title: {
                        display: true,
                        text: "Frequency [GHz]",
                        font: {size: 12, style: "italic"}
                    }
                },
                y: {
                    type: "logarithmic",
                    reverse: reverseY,
                    ticks: {
                        color: c.tickColor,
                        font: {size: 11},
                        callback: function(value) {
                            return value.toExponential(2);
                        }
                    },
                    grid: {color: c.gridColor},
                    title: {
                        display: true,
                        text: yLabel,
                        font: {size: 12, style: "italic"}
                    }
                }
            }
        }
    };
}

window.initNoisePlots = function() {
    const c = getNoiseColors();
    
    if (window.couplingPlot) {
        window.couplingPlot.destroy();
    }
    if (window.timePlot) {
        window.timePlot.destroy();
    }

    const ctxG = document.getElementById("couplingplot");
    const ctxT = document.getElementById("snrplot");

    if (ctxG) {
        window.couplingPlot = new Chart(ctxG.getContext("2d"), makeNoiseChartConfig([], "g_aγγ / GeV⁻¹", c.lineCoupling, c, true));
    }
    if (ctxT) {
        window.timePlot = new Chart(ctxT.getContext("2d"), makeNoiseChartConfig([], "Integration Time / d", c.lineTime, c, false));
    }
}

// Controls and plotting
window.updateNoisePlots = function() {
    const discCollection = window.discplot ? window.discplot.discConfig : null;
    if (!discCollection || discCollection.discs.length === 0) {
        return;
    }

    const fmin = document.getElementById("fmin") ? parseFloat(document.getElementById("fmin").value) : 20.0;
    const fmax = document.getElementById("fmax") ? parseFloat(document.getElementById("fmax").value) : 30.0;
    const eps = document.getElementById("eps") ? parseFloat(document.getElementById("eps").value) : 24.0;
    const tand = document.getElementById("tand") ? parseFloat(document.getElementById("tand").value) * 1e-6 : 0.0;

    const B_e = document.getElementById("noise-bfield") ? parseFloat(document.getElementById("noise-bfield").value) : 10.0;
    const A = document.getElementById("noise-area") ? parseFloat(document.getElementById("noise-area").value) : 1.0;
    const T_sys = document.getElementById("noise-tsys") ? parseFloat(document.getElementById("noise-tsys").value) : 4.0;
    const t_int_days = document.getElementById("noise-time") ? parseFloat(document.getElementById("noise-time").value) : 7.0;
    const gtarget_input = document.getElementById("noise-gtarget") ? parseFloat(document.getElementById("noise-gtarget").value) : 1.0;

    const t_int_sec = t_int_days * 24 * 3600;
    const g_target = gtarget_input * 1e-14;

    const {gVals: dataCoupling, timeVals: dataTime} = getNoiseArrays(fmin, fmax, discCollection, eps, tand, B_e, A, T_sys, t_int_sec, g_target);

    // coupling Plot updates
    if (window.couplingPlot) {
        window.couplingPlot.data.datasets[0].data = dataCoupling;

        const n = dataCoupling.length;
        window.couplingPlot.data.datasets[0].pointRadius = n > 200 ? 0 : n > 80 ? 1 : 3;
        window.couplingPlot.data.datasets[0].borderWidth = n > 300 ? 1 : 1.5;

        window.couplingPlot.options.scales.x.min = fmin;
        window.couplingPlot.options.scales.x.max = fmax;
        window.couplingPlot.update();
    } else {
        initNoisePlots();
    }

    // do the same for time
    if (window.timePlot) {
        window.timePlot.data.datasets[0].data = dataTime;

        const n = dataTime.length;
        window.timePlot.data.datasets[0].pointRadius = n > 200 ? 0 : n > 80 ? 1 : 3;
        window.timePlot.data.datasets[0].borderWidth = n > 300 ? 1 : 1.5;

        window.timePlot.options.scales.y.title.text = `Int. Time [d] for g=${g_target.toExponential(2)}`;
        window.timePlot.options.scales.x.min = fmin;
        window.timePlot.options.scales.x.max = fmax;
        window.timePlot.update();
    } else {
        initNoisePlots();
    }
};