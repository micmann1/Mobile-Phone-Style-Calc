
"use strict";

class History {
    #MPSC_HISTORY_ID = 'MPSC_HISTORY0203';
    #MAX_HISTORY = 100;
    constructor() {
        this.tmpHistory = [];
        this.hasLocStorage = false;
        try {
            const stor = window.localStorage.getItem(this.#MPSC_HISTORY_ID);
            window.localStorage.setItem(this.#MPSC_HISTORY_ID, stor);
            this.hasLocStorage = true;
        }
        catch (ex) {
            console.log("local storage not available");
        }
    }
    add2History(v) {
        if (this.hasLocStorage) {
            let tmp = this.getHistory();
            tmp.push(v);
            if (tmp.length > this.#MAX_HISTORY)
                tmp.splice(0, 1);//let's not go over a reasonably small amount of local storage
            localStorage.setItem(this.#MPSC_HISTORY_ID, JSON.stringify(tmp));
        }
        else {
            this.tmpHistory.push(v);
        }
    }
    clear() {
        if (this.hasLocStorage)
            localStorage.removeItem(this.#MPSC_HISTORY_ID);
        else
            this.tmpHistory = [];
    }
    getHistory() {
        let rtn;
        if (this.hasLocStorage) {
            try {
                rtn = JSON.parse(localStorage.getItem(this.#MPSC_HISTORY_ID));
            }
            catch (ex) {
                console.log("no history data");
            }
            return rtn || [];
        }
        else
            return this.tmpHistory;
    }
    setHistory(h) {
        if (this.hasLocStorage) {
            try {
                localStorage.setItem(this.#MPSC_HISTORY_ID, JSON.stringify(h));
            }
            catch (ex) {
                console.log("no localStorage");
            }
        }
        else
            return this.tmpHistory = h.slice(0);
    }
}
