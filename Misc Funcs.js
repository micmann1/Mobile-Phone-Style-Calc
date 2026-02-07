
"use strict";

// function toPrimes(n){
//     //for Js integer numbers in range [2 - 2^53]...
//     if(!Number.isInteger(n) || n<=1 || n>Math.pow(2,53))
//         throw new Error('wrong type; expecting int in range [2 - 2^53]');
//     let primes = [];
//     if(n == 2 || n == 3 || n == 5 || n == 7) return [n];
//     while(n%2 == 0) primes.push(2), n/=2;
//     let maxloopvar = Math.round(Math.sqrt(n));
//     for(let i=3; i<=maxloopvar; i+=2){
//         if(n%i == 0){
//             primes.push(i);
//             n/=i;
//             i-=2;
//             maxloopvar = Math.round(Math.sqrt(n));
//         }
//     }
//     return primes.concat(n);
// }
// function counterFromArray(ar){
//     //the output counter(Map) uses *ar* members as Keys, and the
//     // quantity of each as the Values.
//     const m = new Map();
//     ar.forEach((v)=>{m.set(v,(m.get(v) || 0) + 1)});
//     return m;
// }

class M/*Misc*/ {
    static float2Fraction(f) {
        const sign = Math.sign(f);
        f = sign * f;
        const wholen = Math.trunc(f);
        const fracn = f - wholen;
        //only up to 6 digit denom.
        for (let i = 2; i < 1e6; ++i) {
            const r = fracn * i;
            if (Math.abs(r - Math.round(r)) < 1e-7)
                return [wholen * sign, Math.round(r), i];
        }
        return null;
    }
    static logSimplify(n) {
        for (let i = 2; i <= 53; ++i) {
            const g = n / Math.log(i);
            if (Math.round(g) == 1) continue;
            if (Math.abs(g - Math.round(g)) < 1e-10)
                return [Math.round(g), i];
        }
        return null;
    }
    static log10Simplify(n) {
        for (let i = 2; i <= 53; ++i) {
            const g = n / Math.log10(i);
            if (Math.round(g) == 1) continue;
            if (Math.abs(g - Math.round(g)) < 1e-10)
                return [Math.round(g), i];
        }
        return null;
    }
    static radSimplify(n) {
        for (let i = Math.min((n * n) | 0, 1e7/*clock easy*/); i >= 2; --i) {
            const s = Math.pow(n / i, 2);
            if (Math.abs(s - Math.round(s)) < 1e-11)
                return [i, Math.round(s)];
        }
        return null;
    }
}

