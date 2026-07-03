/**
 * 
 * @file handleClick.js
 * @author Jan Wiesmann
 * @version 0.0.1
 * @created 2026-06-05
 *
 * Click Event Module
 * 
 * This file handles the click Events on the discplot
 * 
 * Usage:
 * A public API is not exposed by this module. 
 */

import { Disc } from "./DiscCollection.js";
import discplot from "./discplot.js"

// Handler als echte Closure mit disc im Scope
let mouseMoveHandler = null;

const handleMouseMove = (discs, offsets) => (event) => {
    for (let i = 0; i < discs.length; i++) {
        discs[i].move(discplot.pixel_to_cm(event.clientX) - offsets[i], false, discplot.axis.xmax, true);
    }
};

discplot.discCanvas.addEventListener("mousedown", (event) => {
    if(event.clientY > discplot.discCanvas.height || event.clientY < 0) return; // ignore clicks outside the canvas
    const X = discplot.pixel_to_cm(event.clientX, false);
    const disc = discplot.discConfig.onDisc(X);

    if (disc != null) {
        if (event.button === 0) {
            disc.selectDisc(!event.ctrlKey);
        }
        else if (event.button === 2 && event.ctrlKey) {
            if (disc.selected) {
                disc.deselectDisc();
                return;
            }
            else {
                disc.selectDisc(false);
            }
        }

        // Alten Listener entfernen, falls noch aktiv
        if (mouseMoveHandler) discplot.discCanvas.removeEventListener("mousemove", mouseMoveHandler);
  

        // Neue Closure mit aktuellem disc erstellen und speichern
        const offsets = discplot.discConfig.selectedDiscs.map(d => discplot.pixel_to_cm(event.clientX) - d.position);
        mouseMoveHandler = handleMouseMove(discplot.discConfig.selectedDiscs, offsets);
        discplot.discCanvas.addEventListener("mousemove", mouseMoveHandler);
    }
    else discplot.discConfig.clearSelection();

    return;
});

discplot.discCanvas.addEventListener("mouseup", () => {
    if (mouseMoveHandler) {
        discplot.discCanvas.removeEventListener("mousemove", mouseMoveHandler);
        mouseMoveHandler = null;
    }
});


// deactivate context menu on right click
discplot.discCanvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

// changing the cursor when holding down the control key
document.addEventListener("keydown", (event) => {
    if (event.key === "Control") {
        discplot.discCanvas.style.cursor = "pointer";
    }
});

document.addEventListener("keyup", (event) => {
    if (event.key === "Control") {
        discplot.discCanvas.style.cursor = "default";
    }
});


const Status = true;
export default Status;