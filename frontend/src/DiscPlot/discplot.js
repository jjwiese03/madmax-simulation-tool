/**
 * 
 * @file discplot.js
 * @author Jan Wiesmann
 * @version 0.0.1
 * @created 2026-06-05
 *
 * Discplot Module
 * 
 * This file implements the discplot, which is used to visualize and manage the configuration of the discs. It also implements the interaction with the discplot (f.e. click on a disc, drag and drop etc.).
 * 
 * Usage:
 * A public API is exposed by this module. It is used internally by the Discplot component to manage user interactions and update the plot accordingly.
 * @module discplot
 * 
 * @ignore
 */


import { colors } from "../utils.js";
import { Disc, DiscCollection } from "./DiscCollection.js";
import { Axis } from "./Axis.js";
import MarqueeSelection from "./MarqueeSelection.js";


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

/**
 * Sets the canvas size of the discplot (both the disc canvas and the axis
 * canvas) to the size of its wrapper div. Should be called once on load and
 * again whenever the window is resized.
 *
 * @ignore
 * 
 * @returns {null} Always returns `null`.
 */
function setCanvasSize() {
    const discCanvas = document.getElementById("discs");
    const Parent = discCanvas.parentElement

    discCanvas.width = Parent.clientWidth; // passt die Canvas-Breite an die tatsächliche Größe im Layout an
    discCanvas.height = Parent.clientHeight; // passt die Canvas-Größe an die tatsächliche Größe im Layout an

    const axisCanvas = document.getElementById("axis");
    axisCanvas.width = Parent.clientWidth; // passt die Canvas-Breite an die tatsächliche Größe im Layout an
    axisCanvas.height = Parent.clientHeight; // passt die Canvas-Größe an die tatsächliche Größe im Layout an

    return null;    //returns nothing
}
setCanvasSize();


/**
 * Renders and manages the disc plot: draws the axis, the discs, the marquee
 * selection rectangle and the mirror indicator onto two stacked `<canvas>`
 * elements, and converts between pixel and cm coordinates.
 */
class Plot{
    /**
     * Creates a new Plot bound to the given canvas elements.
     *
     * @param {HTMLCanvasElement} discCanvas - The canvas the discs are drawn onto.
     * @param {HTMLCanvasElement} axisCanvas - The canvas the axis is drawn onto.
     */
    constructor(discCanvas, axisCanvas){
        this.discCanvas = discCanvas;
        this.axisCanvas = axisCanvas;
        this.discContext = discCanvas.getContext("2d");
        this.axisContext = axisCanvas.getContext("2d");

        this.discConfig = new DiscCollection();

        this.axis = new Axis();

        this.marqueeSelection = new MarqueeSelection();   // speichert die Koordinaten des Marquee Selection Rechtecks (multiselect)
        
        this.init();
    }

    /**
     * Initializes the plot: computes the canvas padding, waits for the
     * fonts to be ready, sets the canvas font and performs the initial
     * draw (including the axis).
     *
     * @returns {Promise<void>} Resolves once the initial draw has been performed.
     */
    async init(){
        this.padd = [discCanvas.height * 0.3, innerHeight * 0.05, discCanvas.height * 0.3, innerHeight * 0.05]

        await document.fonts.ready;
        this.discContext.font = "15px sans-serif";
        this.axisContext.font = "15px sans-serif";

        this.draw(true);
    }

    /**
     * Draws the plot onto the canvases.
     *
     * When `axis` is `true`, the axis line, ticks, tick labels and axis
     * label are (re-)drawn onto the axis canvas.
     *
     * When `discs` is `true`, all discs, the gap arrows and labels between
     * them, the marquee selection rectangle (if active) and the mirror
     * indicator (if enabled) are (re-)drawn onto the disc canvas.
     *
     * @param {boolean} [axis=false] - Whether to (re-)draw the axis.
     * @param {boolean} [discs=true] - Whether to (re-)draw the discs.
     * @returns {void}
     */
    draw(axis = false, discs = true) {

        if (axis) {
            // ── Achse ────────────────────────────────────────────────────────────────
            this.axisContext.clearRect(0, 0, this.axisCanvas.width, this.axisCanvas.height);

            this.axisContext.beginPath();
            this.axisContext.strokeStyle = colors.color_dark_gray;
            this.axisContext.fillStyle   = colors.color_dark_gray;
            this.axisContext.lineWidth   = 0.5;

            this.axisContext.moveTo(this.padd[3], this.axisCanvas.height - this.padd[2]);
            this.axisContext.lineTo(this.axisCanvas.width - this.padd[1], this.axisCanvas.height - this.padd[2]);

            this.axis.ticks.forEach(tick => {
                const x = this.padd[3] + this.cm_to_pixel(tick);
                const y = this.axisCanvas.height - this.padd[2];
                this.axisContext.moveTo(x, y);
                this.axisContext.lineTo(x, y + 8);
            });
            this.axisContext.stroke(); // einmal für Achslinie + alle Ticks

            // Tick-Labels
            this.axisContext.fillStyle = colors.color_dark_gray;
            this.axisContext.textAlign = "center";
            this.axis.ticks.forEach(tick => {
                const x = this.padd[3] + this.cm_to_pixel(tick);
                this.axisContext.fillText(tick, x, this.axisCanvas.height - this.padd[2] + 25);
            });

            // Achsbeschriftung
            this.axisContext.fillText(
                "Position [" + this.axis.unit + "]",
                this.padd[3] + (this.axisCanvas.width - this.padd[1] - this.padd[3]) / 2,
                this.axisCanvas.height - this.padd[2] + this.axisContext.measureText("Position").emHeightAscent * 4.5
            );

            this.axisContext.stroke();
            this.axisContext.fill();
        }

        if (discs) {
            // ── Scheiben ─────────────────────────────────────────────────────────────
            this.discContext.clearRect(0, 0, this.discCanvas.width, this.discCanvas.height);

            var prev_disc  = {};
            var arrow_y    = this.discCanvas.height / 2;

            this.discConfig.discs.forEach((disc, index) => {
                const x = this.padd[3] + this.cm_to_pixel(disc.position);
                const bodyH = this.discCanvas.height - this.padd[0] - this.padd[2];

                // Scheibenkörper
                this.discContext.beginPath();
                this.discContext.strokeStyle = colors.line_color_1
                this.discContext.rect(x, this.padd[0], this.cm_to_pixel(disc.width), bodyH);
                this.discContext.fillStyle = disc.selected ? "rgba(133, 144, 170, 0.54)" : "rgba(133, 144, 170, 0.19)";
                this.discContext.fill();
                this.discContext.stroke();

                // Scheiben-Header (dunkles Rechteck oben)
                this.discContext.beginPath();
                this.discContext.rect(x, this.padd[0] - 15, this.cm_to_pixel(disc.width), 15);
                this.discContext.fillStyle = "rgb(52, 71, 122)";
                this.discContext.fill();
                this.discContext.stroke();

                // Abstandspfeil zur vorherigen Scheibe
                if (index > 0) {
                    const gap = parseFloat(-(prev_disc.position + prev_disc.width - disc.position).toFixed(3));
                    if (gap !== 0) {
                        const arrow_start = this.cm_to_pixel(prev_disc.position + prev_disc.width) + this.padd[3];
                        const arrow_end   = this.cm_to_pixel(disc.position) + this.padd[3];
                        const label       = String(gap) + this.axis.unit;

                        this.discContext.beginPath();
                        this.discContext.strokeStyle = colors.color_dark_gray;
                        this.discContext.lineWidth   = 0.5;
                        // Pfeilspitze links
                        this.discContext.moveTo(arrow_start + 5, arrow_y + 5);
                        this.discContext.lineTo(arrow_start,     arrow_y);
                        this.discContext.lineTo(arrow_start + 5, arrow_y - 5);
                        // Linie
                        this.discContext.moveTo(arrow_start, arrow_y);
                        this.discContext.lineTo(arrow_end,   arrow_y);
                        // Pfeilspitze rechts
                        this.discContext.moveTo(arrow_end - 5, arrow_y + 5);
                        this.discContext.lineTo(arrow_end,     arrow_y);
                        this.discContext.lineTo(arrow_end - 5, arrow_y - 5);
                        this.discContext.stroke();

                        // Abstandszahl
                        this.discContext.fillStyle = colors.color_dark_gray;
                        const labelWidth = this.discContext.measureText(label).width;
                        if (arrow_end - arrow_start < labelWidth) {
                            this.discContext.save();
                            this.discContext.translate(arrow_start + (arrow_end - arrow_start) / 2, arrow_y - 10);
                            this.discContext.rotate(-Math.PI / 2);
                            this.discContext.textBaseline = "middle";
                            this.discContext.textAlign    = "left";
                            this.discContext.fillText(label, 0, 0);
                            this.discContext.restore();
                        } else {
                            this.discContext.textAlign    = "center";
                            this.discContext.textBaseline = "alphabetic";
                            this.discContext.fillText(label, arrow_start + (arrow_end - arrow_start) / 2, arrow_y - 10);
                        }
                    }
                }

                // Positionsbeschriftung
                const posLabel = String(parseFloat(disc.position.toFixed(3))) + this.axis.unit;
                this.discContext.save();
                this.discContext.translate(
                    this.cm_to_pixel(disc.position + disc.width / 2) + this.padd[3],
                    this.padd[0] - 25
                );
                this.discContext.rotate(-Math.PI / 2);
                this.discContext.textBaseline = "middle";
                this.discContext.textAlign    = "left"; 
                this.discContext.fillStyle    = colors.color_dark_gray;
                this.discContext.fillText(posLabel, 0, 0);
                this.discContext.restore();

                prev_disc = disc;
            });

            // ── Marquee-Selektion ─────────────────────────────────────────────────────
            if (this.marqueeSelection.active) {
                this.discContext.beginPath();
                this.discContext.rect(
                    this.marqueeSelection.start[0] + this.padd[3],
                    this.discCanvas.height - this.marqueeSelection.start[1] - this.padd[2],
                    this.marqueeSelection.end[0]   - this.marqueeSelection.start[0],
                    this.marqueeSelection.start[1] - this.marqueeSelection.end[1]
                );
                this.discContext.strokeStyle = "rgba(39, 51, 161, 0.35)";
                this.discContext.lineWidth   = 0.5;
                this.discContext.fillStyle   = "rgba(145, 163, 209, 0.27)";
                this.discContext.fill();
                this.discContext.stroke();
            }

            // ── Spiegel ───────────────────────────────────────────────────────────────
            if (mirror_checkbox.checked) {
                this.discContext.beginPath();
                this.discContext.fillStyle = colors.madmax_yellow_light;
                this.discContext.fillRect(
                    this.padd[3], this.discCanvas.height - this.padd[2],
                    -10, -(this.discCanvas.height - this.padd[0] - this.padd[2])
                );
            }
        }
        
    }

    /**
     * Updates the axis scale (maximum value and/or unit), recomputes the
     * tick marks accordingly and redraws the plot.
     *
     * @param {number} [xmax=10] - The new maximum value of the axis. Pass `null` to leave the current maximum unchanged.
     * @param {string} [unit="cm"] - The new unit label for the axis. Pass `null` to leave the current unit unchanged.
     * @returns {void}
     */
    updateScale(xmax=10, unit="cm"){
        if (xmax != null) {this.axis.setXmax(xmax)};
        if (unit != null) {this.axis.setUnit(unit)};
        this.axis.updateTicks();

        this.draw();
    }

    /**
     * Converts a pixel coordinate on the axis canvas to a position in the
     * plot's real-world unit (e.g. cm), based on the current axis scale.
     *
     * @param {number} x_pixel - The pixel coordinate to convert.
     * @param {boolean} [includesPadding=true] - Whether `x_pixel` already includes the left padding offset. If `false`, the left padding is subtracted before conversion.
     * @returns {number} The corresponding position in the plot's real-world unit.
     */
    pixel_to_cm(x_pixel, includesPadding = true) {
        const position = x_pixel - (includesPadding ? 0 : this.padd[3])
        return (position / (this.axisCanvas.width - this.padd[1] - this.padd[3] - 20)) * this.axis.xmax;
    }

    /**
     * Converts a position in the plot's real-world unit (e.g. cm) to a
     * pixel offset on the axis canvas, based on the current axis scale.
     *
     * @param {number} x - The position (in the plot's real-world unit) to convert.
     * @returns {number} The corresponding pixel offset, truncated to an integer.
     */
    cm_to_pixel(x){
        return Math.trunc(x*(this.axisCanvas.width-this.padd[1]-this.padd[3]-20)/this.axis.xmax)
    }
}


const discCanvas = document.getElementById("discs");
const axisCanvas = document.getElementById("axis");
window.discplot = new Plot(discCanvas, axisCanvas); 

export default window.discplot;

window.addEventListener('resize', () => {setCanvasSize(); discplot.init();});