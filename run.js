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
if (only) log('tests:', tfacts.length)
let res = sequentialize(tfacts)
log('============= res', res)
console.timeEnd('_gramm');


function getFactories() {
    let factories = []
    let tests = getTests(dpath)
    tests.forEach(function(json, idx) {
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
                let res = {form: form, mod: mod, morph: morph, words: words}
                resolve(res);
            }
        })
    })
}

function sequentialize(promiseFactories) {
    // let chain = Promise.resolve();
    promiseFactories.forEach(function (factory) {
        // chain = chain.then(promiseFactory)
        Promise.resolve().then(function() { return Promise.resolve(factory)}).then(function(res) {
            // p(res)
            // let oks = []
            // let errs = []
            let formok = false
            let modok = false
            let morphok = false
            res.words.forEach(function(word) {
                if (res.form == word.form) formok = true
                word.dicts.forEach(function(dict) {
                    if (_.keys(dict.morphs).includes(res.mod)) modok = true
                    if (/inf/.test(res.mod) && dict.var == res.mod) modok = true
                    if (/inf/.test(res.mod)) morphok = true
                    else if (_.flatten(_.values(dict.morphs)).includes(res.morph)) morphok = true
                })
            })
            // log(formok, modok, morphok)
            // if (formok && modok && morphok) oks.push(res)
            // else errs.push(res)
            if (formok && modok && morphok) log('ok:', res.form, res.mod, res.morph)
            else p('err', res)
        })

    });
    // return {ok: oks, errs: errs};
}



function getTests(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let tests = text.split('\n');
    // let limit = tests.length - 2
    if (!only) tests = tests.slice(-2)
    // p(tests)
    return tests
}


function log() { console.log.apply(console, arguments); }
// function p(o) { console.log(util.inspect(o, showHidden=false, depth=null, colorize=true)) }
function p() { console.log(util.inspect(arguments, false, null, colorize=true)) }
