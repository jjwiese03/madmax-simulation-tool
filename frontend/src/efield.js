/* This Code is essentially a JS rewriting of PlotEFieldOneDim.jl in Backend
* since it is pretty simple, JS deployment in frontend is reasonable
* I'll explain logic as we go
*/

const c0 = 299792458;

//native JS does not have complex numbers, therefore we create a class with basic
//arithmetics to work with complex numbers
class Complex{
    constructor(re, im) {
        this.re = re;
        this.im = im;
    }

    add(c) {
        return new Complex(this.re + c.re, this.im + c.im);
    }
    sub(c) {
        return new Complex(this.re - c.re, this.im - c.im);
    }
    mul(c) {
        return new Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re);
    }
    div(c) {
        const denom = c.re * c.re + c.im * c.im;
        return new Complex((this.re * c.re + this.im * c.im) / denom, (this.im * c.re - this.re * c.im) / denom);
    }
    scale(s) {
        return new Complex(this.re * s, this.im * s);
    }
}

// Deconstruct exp(-i * pi * x) into real and imaginary parts for cispi implementation of Julia
function cispiComplex(c) {
    const damp = Math.exp(-Math.PI * c.im);
    return new Complex(damp * Math.cos(Math.PI * c.re), damp * Math.sin(Math.PI * c.re));
}

//Complex Square Root
function csqrtComplex(c) {
    const r = Math.sqrt(c.re * c.re + c.im * c.im);
    const theta = Math.atan2(c.im, c.re);
    return new Complex(Math.sqrt(r) * Math.cos(theta / 2), Math.sqrt(r) * Math.sin(theta / 2));
}

//Vector - Matrix multiplication
function multMatVec(M, v) {
    return [
     M[0][0].mul(v[0]).add(M[0][1].mul(v[1])),
     M[1][0].mul(v[0]).add(M[1][1].mul(v[1]))
    ];
}

//Since transfer_matrix returns the squared boost and reflectivity, we have to calculate r and b again
//This is transfer_matrix.jl rewritten essentially
function getRAndB(freq, distances, eps, tand, thicknesses, hasMirror = false) {
    const epsC = new Complex(eps, -tand * eps);
    const nd = csqrtComplex(epsC);
    const nm = hasMirror ? new Complex(1e15, 0) : new Complex(1.0, 0);

    const A = (new Complex(1, 0)).sub((new Complex(1,0).div(epsC)));
    const A0 = (new Complex(1,0)).sub((new Complex(1,0)).div(nm.mul(nm)));
    
    const Gd = [
        [(new Complex(1, 0)).add(nd).scale(0.5), (new Complex(1, 0)).sub(nd).scale(0.5)],
        [(new Complex(1, 0)).sub(nd).scale(0.5), (new Complex(1, 0)).add(nd).scale(0.5)]
    ];
    const twoNd = nd.scale(2);
    const Gv = [
        [nd.add(new Complex(1,0)).div(twoNd), nd.sub(new Complex(1, 0)).div(twoNd)],
        [nd.sub(new Complex(1,0)).div(twoNd), nd.add(new Complex(1, 0)).div(twoNd)]
    ];
    const G0 = [
        [(new Complex(1,0).add(nm)).scale(0.5), (new Complex(1,0)).sub(nm).scale(0.5)],
        [(new Complex(1,0)).sub(nm).scale(0.5), (new Complex(1,0)).add(nm).scale(0.5)]
    ];

    const S = [[A.scale(0.5), new Complex(0,0)], [new Complex(0, 0), A.scale(0.5)]];
    const S0 = [[A0.scale(0.5), new Complex(0,0)], [new Complex(0, 0), A0.scale(0.5)]];

    let T = [[Gd[0][0], Gd[0][1]], [Gd[1][0], Gd[1][1]]];
    let M = [[S[0][0], S[0][1]], [S[1][0], S[1][1]]];

    function matMul(m1, m2) {
        return [
            [m1[0][0].mul(m2[0][0]).add(m1[0][1].mul(m2[1][0])), m1[0][0].mul(m2[0][1]).add(m1[0][1].mul(m2[1][1]))],
            [m1[1][0].mul(m2[0][0]).add(m1[1][1].mul(m2[1][0])), m1[1][0].mul(m2[0][1]).add(m1[1][1].mul(m2[1][1]))]
        ];
    }
    function matAdd(m1, m2) {
        return [[m1[0][0].add(m2[0][0]), m1[0][1].add(m2[0][1])], [m1[1][0].add(m2[1][0]), m1[1][1].add(m2[1][1])]];
    }
    function matSub(m1, m2) {
        return [[m1[0][0].sub(m2[0][0]), m1[0][1].sub(m2[0][1])], [m1[1][0].sub(m2[1][0]), m1[1][1].sub(m2[1][1])]];
    }

    for (let i = distances.length -1; i>= 0; i--) {
        let thick = thicknesses[i];
        let pd1 = cispiComplex(nd.scale(-2 * freq * thick / c0));
        let pd2 = cispiComplex(nd.scale(2 * freq * thick / c0));
        
        T[0][0] = T[0][0].mul(pd1);
        T[0][1] = T[0][1].mul(pd2);
        T[1][0] = T[1][0].mul(pd1);
        T[1][1] = T[1][1].mul(pd2);

        M = matSub(M, matMul(T, S));
        T = matMul(T, Gv);

        let d = distances[i];
        let pp1 = cispiComplex(new Complex(-2 * freq * d /c0, 0));
        let pp2 = cispiComplex(new Complex(2 * freq * d /c0, 0));

        T[0][0] = T[0][0].mul(pp1);
        T[0][1] = T[0][1].mul(pp2);
        T[1][0] = T[1][0].mul(pp1);
        T[1][1] = T[1][1].mul(pp2);

        if (i>0) {
            M = matAdd(M, matMul(T, S));
            T = matMul(T, Gd);
        } else {
            M = matAdd(M, matMul(T, S0));
            T = matMul(T, G0);
        }
    }

    let R = T[0][1].div(T[1][1]);
    let sumM0 = M[0][0].add(M[0][1]);
    let sumM1 = M[1][0].add(M[1][1]);
    let B = sumM0.sub(sumM1.mul(R));

    return {r: R, b: B, Gd: Gd, Gv: Gv};
}

function calculateField(isAxion, freq, distances, eps=24.0, tand=0.0, thicknesses = [], pointsPerCm = 50, hasMirror = false) {
    if (!distances || distances.length === 0) {
        return {z : [], E_re: [], E_im: []};
    }

    // depending on which case we're looking at, we need to configure our starting vector differently
    // e.g. if you might want to do a reflecivity measurement, you will inject a field with amplitude R
    // going inside the MADMAX, and a field leaving the MADMAX
    const rbData = getRAndB(freq, distances, eps, tand, thicknesses, hasMirror);
    const R = rbData.r;
    const B = rbData.b;
    const G_d2v = rbData.Gd;
    const G_v2d = rbData.Gv;

    // see transfer_matrix
    const epsC = new Complex(eps, -tand * eps);
    const nd = csqrtComplex(epsC);
    const twoNd = nd.scale(2.0);

    // V is our propagation Vector, which will hold all the information of the electric field at a given
    // position z
    // we declare those four variables without an assignment, since every variable will change
    // depending on isAxion
    let V;
    let S_axion;
    let E_a;
    let E_a_vac;

    // if we want to look at the case, where the axion is converting into two photons, the starting vector
    // is (E_R, E_L) = (complex boost, 0), where first coordinate corresponds to waves leaving the MADMAX and second going inside
    // This relies on the assumption, that the antenna does not reflect part of the wave back.
    // the boost amplitude B is given by B = E_R / E_mirror, with E_mirror being the electric field reflected with a single mirror setup
    // As a reference emission we choose E_mirror=1, therefore B=E_R
    if (isAxion) {
        V = [B, new Complex(0.0, 0.0)];

        // in this case we also have to remember the axion source term (see transfer_matrix)
        S_axion = new Complex(1.0, 0.0).div(epsC).sub(new Complex(1, 0)).scale(0.5);
        E_a = new Complex(1.0, 0.0).div(epsC);
        E_a_vac = new Complex(1.0, 0.0);
    } 
    //in this case we have to induce the booster externally via a reference field E_L = 1, the booster then reflects a part
    // back into the antenna, which is given by R
    else {
        V = [R, new Complex(1.0, 0.0)];

        // We will not detect an axion this time, therefore all source terms vanish
        S_axion = new Complex(0.0, 0.0);
        E_a = new Complex(0.0, 0.0);
        E_a_vac = new Complex(0.0, 0.0);
    }

    // In this calculation, we're slowly propagatin our starting Vector V from the right (outermost disc) to the left (mirror)
    // we will create two empty arrays, that save positions and Electric field values
    let z_vals = [];
    let E_vals = [];

    // we are adding all disc distances and thicknesses together to land on the rightmost edge, schematic:
    // (mirror) |   | |  |   |(HERE)
    let base_z = distances.reduce((acc, val) => acc + val, 0) + thicknesses.reduce((acc, val) => acc + val, 0);

    let lambda = c0 / freq;
    let extraDpi = Math.max(2, Math.round((lambda * 100.0) * pointsPerCm));

    for (let k = 0; k < extraDpi; k++) {
        let z = (base_z + lambda) - k * (lambda / (extraDpi - 1));
        z_vals.push(z);

        let phase = new Complex((2 * freq * (z - base_z)) / c0, 0);
        let E_prop = V[0].mul(cispiComplex(phase)).add(V[1].mul(cispiComplex(phase.scale(-1))));

        if (isAxion) {
            E_vals.push(E_a_vac.sub(E_prop));
        } else {
            E_vals.push(E_prop);
        }
    }

    let current_z = base_z;


    // we can repeat the propagation for each disc -> vacuum propagation
    // therefore create a for loop over the length of distances array
    for (let i = distances.length - 1; i >= 0; i--) {
        // from the rightmost vaccum we enter the disc. The new amplitude vector is multiplied by G_v2d (G vacuum to disc)
        V = multMatVec(G_v2d, V);

        //check if we need to add the axion source term at the boundary or not
        if (isAxion) {
            V = [V[0].add(S_axion), V[1].add(S_axion)];
        }

        // we get the thickness of our current disc, and then subtract it from our current position
        // therefore we now know the left edge of the disc
        let thick = thicknesses[i];
        let z_next = current_z - thick;
        let localDpi = Math.max(2, Math.round((thick * 100.0) * pointsPerCm * nd.re));

        for (let k = 0; k < localDpi; k++) {
            if (z_vals.length > 0 && k===0) {
                continue;
            }

            let z = current_z - k * ((current_z - z_next) / (localDpi - 1));
            z_vals.push(z);
            let phase = nd.scale((2 * freq * (current_z - z)) / c0);

            let E_prop = V[0].mul(cispiComplex(phase)).add(V[1].mul(cispiComplex(phase.scale(-1))));
            
            if (isAxion) {
                E_vals.push(E_a.sub(E_prop));
            } else {
                E_vals.push(E_prop);
            }
        }

        let phase_disc = nd.scale((2 * freq * thick) / c0);
        V = [V[0].mul(cispiComplex(phase_disc)), V[1].mul(cispiComplex(phase_disc.scale(-1)))];
        current_z = z_next;

        V = multMatVec(G_d2v, V);
        if (isAxion) {
            V = [V[0].sub(S_axion), V[1].sub(S_axion)];
        }

        let d = distances[i];
        z_next = current_z - d;

        localDpi = Math.max(2, Math.round((d * 100.0) * pointsPerCm));

        for (let k = 0; k < localDpi; k++) {
            if (z_vals.length > 0 && k === 0) {
                continue;
            }

            let z = current_z - k * ((current_z - z_next) / (localDpi - 1));
            z_vals.push(z);
            let phase = new Complex((2 * freq * (current_z - z)) / c0, 0);

            let E_prop = V[0].mul(cispiComplex(phase)).add(V[1].mul(cispiComplex(phase.scale(-1))));
            
            if (isAxion) {
                E_vals.push(E_a_vac.sub(E_prop));
            } else {
                E_vals.push(E_prop);
            }
        }

        let phase_vac = new Complex((2 * freq * d) / c0, 0);
        V = [V[0].mul(cispiComplex(phase_vac)), V[1].mul(cispiComplex(phase_vac.scale(-1)))];
        current_z = z_next;
    }

    z_vals.reverse();
    E_vals.reverse();

    if (!isAxion) {
        let lastE = E_vals[E_vals.length - 1];
        let ang = Math.atan2(lastE.im, lastE.re);
        let rot = new Complex(Math.cos(-ang), Math.sin(-ang));

        for (let i = 0; i < E_vals.length; i++) {
            E_vals[i] = E_vals[i].mul(rot);
        }
    } else {
        let ang = (Math.PI / 2) * 0.95;
        let rot = new Complex(Math.cos(-ang), Math.sin(-ang));

        for (let i = 0; i < E_vals.length; i++) {
            E_vals[i] = E_vals[i].mul(rot);
        }
    }

    return { z: z_vals, E_re: E_vals.map(e => e.re), E_im: E_vals.map(e => e.im) };
}

//Next step is to extract data from the discplot to put it into calculateField and create the canvas
function getCurrentSetup() {
    const arrangement = window.discplot;
    if (!arrangement || !arrangement.discConfig) {
        return null;
    }

    const discs = arrangement.discConfig.discs;
    if (!discs || discs.length === 0) {
        return null;
    }

    const sortedDiscs = [...discs].sort((a, b) => a.position - b.position);
    const distances = [];
    const thicknesses = [];

    let currentPosCm = 0.0;
    for (let i = 0; i < sortedDiscs.length; i++) {
        let discPos = parseFloat(sortedDiscs[i].position);
        let widthCm;

        if (sortedDiscs[i].width !== undefined) {
            widthCm = parseFloat(sortedDiscs[i].width);
        } else {
            widthCm = 0.2;
        }

        let dist_m = (discPos - currentPosCm) / 100.0;
        distances.push(Math.max(0, dist_m));
        thicknesses.push(widthCm / 100.0);

        currentPosCm = discPos + widthCm;
    }

    return {distances, thicknesses};
}

window.updateEFieldPlot = function() {
    const eCanvas = document.getElementById('efield-canvas');
    const arrangement = window.discplot;
    const eFieldToggle = document.getElementById("efield-toggle-switch");

    if (!eCanvas || !arrangement) {
        return undefined;
    }

    const ctx = eCanvas.getContext("2d");
    eCanvas.width = arrangement.discCanvas.width;
    eCanvas.height = arrangement.discCanvas.height;
    ctx.clearRect(0, 0, eCanvas.width, eCanvas.height);

    if (eFieldToggle && !eFieldToggle.checked) {
        return undefined;
    }

    const setup = getCurrentSetup();
    if (!setup) {
        return undefined;
    }

    const epsInput = document.getElementById("eps");
    const tandInput = document.getElementById("tand");
    const eps = epsInput ? parseFloat(epsInput.value) : 24.0;
    const tand = tandInput ? parseFloat(tandInput.value) * 1e-6 : 0.0;

    const freqInput = document.getElementById("freq-input");
    const currentFreq = freqInput ? parseFloat(freqInput.value) : 22.0;
    const freqHz = currentFreq * 1e9;

    const selection = document.getElementById("induction-type");
    const currentIsAxionMode = selection ? (selection.value === "WithAxion") : false;

    const mirrorToggle = document.getElementById("mirror_checkbox");
    const hasMirror = mirrorToggle ? mirrorToggle.checked : false;

    const fieldData = calculateField(currentIsAxionMode, freqHz, setup.distances, eps, tand, setup.thicknesses, 50, hasMirror);

    const bodyH = eCanvas.height - arrangement.padd[0] - arrangement.padd[2];
    const centerY = arrangement.padd[0] + (bodyH / 2); // Nulllinie exakt in die vertikale Mitte setzen
    const maxE = Math.max(...fieldData.E_re.map(Math.abs), ...fieldData.E_im.map(Math.abs), 1);
    const scaleY = (bodyH * 0.7) / maxE; // Skalierung auf 45% (insgesamt 90% der Höhe) erhöhen

    function getPixelX(cm) {
        return arrangement.padd[3] + arrangement.cm_to_pixel(cm);
    }

    function drawLine(data, color, isDashed = false) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        if (isDashed) {
            ctx.setLineDash([5,5]);
        }

        for (let i = 0; i< fieldData.z.length; i++) {
            let zCm = fieldData.z[i] * 100.0;
            let pixelX = getPixelX(zCm);
            let pixelY = centerY - (data[i] * scaleY);

            if (i === 0) {
                ctx.moveTo(pixelX, pixelY);
            } else {
                ctx.lineTo(pixelX, pixelY);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawLine(fieldData.E_im, "#2D325966", true);
    drawLine(fieldData.E_re, "#E3A869");

    const maxAmpDisplay = document.getElementById("max-amplitude-display");
    if (maxAmpDisplay) {
        maxAmpDisplay.textContent = `Max Amplitude |E/E0|: ${maxE.toFixed(2)}`;
    }
};

window.generateHeatmap = function() {
const setup = getCurrentSetup();
    if (!setup) return;

    const epsInput = document.getElementById("eps");
    const tandInput = document.getElementById("tand");
    const eps = epsInput ? parseFloat(epsInput.value) : 24.0;
    const tand = tandInput ? parseFloat(tandInput.value) * 1e-6 : 0.0;

    const fminInput = document.getElementById("fmin");
    const fmaxInput = document.getElementById("fmax");
    const fmin = fminInput ? parseFloat(fminInput.value) : 20.0;
    const fmax = fmaxInput ? parseFloat(fmaxInput.value) : 30.0;

    const selection = document.getElementById("induction-type");
    const currentIsAxionMode = selection ? (selection.value === "WithAxion") : false;

    const mirrorToggle = document.getElementById("mirror_checkbox");
    const hasMirror = mirrorToggle ? mirrorToggle.checked : false;

    const loader = document.getElementById("heatmap-loader");
    const plotArea = document.getElementById("heatmap-plot-area");

    if (loader) {
        loader.style.display = "block";
    }

    if (plotArea) {
        plotArea.style.display = "none";
    }

    setTimeout(() => {
        let fSteps = Math.round((fmax - fmin) / 0.01) + 1;

        if (fSteps > 1000) {
            fSteps = 1000;
        }
        if (fSteps < 300) {
            fSteps = 300;
        }

        const frequencies = [];
        const zMatrix = [];

        const pointsPerCm = 50;
        const fieldForZ = calculateField(currentIsAxionMode, fmin * 1e9, setup.distances, eps, tand, setup.thicknesses, pointsPerCm, hasMirror);
        const zAxis = fieldForZ.z.map(v => 100 * v); //convert to cm

        for (let i = 0; i < zAxis.length; i++) {
            zMatrix.push(new Float64Array(fSteps));
        }

        for (let f = 0; f < fSteps; f++) {
            let currentFGHz = fmin + (fmax - fmin) * (f / (fSteps -1));
            frequencies.push(currentFGHz);

            let field = calculateField(currentIsAxionMode, currentFGHz * 1e9, setup.distances, eps, tand, setup.thicknesses, pointsPerCm, hasMirror);

            for (let i = 0; i < field.E_re.length; i ++) {
                let amp = Math.sqrt(Math.pow(field.E_re[i], 2) + Math.pow(field.E_im[i], 2));
                zMatrix[i][f] = amp;
            }
        }
        
        const data = [{
            z: zMatrix,
            x: frequencies,
            y: zAxis,
            type: "heatmap",
            colorscale: "Viridis",
            colorbar: {title: "|E / E0|"}
        }];

        const shapes = [];
        let currentZCm = 0;

        for (let i = 0; i < setup.distances.length; i++) {
            currentZCm += setup.distances[i] * 100;

            let startZ = currentZCm;
            let endZ = currentZCm + (setup.thicknesses[i] * 100);

            shapes.push({
                type: "rect",
                xref: "paper",
                x0: 0,
                x1: 1,
                yref: "y",
                y0: startZ,
                y1: endZ,
                fillcolor: "rgba(255, 255, 255, 0.15)",
                line: {width: 1, color: "rgba(255, 255, 255, 0.15)"},
                layer: "above"
            });

            currentZCm = endZ
        }

        const layout = {
            title: "E-Field Amplitude Distribution",
            xaxis: {title: "Frequency / GHz"},
            yaxis: {title: "Position z / cm"},
            margin: {t: 40, b: 50, l: 60, r: 20},
            shapes: shapes
        };

        if (loader) {
            loader.style.display = "none";
        }

        if (plotArea) {
            plotArea.style.display = "block";
            Plotly.newPlot("heatmap-plot-area", data, layout);
        }
    }, 50);
};
window.getRAndB = getRAndB;