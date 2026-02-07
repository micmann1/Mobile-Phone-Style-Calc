
"use strict";

class CalcDisplay {
    //Right-aligned text that keeps the cursor at the
    // right edge when inputting text, but the user may
    // use the pointer or arrow/home/end keys to navigate
    // around and view or edit any of the text.
    //Font size starts at largest size and when the
    // current text won't fit the width of the display,
    // the font decreases in size, as needed to try to fit
    // all chars into the display, until the smallest
    // specified font size is used. If even MORE text is
    // then added, the leading characters will begin to
    // move out of view past the left edge.
    constructor(el) {
        this.atomicRx = null;
        this.bgcolor = el.style.backgroundColor || 'white';
        this.cbfunc = ()=>{;};
        this.color = "black";
        this.ctx = el.getContext("2d");
        this.cursorOn = false;
        this.el = el;
        this.fontDefault = 44;
        this.fontSizeMax = 44;
        this.fontSizeMin = 44;
        this.fontSizeNow = 44;
        this.fontAttrib = '';
        this.fontUnits = '';
        this.fontName = '';
        this.grouping = true;//user can adjust to false
        this.groupchar = this.groupChar();
        this.keyStack = {"ArrowRight":0, "ArrowLeft":0, "Backspace":0, "Escape":0,
            "Delete":0, "Home":0, "End":0};
        this.metrics = el.getBoundingClientRect();
        this.ptrInfo = {"down":false/*other attrs may be added in future*/};
        this.selectcolor = "rgba(0,40,255,0.15)";
        this.selection = [0, 0];
        this.showCursor = false;
        this.text = '';
        //Temp is simply this.text that is copied to this.temp
        // by calling the function setTemp(). It will be copied
        // BACK to this.text and displayed if the "Backspace" key is
        // the very NEXT edit that is made(with no selection range).
        this.temp = '';
        this.timerCursor = null;
        this.translateX = 0;

        this.H = (this.el.height || this.metrics.height);//px
        this.W = (this.el.width || this.metrics.width);//px
        this.MAXCHARS = 120;//modify as needed

        this.el.addEventListener("pointerdown", (evt) => { this.interactEvent(evt) });
        this.el.addEventListener("pointermove", (evt) => { this.interactEvent(evt) });
        this.el.addEventListener("pointerup", (evt) => { this.interactEvent(evt) });
        this.el.addEventListener("pointerout", (evt) => { this.interactEvent(evt) });

        this._cursorBlink();
    }
    addText(txt, docallback = true) {
        const minsel = Math.min(...this.selection);
        const maxsel = Math.max(...this.selection);

        if (this.text.length - (maxsel - minsel) + txt.length > this.MAXCHARS)
            throw new Error("text string over maximum size");

        const remains    = this.text.length - maxsel;

        this.text = this.text.slice(0, minsel) + txt + this.text.slice(maxsel);
        if(this.grouping) this.text = this._grouped(this.text);

        this.selection = [this.text.length-remains, this.text.length-remains];

        this._updateDisplay();

        if(docallback)
            this.temp = '', this.cbfunc([null, this.degrouped()]);
    }
    backspace() {
        if (this._isEmptyRange()) {
            if(this.temp.length){
                this.text = this.temp;
                return this.moveEnd(false);
            }
            const atom = this._atomicArea(this._sc(this.selection[1]-1));
            const lowc = atom===null?this._sc(this.selection[1]-1):atom[0];
            this.text = this.text.slice(0, lowc) + this.text.slice(this.selection[1]);
            this.selection = [lowc, lowc];
        }
        else
            this._removeSelection();
        if(this.grouping) this.text = this._grouped();
        this._updateDisplay();this._cursorBlink();
    }
    clear(docallback = true) {
        this.text = '';
        this.selection = [0, 0];
        this.translateX = 0;
        this._updateDisplay();
        if(docallback)
            this.cbfunc([null, this.degrouped()]);
    }
    degrouped(txt){
        return (txt || this.text).replaceAll(this.groupchar, '');
    }
    doDelete() {
        if (this._isEmptyRange()){
            const atom = this._atomicArea(this._sc(this.selection[1]+1));
            const highc = atom===null?this._sc(this.selection[1]+1):atom[1];
            this.text = this.text.slice(0, this.selection[1])  + this.text.slice(highc);
        }
        else
            this._removeSelection();
        if(this.grouping) this.text = this._grouped();
        this._updateDisplay();this._cursorBlink();
    }
    escape() {
        this.selection = [this.selection[1], this.selection[1]];
        this._updateDisplay();this._cursorBlink();
    }
    getSelectedText() {
        return this.text.slice(this.selection[0], this.selection[1]);
    }
    getSelection() {
        return this.selection.slice(0);
    }
    getText(){
        return this.text;
    }
    groupChar(){
        const c = (1000).toLocaleString().slice(-4,-3);
        return c=='1'?'':c;
    }
    interactEvent(evt) {
        if (evt.type.startsWith("pointer")) {
            this.pointerAction(evt);
            evt.preventDefault();
            return false;
        }
        //keydown must be sent by the user from outer context
        // for processing digits and decimal separators, and the
        // Enter key, since canvas has no ability to hold focus
        // for general keyboard events.

        const [key, typ, isShift] = [evt.key, evt.type, evt.shiftKey];
        if (typ == "keyup") {
            return this.keyStack[key] = 0;
        }
        if (key == "Backspace"){
            if(this._millis() - this.keyStack[key] > 50){
                this.backspace();
                this.keyStack[key] = this._millis();
            }
            this.temp = '';
        }
        else if (key == "Delete"){
            if(this._millis() - this.keyStack[key] > 50){
                this.doDelete();
                this.keyStack[key] = this._millis();
            }
            this.temp = '';
        }
        else if (key.startsWith("Arrow")){
            if(this._millis() - this.keyStack[key] > 33){
                this.moveCursor1(key == "ArrowLeft" ? -1 : 1, isShift);
                this.keyStack[key] = this._millis();
            }
        }
        else if (key == "Escape")
            this.escape();
        else if (key == "Home")
            this.moveHome(isShift);
        else if (key == "End")
            this.moveEnd(isShift);
        this.cbfunc([evt, this.degrouped()]);
        evt.preventDefault();
        return false;
    }
    moveCursor1(dir/*1 or -1*/, isShift) {
        const _as = this._atomSkip.bind(this);
        //TODO
        if(!this._isEmptyRange() && !isShift)
            this.selection = [this.selection[1], this.selection[1]];
        else if(isShift)
            this.selection = [this.selection[0], _as(this._sc(this.selection[1] + dir), dir)];
        else
            this.selection = [_as(this._sc(this.selection[1] + dir), dir),
                                _as(this._sc(this.selection[1] + dir), dir)];

        this._updateDisplay();this._cursorBlink();
    }
    moveEnd(isShift) {
        this.selection = [isShift?this.selection[0]:this.text.length, this.text.length];
        this._updateDisplay();this._cursorBlink();
    }
    moveHome(isShift) {
        this.selection = [isShift?this.selection[0]:0, 0];
        this._updateDisplay();this._cursorBlink();
    }
    pointerAction(evt){
        const _as = this._atomSkip.bind(this);
        if (evt.type == "pointerdown") {
            this.ptrInfo["down"] = true;
            this.ptrInfo["startX"] = evt.offsetX;
            this.ptrInfo["time"] = this._millis();
            const pointerCursor = this._calcCursorFromOffsetX(evt.offsetX);
            if(evt.shiftKey)
                this.selection[1] = _as(pointerCursor,
                    this.selection[0]<this.selection[1]?1:-1);
            else
                this.selection = [_as(pointerCursor,0), _as(pointerCursor,0)];
            this._updateDisplay();this._cursorBlink();
        }
        else if (evt.type == "pointerup" || evt.type == "pointerout") {
            this.ptrInfo["down"] = false;
            this._updateDisplay();
        }
        else if (this.ptrInfo["down"] && evt.type == "pointermove"){
                this.translateX += evt.movementX;
                this.cbfunc([evt, this.degrouped()]);
                this._updateDisplay();this._cursorBlink();
        }
    }
    repaint(){this._updateDisplay();this._cursorBlink()}
    setAtomics(atom){
        //*atom* is an array(or array-like obj), that contains strings that are
        // to be considered 'one atomic/discrete unit' in terms of selection/deletion.
        const repfunc = (t)=>{return String.fromCodePoint(92)/*Backslash*/ + t};
        let cpAtom = atom.slice(0);
        cpAtom.sort((a,b)=>{return b.length-a.length});
        cpAtom = cpAtom.map((t)=>{return t.replace(/[(|){}\[\]\*\+\?\^\$]/g, repfunc)});
        const atomicText = '(' + cpAtom.join('|') + '|.)';
        this.atomicRx = new RegExp(atomicText);
    }
    setCallback(cbfunc){this.cbfunc = cbfunc}
    setColor(color, bgcolor, selectcolor){
        this.color = color;
        this.bgcolor = bgcolor;
        this.selectcolor = selectcolor;
        this.ctx.fillStyle = this.color;
        this.repaint();
    }
    setCursor(seton){this.showCursor = seton; this.repaint()}
    setFontProperties(fontobj) {
        //fontobj has properties: attrib, sizeMin, sizeMax, units, name
        //fontobj.sizeMax is intended to be the starting/default size.
        if (!isFinite(fontobj.sizeMin) || !isFinite(fontobj.sizeMax)) throw new Error("invalid font size size");
        if (!fontobj.units.length) throw new Error('missing font units');
        if (!fontobj.name.length) throw new Error('missing font name');
        this.fontAttrib = fontobj.attrib;
        this.fontSizeMax = fontobj.sizeMax;
        this.fontSizeNow = fontobj.sizeMax;
        this.fontSizeMin = fontobj.sizeMin;
        this.fontUnits = fontobj.units;
        this.fontName = fontobj.name;
        this.fontDefault = `${fontobj.attrib} ${fontobj.numberMax}${fontobj.units} ${fontobj.name}`.trim();
        this.ctx.font = this.fontDefault;
        this.ctx.textAlign = "right";
        this.ctx.textBaseline = "alphabetic";
    }
    setTemp(txt){this.temp = this.text; this.text = txt; this.cbfunc(["setTemp", this.degrouped()])}
    setText(txt, docallback = true){
        this.clear(docallback), this.addText(txt, docallback);
    }

    _atomicArea(cursor){
        //If *cursor* is inside a atomic area, returns the
        // begin and end cursor locations for that area, else null.
        if(this.atomicRx===null) return null;
        for(let i=0; i<Math.min(cursor, this.text.length);){
            const txt = this.text.slice(i);
            const fnd =txt.match(this.atomicRx);
            if(fnd[1].length>1 && i<cursor && cursor<i+fnd[1].length)
                return [i, i+fnd[1].length];
            i += fnd[1].length;
        }
        return null;
    }
    _atomSkip(cursor, dir = 0/*or -1 or 1*/){
        const atom = this._atomicArea(cursor);
        if(atom===null) return cursor;
        if(dir==0){
            return Math.abs(cursor-atom[0])<Math.abs(cursor-atom[1])?
                atom[0]:atom[1];
        }
        return dir==-1?atom[0]:atom[1];
    }
    _calcCursorFromOffsetX(offsetX) {
        let _tw = this._textWidth.bind(this);
        const trueLeft = (this.W - offsetX) + this.translateX;
        let [lowc, highc, midc, w] = [0, this.text.length, 0];
        while(lowc <= highc) {
            midc = lowc + Math.trunc((highc - lowc) / 2);
            w    = _tw(this.text.substr(midc));
            if(Math.abs(w - trueLeft) < 1)
                return midc;
            else if(w > trueLeft)
                lowc = midc + 1;
            else
                highc = midc - 1;
        }
        return  Math.abs(trueLeft-_tw(this.text.substr(lowc ))) <
                Math.abs(trueLeft-_tw(this.text.substr(highc))) ? lowc : highc;
    }
    _calcOffsetXFromSelect(select1) {
        return this.W - this._textWidth(this.text.substr(select1));
    }
    _cursorBlink(arg) {
        ////when called by another class member, cursor will
        //// IMMEDIATELY begin it's blink cycle as VISIBLE(ON).
        clearTimeout(this.timerCursor);
        const hasarg = typeof (arg) != "undefined";
        this.cursorOn = (hasarg ? !this.cursorOn : true);
        if(!this.cursorOn)
            this._updateDisplay();
        else if(this.showCursor){
            let x = this._calcOffsetXFromSelect(this.selection[1]);
            if ((this.W - x) <= 1) x = this.W - 2;/*for ease of viewing*/
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.H - this.fontSizeNow);
            this.ctx.lineTo(x, this.H);
            this.ctx.lineWidth = '2';
            this.ctx.strokeStyle = this.ctx.fillStyle;
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.restore();
        }
        if(this.showCursor)
            this.timerCursor = setTimeout(() => { this._cursorBlink(1) }, 530);
    }
    _drawRangeBackground() {
        this.ctx.save();
        if (this.selection[0] == this.selection[1]) return;
        this.ctx.fillStyle = this.selectcolor;
        const x0 = this._calcOffsetXFromSelect(this.selection[0]);
        const x1 = this._calcOffsetXFromSelect(this.selection[1]);
        this.ctx.fillRect(Math.min(x0,x1), 0, Math.abs(x1 - x0), this.H);
        this.ctx.restore();
    }
    _fsw(){return this.fontSizeNow/4};//small window based on current font size
    _grouped(){
        let rtn = '';
        let str = this.degrouped();
        for (const m of String(str).matchAll(/(\.\d+|\.|[^\d\.]+|\d+)/g)) {
            if (!/^\d/.test(m[1]))
                rtn += m[1];
            else
                rtn += '' + Number(m[1]).toLocaleString();
        }
        return rtn;
    }
    _isEmptyRange() {
        return (this.selection[0] == this.selection[1]);
    }
    _millis(){return new Date().getTime()}
    _modFontSz(sz) {
        return `${this.fontAttrib} ${sz}${this.fontUnits} ${this.fontName}`.trim();
    }
    _removeSelection() {
        this.text = this.text.substr(0, Math.min(...this.selection)) + this.text.substr(Math.max(...this.selection));
        if (this.selection[1] < this.selection[0])
            this.selection[0] = this.selection[1];
        else
            this.selection[1] = this.selection[0];
    }
    _sc(val){//selection clamp
        return val<0 ? 0 : val>this.text.length ? this.text.length : val;
    }
    _setTransform() {
        if(this._textWidth(this.text) > this.W){
            const ox = this._calcOffsetXFromSelect(this.selection[1]) + this.translateX;
            if (ox > this.W - this._fsw())
                this.translateX -= ox - (this.W - this._fsw());
            else if (ox < this._fsw() + 2)
                this.translateX += (this._fsw() + 2) - ox;
            this.translateX = Math.max(0, this.translateX);//nothing less than zero!
            this.ctx.setTransform(1, 0, 0, 1, this.translateX, 0);
        }
        else{
            this.translateX = 0;
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }
    _textWidth(txt, fnt = null) {
        this.ctx.save();
        this.ctx.font = fnt===null ? this._modFontSz(this.fontSizeNow) : fnt;
        const wid = this.ctx.measureText(txt).width;
        this.ctx.restore();
        return wid;
    }
    _updateDisplay() {
        this.ctx.clearRect(-1 * this.MAXCHARS * this.fontSizeMax, 0,
            2 * this.MAXCHARS * this.fontSizeMax, this.H
        );
        this._setTransform();
        this._drawRangeBackground();
        const USEWID = this.W - this._fsw();
        const wid = this._textWidth(this.text, this._modFontSz(this.fontSizeMax));
        let sz;
        if (wid >= USEWID)
            sz = Math.max(this.fontSizeMin, this.fontSizeMax * USEWID / wid);
        else if (wid < USEWID)
            sz = Math.min(this.fontSizeMax, this.fontSizeMax * USEWID / wid);
        this.ctx.font = this._modFontSz(sz);
        this.fontSizeNow = sz;
        this.ctx.fillText(this.text, this.W, this.H - this.fontSizeNow/4/*descenders room*/);
    }
}
