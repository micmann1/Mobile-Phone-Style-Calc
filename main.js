    'use strict';

    var g_CD = new CalcDisplay(iddsply);
    var g_DecSep = '.';
    var g_Expr = '';
    var g_History = new History();
    var g_EA = new MpcEA();
    var g_Memory = null;
    var g_Rslt = '';

    function addParen(e) {
        const parenCt = getParenCount();
        const whichP = /[)\d\.,eπ%!²]$/.test(visualExpr().substr(0, g_CD.getSelection()[1])) && parenCt ? ')' : '(';
        if (parenCt == 0 && whichP == ')') return;
        doKeyPress(whichP);
    }
    function bkspc/*surrogate*/(evt) {
        var evt = new KeyboardEvent('keydown', { key: "Backspace" });
        g_CD.interactEvent(evt);
    }
    function buttonManager() {
        btn_invequal.disabled = !isNumericResult();
        idmc.style.cursor = g_Memory === null ? "default" : "pointer";
        idmr.style.cursor = g_Memory === null ? "default" : "pointer";
        idms.style.cursor = !isNumericResult() ? "default" : "pointer";
        idmplus.style.cursor = !isNumericResult() ? "default" : "pointer";
        idmminus.style.cursor = !isNumericResult() ? "default" : "pointer";
        btn_hist.style.visibility = idhistdiv.children.length == 0 ? "hidden" : "visible";
    }
    function calcResult(equalPressed) {
        g_Rslt = '';
        if (/^$|^-?[\.,\d]+$/.test(visualExpr()))
            return iddsplyRp.innerHTML = "";
        let expr = readyExpr4Lexing(!equalPressed), rslt;
        try {
            rslt = g_EA.resolveExpr(expr, isUseRadians()) || NaN;
            if (isNaN(rslt) && equalPressed)
                g_Rslt = "Unreal";
            else if (!isFinite(rslt) && equalPressed)
                g_Rslt = (rslt == Infinity ? "∞" : "-∞");
            else if (!isFinite(rslt))
                g_Rslt = "";
            else {
                let numRslt = toMCPrec(rslt, 12);//takes care of Locales, also
                let fancy   = fancyRsltDisplay(g_CD.degrouped(numRslt));
                g_Rslt = equalPressed ? fancy || "" : numRslt;
                if (equalPressed) {
                    updateHistory([visualExpr(), String(numRslt)]);
                    g_CD.setTemp(numRslt);
                    g_CD.setColor(getComputedStyle(iddsplyRp).color, g_CD.bgcolor, g_CD.selectcolor);
                }
            }
            iddsplyRp.innerHTML = g_Rslt;
        }
        catch (ex) {
            const exs = ex.toString();
            if (equalPressed && /\?\?/.test(exs))//incomplete
                g_Rslt = exs.replace(/\?\?|Error: /g, '');
            else if (equalPressed)
                g_Rslt = "Format Error";
            else
                g_Rslt = '';
            iddsplyRp.innerHTML = g_Rslt;
        }
    }
    function callbackSwitch(dat) {
        //dat is a 2-valued array: event(or null or "setTemp") and degrouped text
        const [evt, dtxt] = dat;
        g_CD.setColor(...getThemeColors());
        if (evt && evt.type && evt.type == "keydown") {
            if (/^\d$/.test(evt.key) || evt.key == g_DecSep)
                g_CD.addText(evt.key);
            else if (evt.key == "Enter")
                return calcResult(true);
            else if (evt && evt.type == "keydown" && /^[-+*/^]$/.test(evt.key)) {
                switch (evt.key) {
                    case '+': g_CD.addText('+'); break;
                    case '-': g_CD.addText('‒'); break;//non-ascii minus
                    case '*': g_CD.addText('×'); break;//non-ascii mult. symbol
                    case '/': g_CD.addText('÷');
                }
            }
        }
        if (evt === "setTemp")
            visualExpr(dtxt, false);
        else
            calcResult(false);
        buttonManager();
    }
    function clearHistory(evt){
        g_History.clear();
        idhistdiv.innerHTML = '';
        alert("History cleared");
        buttonManager();
    }
    function copy2Clip(evt){
        if(evt.srcElement.id == "iddsply")
            window.navigator.clipboard.writeText(visualExpr());
        else if(evt.srcElement.id == "iddsplyRp")
            window.navigator.clipboard.writeText(iddsplyRp.innerHTML);
        evt.preventDefault();
    }
    function doKeyPress(s) {
        g_CD.addText(s);
    }
    function fancyRsltDisplay(rslt) {
        const boldVariant = (int) => {
            const baseDigit = 0x0030, boldBaseDigit = 0x1d7ec;
            return String(int).split("").map((d) => {
                return String.fromCodePoint((d.codePointAt(0) - baseDigit) + boldBaseDigit);
            }).join("");
        };
        const hasRadicalOnly = (t) => /⎷/.test(t) && !/(log|ln|sin|cos|tan|exp)/.test(t);
        const hasLogOnly = (t) => /([eπ\W]|^)(log\()/.test(t) && !/⎷/.test(t) && !/(?<=[nps])\(/.test(t);
        const hasLnOnly = (t) => /([eπ\W]|^)(ln\()/.test(t) && !/⎷/.test(t) && !/(?<=[gps])\(/.test(t);
        const anyFunc = (t) => /⎷/.test(t) || /(log|ln|sin|cos|tan|exp)/.test(t);
        const nR = Number(rslt);
        if (isFinite(nR) && !Number.isInteger(nR)) {
            if (hasLogOnly(visualExpr())) {
                const logSimpl = M.log10Simplify(nR);
                if (logSimpl !== null)
                    return `${logSimpl[0]}log(${logSimpl[1]})`;
            }
            else if (hasLnOnly(visualExpr())) {
                const lnSimpl = M.logSimplify(nR);
                if (lnSimpl !== null)
                    return `${lnSimpl[0]}ln(${lnSimpl[1]})`;
            }
            else if (hasRadicalOnly(visualExpr())) {
                const radSimpl = M.radSimplify(nR);
                if (radSimpl !== null)
                    return `${radSimpl[0]}⎷${radSimpl[1]}`;
            }
            else if (!anyFunc(visualExpr())) {
                const fracArr = M.float2Fraction(Number(rslt));
                if (fracArr !== null && fracArr[1] > 0) {
                    const baseml = `~W<span style="font-size:50%;"><math style="vertical-align:8px"><mfrac><mn>~N</mn><mn>~D</mn></mfrac></math></span>`;
                    return baseml.replace('~W', fracArr[0]).replace('~N', boldVariant(fracArr[1])).replace('~D', boldVariant(fracArr[2]));
                }
            }
        }
        return null;
    }
    function getParenCount() {
        const exprArr = visualExpr().split("");
        const opens   = exprArr.filter((c) => c == '(');
        const closes  = exprArr.filter((c) => c == ')');
        return opens.length - closes.length;
    }
    function getThemeColors() {
        if (idtheme.innerHTML.startsWith("Dark"))
            return ["black", "white", "rgba(0,40,255,0.15)"];
        return ["white", "black", "rgb(64,64,64)"];
    }
    function isNumericResult() {
        //empty string also results in *false* return value
        try { return g_Rslt.length > 0 && isFinite(g_EA.resolveExpr(readyExpr4Lexing(false)), isUseRadians()) } catch (ex) { return false; }
    }
    function isPrimaryFace() { return btn_sqrt_sqr.innerHTML == "⎷" }
    function isUseRadians() { return btn_degrad.innerHTML.toLowerCase().indexOf("rad") > -1 }
    function invertFns(e) {
        const priFace = isPrimaryFace();
        btn_sqrt_sqr.innerHTML = priFace ? "x<sup>2</sup>" : "⎷";
        btn_sin_asin.innerHTML = priFace ? "sin<sup>-1</sup>" : "sin";
        btn_cos_acos.innerHTML = priFace ? "cos<sup>-1</sup>" : "cos";
        btn_tan_atan.innerHTML = priFace ? "tan<sup>-1</sup>" : "tan";
        btn_ln_exp.innerHTML   = priFace ? "e<sup>x</sup>" : "ln"
        btn_log_10Px.innerHTML = priFace ? "10<sup>x</sup>" : "log";
        buttonManager();
    }
    function loadFromHistory(evt) {
        visualExpr(evt.srcElement.innerText);
        toggleHist();
    }
    function memFunc(verb) {
        const isnumres = isNumericResult();
        switch (verb) {
            case "clear":
                g_Memory = null; break;
            case "minus":
                if (isnumres) g_Memory = (g_Memory || 0) - nonfancyResult(); break;
            case "plus":
                if (isnumres) g_Memory = (g_Memory || 0) + nonfancyResult(); break;
            case "recall":
                if (g_Memory !== null)
                    g_CD.addText(String(g_Memory));
                break;
            case "set":
                if (isnumres) g_Memory = nonfancyResult();
        }
        buttonManager();
    }
    function multiChoice(fnname) {
        const priFace = isPrimaryFace();
        switch (fnname) {
            case "⎷":
                return priFace ? "⎷" : "²";
            case "ln":
                return priFace ? "ln(" : "exp(";
            case "log":
                return priFace ? "log(" : "10^";
            case "sin":
                return priFace ? "sin(" : "arcsin(";
            case "cos":
                return priFace ? "cos(" : "arccos(";
            case "tan":
                return priFace ? "tan(" : "arctan(";
        }
    }
    function nonfancyResult(){
        //returns a numeric result or null
        let expr = readyExpr4Lexing(true), rslt;
        try {
            rslt = g_EA.resolveExpr(expr, isUseRadians()) || NaN;
        }
        catch(ex){return null}
        return isFinite(rslt) ? rslt : null;
    }
    function readyExpr4Lexing(forgiving) {
        let expr = visualExpr().replaceAll('\u00d7', '*').replaceAll('÷', '/').replaceAll('\u2012', '-');
        expr = g_CD.degrouped(expr);
        if (g_DecSep == ',') expr = expr.replaceAll(',', '.');
        if (forgiving) {
            expr = expr.replace(/[\+\-\*/\^]+$/, '');
            const pc = getParenCount();
            expr += ')'.repeat(Math.max(0, pc));
        }
        return expr;
    }

    function theme(evt) {
        let theme1 = "Light", stored = "Light";
        if(window.localStorage)
            try{stored = localStorage.getItem("MPSC_THEME")}catch(ex){;}

        if (idtheme.innerHTML.startsWith("Dark") || (!evt && stored == "Dark")) {
            document.styleSheets[1].disabled = false;
            idtheme.innerHTML = "Light Theme";
            g_CD.setColor("white", "black", "rgb(64,64,64)"), g_CD.repaint();
            theme1 = "Dark";
        }
        else if (idtheme.innerHTML.startsWith("Light") || (!evt && stored == "Light")) {
            document.styleSheets[1].disabled = true;
            idtheme.innerHTML = "Dark Theme";
            g_CD.setColor("black", "white", "rgba(0,40,255,0.15)"), g_CD.repaint();
        }

        if(window.localStorage)
            try{localStorage.setItem("MPSC_THEME", theme1)}catch(ex){;}
    }
    function toggleDegRad(evt) { btn_degrad.innerHTML = isUseRadians() ? "Deg" : "Rad"; calcResult() }
    function toggleHist(evt) {
        if (idhistdiv.className == "clsexpanded")
            idhistdiv.className = "clscollapsed"
        else if(idhistdiv.children.length)
            idhistdiv.className = "clsexpanded";
        buttonManager();
    }
    function toggleInverseRslt(evt) {
        //should only get here if isNumericResult() == true according to buttonManager()
        const [atext, btext] = ['1÷(', ')'];
        let expr = visualExpr();
        if (expr.startsWith(atext) && expr.endsWith(btext))
            visualExpr(expr.slice(atext.length, -btext.length));
        else
            visualExpr(atext + expr + btext);
        calcResult();
    }
    function toMCPrec(n, prec) {
        //assumes *n* is integral number, *prec* is number > 0
        const digitcount = (s) => s.split("").filter((x) => /\d/.test(x)).length;
        const trimZeros  = (s) => s.replace(/0+$/, '');
        const nstr = n.toLocaleString();
        if (digitcount(nstr) > prec) return n.toExponential(Math.max(0,prec-5));

        let locStr   = nstr.split(g_DecSep)[0];
        let precStrs = n.toFixed(Math.max(0,prec-locStr.length)).split(g_DecSep);
        if (precStrs.length > 1 && !Number.isInteger(n)) {
            let zTrim = trimZeros(precStrs[1]);
            return locStr + (zTrim.length ? g_DecSep + zTrim : "");
        }
        return locStr;
    }
    function updateHistory(resultPair) {
        let hist = g_History.getHistory() || [];
        if(resultPair) {
            hist = hist.filter((x)=>x[0]!=resultPair[0]);//no duplicates!
            hist.push(resultPair);
        }
        g_History.setHistory(hist);
        let innerHt = '';
        for (const v of hist)
            innerHt += `<p class="clsexpr">${v[0]}</p><p class="clsrslt">${v[1]}</p><br />`;
        idhistdiv.innerHTML = innerHt;
        const qHist = Array.from(document.querySelectorAll("p.clsexpr, p.clsrslt")).filter((x) => x.className);
        for (const p of qHist)
            p.addEventListener("click", loadFromHistory);
        idhistdiv.scroll(1000000, 1000000);
    }
    function visualExpr(txt = null, docallback = true) {
        //getter and setter for displayed expression
        if (txt === null) return g_CD.getText();
        g_CD.setText(txt, docallback);
    }
    {
        g_CD.setFontProperties({ "attrib": "bold", sizeMin: 28, sizeMax: 46, units: "px", "name": "sans-serif" });
        g_CD.setAtomics(["arcsin(", "arccos(", "arctan(", "sin(", "cos(", "tan(", "log(", "exp(", "ln("]);
        g_CD.setCallback(callbackSwitch);
        g_CD.setCursor(true);

        btn_hist.addEventListener("click", toggleHist);
        btn_sqrt_sqr.addEventListener("click", (ev) => { doKeyPress(multiChoice("⎷")) });
        btn_PI.addEventListener("click", (ev) => { doKeyPress("π") });
        btn_pow.addEventListener("click", (ev) => { doKeyPress("^") });
        btn_fact.addEventListener("click", (ev) => { doKeyPress("!") });
        btn_inv.addEventListener("click", invertFns);
        btn_E.addEventListener("click", (ev) => { doKeyPress("e") });
        btn_ln_exp.addEventListener("click", (ev) => { doKeyPress(multiChoice("ln")) });
        btn_log_10Px.addEventListener("click", (ev) => { doKeyPress(multiChoice("log")) });
        btn_degrad.addEventListener("click", toggleDegRad);
        btn_sin_asin.addEventListener("click", (ev) => { doKeyPress(multiChoice("sin")) });
        btn_cos_acos.addEventListener("click", (ev) => { doKeyPress(multiChoice("cos")) });
        btn_tan_atan.addEventListener("click", (ev) => { doKeyPress(multiChoice("tan")) });
        btn_clearall.addEventListener("click", () => g_CD.clear());
        btn_parens.addEventListener("click", addParen);
        btn_pct.addEventListener("click", (ev) => { doKeyPress("%") });
        btn_div.addEventListener("click", (ev) => { doKeyPress("÷") });
        for (let i = 0; i <= 9; ++i) {
            const btn = document.getElementById("btn_digit" + i);
            btn.addEventListener("click", (ev) => { doKeyPress(String(i)) });
        }
        btn_mul.addEventListener("click", (ev) => { doKeyPress("×") });
        btn_sub.addEventListener("click", (ev) => { doKeyPress("‒") });
        btn_add.addEventListener("click", (ev) => { doKeyPress("+") });
        btn_bkspc.addEventListener("click", bkspc);
        btn_equal.addEventListener("click", () => calcResult(true));
        btn_invequal.addEventListener("click", toggleInverseRslt);
        idmc.addEventListener("pointerup", (evt) => { memFunc("clear") });
        idmplus.addEventListener("pointerup", (evt) => { memFunc("plus") });
        idmminus.addEventListener("pointerup", (evt) => { memFunc("minus") });
        idmr.addEventListener("pointerup", (evt) => { memFunc("recall") });
        idms.addEventListener("pointerup", (evt) => { memFunc("set") });
        idtheme.addEventListener("click", theme);
        idclearhist.addEventListener("click", clearHistory);
        //Locale aware
        g_DecSep = g_CD.groupChar() == '.' ? ',' : '.';
        btn_decsep.innerHTML = g_DecSep;
        btn_decsep.addEventListener("click", (ev) => { doKeyPress(g_DecSep) });

        document.addEventListener("keydown", (event) => g_CD.interactEvent(event));
        document.addEventListener('contextmenu', copy2Clip);

        theme();
        updateHistory();
        buttonManager();
    }
