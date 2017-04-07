/*

*/

let _ = require('underscore');
let path = require('path');
let fs = require('fs');
let orthos = require('../orthos');
var util = require('util');

let only = process.argv.slice(2)[0] || false;

const antrax = require('./index')

let dpath = './test/verbs.txt';

console.time('_gramm');
let tfacts = getFactories()
let res = sequentialize(tfacts)
console.timeEnd('_gramm');

function getFactories() {
    let factories = []
    let tests = getTests(dpath)
    let limit = tests.length - 2
    tests.forEach(function(json, idx) {
        if (!only && idx < limit) return
        let test = JSON.parse(json)
        for (let mod in test) {
            let reonly = new RegExp(only)
            if (only && !reonly.test(mod)) continue
            let cases = test[mod]
            for (let form in cases) {
                let morph = cases[form]
                form = orthos.toComb(form)
                factories.push(factory(form, mod, morph))
            }
        }
    })
    return factories
}

function factory(form, mod, morph) {
    return new Promise(function (resolve, reject) {
        antrax.query(form, 0, function(words, err) {
            if (err) {
                reject(err)
            } else {
                if (!words[0].dicts.length) log('T-ERR-dicts', form + ' - ' + mod + ' - ' + morph)
                let res = words[0].dicts[0].morphs
                // p(res)
                if (!res[mod]) throw new Error('no mod: ' + mod + ' morph: ' + morph + ' form: ' + form)
                let resmod = res[mod]
                if (!res[mod].includes(morph)) throw new Error('no mod: ' + mod + ' morph: ' + morph + ' form: ' + form)
                p(form + ' - ' + mod + ' - ' + morph)
                // resolve(form, mod, morph, words);
                resolve(words);
            }
        })
    })
}

function sequentialize(promiseFactories) {
    var chain = Promise.resolve();
    promiseFactories.forEach(function (promiseFactory) {
        chain = chain.then(promiseFactory);
    });
    return chain;
}



function getTests(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let tests = text.split('\n');
    // p(tests)
    return tests
}


function log() { console.log.apply(console, arguments); }
function p(o) { console.log(util.inspect(o, showHidden=false, depth=null, colorize=true)) }
