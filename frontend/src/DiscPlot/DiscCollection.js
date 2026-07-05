/**
 * @module DiscCollection
 */

/**
 * Represents a single disc within a {@link DiscCollection}.
 *
 * A disc has a position, a width, a dielectric constant (`epsilon`) and can
 * be selected. Discs are kept in a sorted array inside their parent
 * DiscCollection and know their own index within that array.
 */
export class Disc {
    /**
     * Creates a new Disc instance.
     *
     * @param {DiscCollection} collection - The collection to which the disc belongs.
     * @param {number} position - The x-coordinate of the disc.
     * @param {number} width - The width of the disc.
     * @param {number} epsilon - The dielectrical constant of the disc material.
     * @param {boolean} selected - Whether the disc is selected.
     * @param {number} [index=null] - The index of the disc within its collection.
     */
    constructor(collection, position, width, epsilon, selected, index = null){
        this.id = Math.random().toString(36).substr(2, 9);   // generiert eine zufällige ID für die Scheibe
        this.collection = collection;
        this.position = position;
        this.width = width;
        this.epsilon = epsilon;   // speichert die Dielektrizitätskonstante der Scheibe

        this.selected = selected;   // Property: Determines wether a disc is currently selected via the interface
        // this.immovable = false      // Property: Determines whether this disc can be pushed by other discs

        this.index = index;
    }

    /**
     * The disc directly after this one in the collection (i.e. to the right).
     *
     * Time complexity: O(1).
     *
     * @type {Disc|null}
     * @readonly
     */
    get after(){
        return (this.index + 1 < this.collection.length) ? this.collection.discs[this.index + 1] : null;
    }

    /**
     * The disc directly before this one in the collection (i.e. to the left).
     *
     * Time complexity: O(1).
     *
     * @type {Disc|null}
     * @readonly
     */
    get before(){
        return (this.index - 1 >= 0) ? this.collection.discs[this.index - 1] : null;
    }

    /**
     * The position of the right edge of the disc (`position + width`).
     *
     * @type {number}
     * @readonly
     */
    get rightEdge() {
        return this.position + this.width
    }

    /**
     * Returns the disc that is `n` positions before this one.
     *
     * Time complexity: O(1).
     *
     * @param {number} [n=1] - How many discs to look back.
     * @returns {Disc|null} The disc `n` positions before this one, or `null` if out of range.
     */
    getBefore(n = 1){
        return (this.index - n >= 0) ? this.collection.discs[this.index - n] : null;
    }

    /**
     * Returns the disc that is `n` positions after this one.
     *
     * Time complexity: O(log(i)) (i = number of discs in DiscCollection).
     *
     * @param {number} [n=1] - How many discs to look forward.
     * @returns {Disc|null} The disc `n` positions after this one, or `null` if out of range.
     */
    getAfter(n = 1){
        const newIndex = this.index + n;
        return (this.index + n < this.collection.discs.length) ? this.collection.discs[this.index + n] : null;
    }

    /**
     * Removes this disc from its parent collection.
     *
     * @returns {void}
     */
    delete(){
        this.collection.deleteDisc(this);
    }

    /**
     * Selects this disc within its parent collection.
     *
     * @param {boolean} [deselectOthers=true] - Whether to deselect all other discs first.
     * @returns {void}
     */
    selectDisc(deselectOthers = true){
        this.collection.selectDisc(this, deselectOthers);
    }

    /**
     * Deselects this disc and emits a `disc:selected` event on the parent collection.
     *
     * @returns {void}
     */
    deselectDisc(){
        this.selected = false;
        this.collection.emit("disc:selected", this.collection.selectedDiscs);
    }

    /**
     * Moves the disc to a new position.
     *
     * @param {number} value - The value that defines the new position.
     * @param {boolean} [dx=false] - Whether `value` is a relative offset (`true`) or an absolute position (`false`).
     * @returns {void}
     */
    move(value, dx = false) {
        this.collection.moveDiscs(this, value, dx)
    }

    /**
     * Changes one or more properties of this disc.
     *
     * @param {Object} properties - Key/value pairs of properties to change on the disc.
     * @returns {void}
     */
    changeProperty(properties){
        this.collection.changeDiscProperty(this, properties)
    }
}


/**
 * Represents a collection of discs. Implements useful helper functions to
 * manage multiple discs, keeps them sorted by position, and provides error
 * correction (e.g. resolving overlapping discs).
 */
export class DiscCollection {
    /**
     * Creates a new, empty DiscCollection.
     */
    constructor(){
        this.discs = [];   // speichert die Scheiben als Array von Disc-Objekten
    }

    /**
     * Registered event listeners, keyed by event name.
     *
     * @type {Object.<string, Function[]>}
     * @private
     */
    #listeners = {};

    /**
     * Registers a listener for the given event.
     * The callback will be invoked every time the event is emitted.
     *
     * @param {string|string[]} event - The event name(s) to listen for (e.g. 'disc:position', 'disc:selected', 'disc:added', 'disc:removed').
     * @param {Function} callback - The function to call when the event fires.
     *                              Receives the data passed to emit() as its argument.
     * @returns {void}
     * @example
     * DiscCollection.on('disc:position', (disc) => console.log('position changed:', disc));
     */
    on(event, callback) {
        if (Array.isArray(event)) {
            event.forEach(e => this.on(e, callback));
            return;
        }
        else {
            if (!this.#listeners[event]) this.#listeners[event] = [];
            this.#listeners[event].push(callback.bind(this));
            return;
        }
    }

    /**
     * Removes a previously registered listener for the given event.
     * The callback reference must be identical to the one passed to on().
     *
     * @param {string|string[]} event - The event name(s) to remove the listener from.
     * @param {Function} callback - The exact function reference that was registered.
     * @returns {void}
     * @example
     * const handler = (disc) => console.log(disc);
     * DiscCollection.on('disc:position', handler);
     * DiscCollection.off('disc:position', handler);
     */
    off(event, callback) {
        if (Array.isArray(event)) {
            event.forEach(e => this.off(e, callback));
            return;
        }
        else {
            this.#listeners[event] = this.#listeners[event]?.filter(cb => cb !== callback);
        }
    }

    /**
     * Emits an event, invoking all registered listeners with the provided data.
     * Does nothing if no listeners are registered for the event.
     *
     * @param {string|string[]} event - The event name(s) to emit.
     * @param {*} data - The data to pass to each listener callback.
     * @returns {void}
     * @example
     * this.emit('disc:position', { disc: hitDisc });
     */
    emit(event, data) {
        if (Array.isArray(event)) {
            event.forEach(e => this.emit(e, data));
            return;
        }
        else {
            this.#listeners[event]?.forEach(cb => cb(data));
        }
    }

    /**
     * The number of discs in the collection.
     *
     * @type {number}
     * @readonly
     */
    get length(){
        return this.discs.length;
    }

    /**
     * The last disc in the collection (i.e. the one with the greatest position).
     *
     * Time complexity: O(1).
     *
     * @type {Disc|null}
     * @readonly
     */
    get lastDisc(){
        return this.discs.length > 0 ? this.discs[this.discs.length - 1] : null;
    }

    /**
     * The first disc in the collection (i.e. the one with the smallest position).
     *
     * Time complexity: O(1).
     *
     * @type {Disc|null}
     * @readonly
     */
    get firstDisc(){
        return this.discs.length > 0 ? this.discs[0] : null;
    }

    /**
     * The first currently selected disc in the collection, in index order.
     *
     * @type {Disc|undefined}
     * @readonly
     */
    get firstSelectedDisc(){
        for (let disc of this.discs) {
            if (disc.selected) return disc;
        }
    }

    /**
     * The last currently selected disc in the collection, in index order.
     *
     * @type {Disc}
     * @readonly
     */
    get lastSelectedDisc(){
        let canidate = this.discs.firstDisc
        for (let disc of this.discs) {
            if (disc.selected) canidate = disc;
        }
        return disc;
    }

    /**
     * All discs that are currently selected.
     *
     * @type {Disc[]}
     * @readonly
     */
    get selectedDiscs(){
        return this.discs.filter(disc => disc.selected);
    }

    /**
     * The indices of all currently selected discs.
     *
     * @type {number[]}
     * @readonly
     */
    get selectedDiscIndices(){
        return this.discs.map(disc => disc.selected ? this.indexOf(disc) : null).filter(index => index !== null);
    }

    /**
     * The positions of all discs in the collection, in index order.
     *
     * @type {number[]}
     * @readonly
     */
    get positions(){
        return this.discs.map(d => d.position);
    }

    /**
     * The widths of all discs in the collection, in index order.
     *
     * @type {number[]}
     * @readonly
     */
    get widths(){
        return this.discs.map(d => d.width)
    }

    /**
     * Implements binary search to find the index of the disc that is on the
     * right side of the given position. If position is greater than the
     * position of the last disc, it returns the last disc's index. Used in
     * {@link DiscCollection#indexOf} and {@link DiscCollection#positionNeighbour}.
     *
     * Time complexity: O(log(n)) (n = number of discs in DiscCollection).
     *
     * IMPORTANT: `binSearch(x)` for any `x` greater than `lastDisc.position`
     * returns `lastDisc.index`.
     *
     * @param {number} position - The position to search for.
     * @returns {number} The index of the disc to the right of `position`.
     * @example
     * // DiscCollection consists of Discs with positions: 2, 3, 4, 5, 6
     * binSearch(4.5); // => 3
     * binSearch(4);   // => 2
     * binSearch(2.5); // => 1
     * binSearch(100); // => 4
     */
    binSearch(position){

        var start = 0;
        var end = Math.max(0, this.discs.length - 1);
        var mid;

        var security = 0;
        while (end - start >= 1) {
            security++;
            if(security > 100) {throw new Error("possible infinity loop detected")}
            mid = start + Math.floor((end - start) / 2);

            if (this.discs[mid].position == position) {
                return mid;
            }
            else if (this.discs[mid].position > position) {
                end = mid;
            } 
            else {
                start = mid + 1;
            }

        }
        return start;
    }

    /**
     * Returns the index of a given disc.
     *
     * Time complexity: O(log(n)) (n = number of discs in DiscCollection).
     *
     * @param {Disc} disc - The disc to look up.
     * @returns {number|null} The index of the disc, or `null` if it is not part of the collection.
     */
    indexOf(disc){
        const binSearchResult = this.binSearch(disc.position);
        return (this.discs[binSearchResult] === disc) ? binSearchResult : null;
    }

    /**
     * Returns the neighbouring disc for a given position. If a disc is at
     * exactly that position, it is returned when `neighbour = "left"`,
     * otherwise its right neighbour is returned. If there is no disc on the
     * requested side, `null` is returned.
     *
     * Time complexity: O(log(n)) (n = number of discs in DiscCollection).
     *
     * @param {number} position - The position to search around.
     * @param {("left"|"right")} [neighbour="right"] - Which side to look at.
     * @returns {Disc|null} The neighbouring disc, or `null` if none exists.
     */
    positionNeighbour(position, neighbour="right"){

        if (!["right", "left"].includes(neighbour)) throw new Error("Invalid argument for neighbour: " + neighbour)

        if (this.length == 0 || (position > this.lastDisc.position && neighbour=="right")) return null;

        const binSearch = this.discs[this.binSearch(position)]

        if (binSearch == this.lastDisc && position > binSearch.position) {
            return (neighbour == "right") ? null : binSearch;
        }
        return (neighbour == "right") ? binSearch : binSearch.before;
    }

    /**
     * Returns the disc located at the given position, if any.
     *
     * @param {number} position - The position to check.
     * @returns {Disc|null} The disc covering `position`, or `null` if none does.
     */
    onDisc(position) {
        const canidate = this.positionNeighbour(position, "left");

        return (canidate.position <= position && canidate.rightEdge >= position) ? canidate : null;
    }

    /**
     * Deletes a single disc or multiple discs from the collection.
     *
     * Time complexities (n = number of discs in DiscCollection):
     * - `disc` is `Disc[]` -> O(n*m) (m = length of `disc`)
     * - `disc` is `Disc` -> O(n)
     * - `disc` is `number[]` -> O(m)
     * - `disc` is `number` -> O(1)
     *
     * @param {number|Disc|number[]|Disc[]} disc - Specifies which disc(s) should be deleted.
     * @param {boolean} [triggerEvent=true] - Whether to emit a `disc:removed` event.
     * @returns {void}
     */
    deleteDisc(disc, triggerEvent = true){

        if (disc instanceof Array){
            disc.forEach(d => this.deleteDisc(d));
        }
        else {
            const index = disc instanceof Disc ? this.indexOf(disc) : disc; // erlaubt die Übergabe eines Index statt eines Disc-Objekts

            if (index >= 0 && index < this.discs.length) {
                this.discs.splice(index, 1);
                this.updateIndicies(index - 1, index);
                if (triggerEvent) this.emit("disc:removed");
            }
            else {            throw new Error("Disc not found in configuration: " + disc);        }
        }
    }

    /**
     * Deletes the last `n` discs from the collection.
     *
     * @param {number} [n=1] - The number of discs to delete from the end of the collection.
     * @returns {void}
     */
    deleteDiscs(n=1){
        for (let i = 0; i<n; i++) {
            this.deleteDisc(this.discs.length - 1)
        }
        this.emit("disc:removed", {});
    }

    /**
     * Deletes all currently selected discs from the collection.
     *
     * @returns {void}
     */
    deleteSelectedDiscs(){
        this.discs = this.discs.filter(disc => !disc.selected);
        this.emit("disc:removed", {});
    }

    /**
     * Loops through the selected discs and calls the callback function for each one.
     *
     * @param {function(Disc, number, Object): void} callback - The function to call for each selected disc.
     * @param {Object} [kwargs={}] - Additional arguments passed through to the callback.
     * @returns {void}
     */
    loopSelection(callback, kwargs = {}) {
        this.discs.forEach((disc, i) => {if(disc.selected){callback(disc, i, kwargs)}})
    }

    /**
     * Adds a new disc to the collection, either from a plain object of
     * properties or from an existing {@link Disc} instance. The disc is
     * inserted at the index matching its position, and default values are
     * applied for any missing property.
     *
     * @param {Disc|Object|null} [disc=null] - The disc to add, or a plain object with `position`, `width`, `epsilon` and `selected` properties.
     * @param {boolean} [deselectOthers=true] - Whether to deselect all other discs first.
     * @returns {Disc} The disc that was added.
     */
    addDisc(disc = null, deselectOthers = true) {
        // turn the input into a Disc class

        if (deselectOthers) this.clearSelection(false);
        if (disc == null) disc = {};

        if (typeof disc === 'object' && !(disc instanceof Disc)) {
            const defaultDisc = { position: null, width: 0.2, epsilon: 24, selected: false };
            Object.entries(defaultDisc).forEach(([key, value]) => {
                if (disc[key] == null) disc[key] = value;
            });

            if (disc.position == null) {
                disc.position = (this.lastDisc == null) ? 0 : this.lastDisc.position + this.lastDisc.width;
            }

            disc = new Disc(this, disc.position, disc.width, disc.epsilon, disc.selected);
        }

        // determine its index
        const index = this.positionNeighbour(disc.position, "right");
        disc.index = (index == null) ? this.length : index;

        if (disc instanceof Disc) {
            if (this.discs.includes(disc)) {
                throw new Error("Disc is already in the collection: " + disc);
            }
            this.discs.splice(disc.index, 0, disc);
            this.updateIndicies(disc.index);
            this.emit("disc:added", disc);
            if(disc.selected == true || deselectOthers == true) this.emit("disc:selected", this.selectedDiscs);
        } else {
            throw new Error("Only Disc or a plain object are valid inputs. Got: " + String(disc));
        }
        return disc;

    }

    /**
     * Adds `n` new discs to the collection with default properties.
     *
     * @param {number} [n=1] - The number of discs to add.
     * @returns {void}
     */
    addDiscs(n=1){
        for (let i = 1; i < n; i++){
            this.addDisc(null, false);
        }
        this.addDisc(null, true);
    }

    /**
     * Selects one or more discs.
     *
     * The `disc` parameter may be:
     * - a {@link Disc} instance,
     * - the index of a disc,
     * - or an array containing Disc instances and/or indices.
     *
     * By default, all currently selected discs are deselected before
     * the new selection is applied.
     *
     * @param {Disc|number|Array<Disc|number>} disc
     *        The disc(s) to select, specified either as Disc objects
     *        or indices.
     * @param {boolean} [deselectOthers=true]
     *        If `true`, all other discs are deselected before selecting
     *        the specified disc(s).
     * @param {boolean} [triggerEvent=true]
     *        Whether to emit a `disc:selected` event.
     * @returns {void}
     */
    selectDisc(disc, deselectOthers = true, triggerEvent = true){

        if (deselectOthers){
            this.discs.forEach(d => d.selected = false);
        }

        if (disc instanceof Array){
            disc.forEach(d => this.selectDisc(d, false, false));
            this.emit("disc:selected", this.selectedDiscs)
            return;
        }
        else {
            disc = disc instanceof Disc ? disc : this.discs[disc]; 
            disc.selected = true;
        }

        if(triggerEvent) {this.emit("disc:selected", this.selectedDiscs)}
        return;
    }

    /**
     * Deselects all discs in the collection.
     *
     * @param {boolean} [dispatchEvent=true] - Whether to emit a `disc:selected` event.
     * @returns {void}
     */
    clearSelection(dispatchEvent = true){
        this.discs.forEach(d => d.selected = false);
        if(dispatchEvent) this.emit("disc:selected", []);
        return;
    }

    /**
     * Removes all discs from the collection.
     *
     * @returns {void}
     */
    clear(){
        this.discs = [];
        this.emit("disc:removed", {})
    }

    /**
     * Changes the position of a single disc or multiple discs.
     *
     * @param {Disc[]|Disc|function(Disc): boolean} discs - Array of discs, a single Disc instance, or a filter function selecting which discs to move.
     * @param {number[]|number} value - Array of new positions, or a single new position (applied to every disc).
     * @param {boolean} [dx=false] - Whether `value` is a relative offset (`true`) or an absolute position (`false`).
     * @param {number} [maxPosition=null] - Maximum position the discs are not allowed to exceed (border). If `null`, all positions are allowed. IMPORTANT: this argument is only observed if `errorCorrection` is enabled.
     * @param {boolean} [errorCorrection=true] - Whether overlap between discs and exceeding `maxPosition` should be corrected.
     * @returns {void}
     */
    moveDiscs(discs, value, dx = false, maxPosition = null, errorCorrection = true){
        if (discs instanceof Disc) {discs = [discs]}
        else if (typeof discs === "function") {
            discs = this.discs.filter(discs);
        }

        discs.forEach((disc, index) => {
            // change position
            if (dx) {
                disc.position += value;
            }
            else {
                disc.position = value;
            }
            
            if(errorCorrection){
                // disc cascade to the left
                while(disc.after != null && disc.rightEdge > disc.after.position) {
                    disc.after.position = disc.rightEdge;
                    disc = disc.after;
                }

                // disc cascade to the right
                while(disc.before != null && disc.before.rightEdge > disc.position) {
                    disc.before.position = disc.position - disc.before.width;
                    disc = disc.before;
                }
            }
            
        })

        // correct the borders
        if (errorCorrection){
            // correct maxPosition
            if (maxPosition != null && this.lastDisc.rightEdge >= this.maxPosition ){
                this.moveDiscs(this.lastDisc, this.maxPosition - this.lastDisc.width)
            }

            // correct negative positions
            if (this.firstDisc.position < 0) {
                this.moveDiscs(this.firstDisc, 0)
            }
        }
        
        this.emit("disc:position")
    }

    /**
     * Changes one or more properties on the given disc(s). Existing values
     * are not overwritten: a property is only set if it is currently falsy.
     *
     * @param {Disc|Disc[]} discs - The disc(s) whose properties should be changed.
     * @param {Object} properties - Key/value pairs of properties to set.
     * @param {boolean} [triggerEvent=true] - Whether to emit a `disc:property` event.
     * @returns {void}
     */
    changeDiscProperty(discs, properties, triggerEvent = true){
        if(Array.isArray(discs)) {discs.forEach((disc) => this.changeDiscs(disc, properties))}
        else{
            for (const [key, value] of Object.entries(properties)) {
                if(discs[key]) continue;
                
                discs[key] = value;
                if(triggerEvent) this.emit("disc:property");
            }
        }
        return;
    }

    /**
     * Sets the `index` property for Disc elements in the collection within the given range.
     *
     * @param {number} [start=0] - Index from where the change of the indices starts. If it is smaller than zero, the iteration starts from 0.
     * @param {number} [stop=null] - Index where the iteration stops (inclusive). If `null`, the iteration stops at the end.
     * @returns {void}
     */
    updateIndicies(start = 0, stop = null){

        stop = (stop == null) ? this.discs.length - 1 : Math.min(stop, this.discs.length - 1);
        start = Math.max(0, start);

        for (let i = start; i <= stop; i++) {
            this.discs[i].index = i;
        }
    }
}