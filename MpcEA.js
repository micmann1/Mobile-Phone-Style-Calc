'use strict';

class MpcEA/*mobile phone style calc expression analyzer*/ {
    //the following regexp considers '4.' a valid number
    _strNumMatch(str) { return str.match(/^(-?(?:\d+\.\d*|\.\d+|\d+))/) }
    _factfn(n) {
        if (n < 0 || !Number.isInteger(n))
            throw new Error("??Illegal Factorial!");
        let prod = n || 1;
        for (let i = n - 1; i > 1; --i) prod *= i;
        return prod;
    }
    _pctfn(x) {
        if (!isFinite(x))
            throw new Error("??Illegal Percentage");
        return x * 0.01;
    }
    _getParenGroup(str) {
        //Assumes first char is '('
        //Returns entire () expression
        let idx = 0, pcount = 1;
        while (++idx < str.length) {
            const c = str[idx];
            if (c == '(')
                ++pcount;
            else if (c == ')') {
                if (--pcount == 0)
                    return str.substr(0, idx + 1);
            }
        }
        throw new Error("no closing paren found");
    }
    _getNumericLiteral(str) {
        const m = this._strNumMatch(str);
        if (m === null)
            throw new Error("unrecognized number");
        return m[1];
    }
    #CONSTN = ["e", "π"];
    //If the following list changes, please change the display function for looks for
    // things like 'only log function used' or 'only radical used'....
    #FUNCN = ["arccos", "arcsin", "arctan", "cos", "exp", "ln", "log", "sin", "tan", "⎷"];
    #PMATH = {//Pseudo math - mobile calc name to Js Math name/literal...
        "e": "2.718281828459045",
        "π": "3.141592653589793",
        "arccos": "acos",
        "arcsin": "asin",
        "arctan": "atan",
        "cos": "cos",
        "sin": "sin",
        "tan": "tan",
        "exp": "exp",
        "ln": "log",
        "log": "log10"
    };
    resolveExpr(expr, useRadians) {
        if (!expr.length) return "";
        expr = expr.replace(/--/g, '+');
        if(/\.\d+\./.test(expr))
            throw new Error("implied mult. not allowed here");
        return this._resolveExprB(expr, null, useRadians);
    }
    _resolveExprB(expr, outerFunc, useRadians) {
        const isOpStart = (s) => { return /^[-+*/\^]/.test(s) }
        let stack = [];
        let sign = expr[0] === "-" ? -1 : 1;
        let idx = sign == -1 ? 1 : 0;
        while (idx < expr.length) {
            const strsub = expr.substr(idx);

            const fnname = this.#FUNCN.filter((n) => strsub.startsWith(n))[0];
            const coname = this.#CONSTN.filter((n) => strsub.startsWith(n))[0];
            if (typeof (fnname) != "undefined") {
                if (fnname == "⎷"/*radical for square root op -- will clean this up with endgame*/)
                    stack.push("⎷"), idx += 1;//NOT resetting sign right here!!
                else {
                    let grp = this._getParenGroup(strsub.substr(fnname.length));
                    stack.push(sign * this._resolveExprB(grp.slice(1, -1), this.#PMATH[fnname], useRadians));
                    sign = 1;//resetting sign right here is okay!
                    idx += fnname.length + grp.length;
                }
            }
            else if (typeof (coname) != "undefined") {
                let cval = this.#PMATH[coname];
                stack.push(sign * cval);
                sign = 1;
                idx += coname.length;
            }
            else if (strsub[0] == '(') {
                let pgrp = this._getParenGroup(strsub);
                stack.push(sign * this._resolveExprB(pgrp.slice(1, -1), null, useRadians));
                sign = 1;
                idx += pgrp.length;
            }
            else if (strsub[0] == '-' && stack.slice(-1)[0] == '⎷')//complete kludge
            {
                sign = -1;
                idx += 1;
            }
            else if (isOpStart(strsub)) {
                stack.push(strsub[0]);
                sign = strsub[1] == '-' ? -1 : 1;
                idx += strsub[1] == '-' ? 2 : 1;
            }
            else if (strsub[0] == '!' || strsub[0] == '%' || strsub[0] == "²") {
                stack.push(strsub[0]);
                idx += 1;
            }
            else//numeric literal
            {
                const num = this._getNumericLiteral(strsub);
                stack.push(sign * num);
                sign = 1;
                idx += num.length;
            }
        }
        //resolve the highest precedent items that Js does not deal with
        for (let i = 0; i < stack.length - 1;) {
            let [si, sip1] = stack.slice(i, i + 2);
            if (/[!%²]/.test(sip1) && this._strNumMatch('' + si)) {
                stack[i] = sip1 == '!' ? this._factfn(Number(si)) :
                    sip1 == '%' ? this._pctfn(Number(si)) :
                                /*must be ²*/ Math.pow(Number(si), 2);
                stack.splice(i + 1, 1);
            }
            else
                ++i;
        }
        if (stack.slice(-1)[0] == '^') throw new Error("incomplete exponentiation");//kludge--Js eval thinks that ending '^' is ending xor and return NaN????
        for (let i = stack.length - 1; i >= 0; --i) {
            //now resolve radical, exponentiation, negatives and implicit multiplication...backwards!
            if (stack[i] == "⎷") {
                if (i == stack.length - 1 || !this._getNumericLiteral('' + stack[i + 1]))
                    throw new Error('no valid square root arg');
                stack[i] = Math.sqrt(Number(stack[i + 1]));
                if (isNaN(stack[i]))
                    throw new Error('??Negative Square Root');
                stack.splice(i + 1, 1);
                i = Math.min(i + 1, stack.length);
            }
            else if (stack[i] == '^') {
                stack[i - 1] = String(Math.pow(Number(stack[i - 1]), Number(stack[i + 1])));
                stack.splice(i, 2);
            }
            else if (isFinite(parseFloat(stack[i - 1])) && isFinite(parseFloat(stack[i])))
                stack = stack.slice(0, i).concat(['*']).concat(stack.slice(i));
        }
        let estr = stack.reduce((a, x) => a + x, "");
        //Js engine does not like '3--1'???
        let rtnnum = eval(estr.replace(/--/g, '+'));

        if (outerFunc) {
            if (!useRadians && /^(sin|cos|tan)$/.test(outerFunc))
                rtnnum *= Math.PI / 180;
            rtnnum = eval(`Math.${outerFunc}(${rtnnum})`);
            if (!useRadians && /^(asin|acos|atan)$/.test(outerFunc))
                rtnnum *= 180 / Math.PI;
        }

        return rtnnum;
    }
}
