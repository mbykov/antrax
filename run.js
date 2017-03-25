/*

*/


let _ = require('underscore');
let path = require('path');
let fs = require('fs');
let orthos = require('../orthos');
var util = require('util');

let push = process.argv.slice(2)[0] || false;
let only
if (push == 'true') push = true
else if (push) {
    only = push
    push = false
    // only = orthos.toComb(only);
}

let onlypush = process.argv.slice(3)[0] || false;
if (onlypush == 'true') push = true

const antrax = require('./index')

let dpath = './test/verbs.txt';


console.time('_gramm');
run()
console.timeEnd('_gramm');

function run() {
    let tests = getTests(dpath)
    // console.log(util.inspect(tests, showHidden=false, depth=null, colorize=true))
    tests.forEach(function(json, idx) {
        // if (idx > 0) return
        let test = JSON.parse(json)
        // log('TEST', test)
        for (let mod in test) {
            // log('MOD', mod)
            let cases = test[mod]
            for (let form in cases) {
                let morph = cases[form]
                antrax.query(form, 0, function(words) {
                    // log(1, mod, 2, morph, 3, form)
                    // log(2, mod, 2, words[0].raw, 2, words[0].dicts)
                    if (!words[0].dicts.length) log('ERR', form + ' - ' + mod + ' - ' + morph)
                    let res = words[0].dicts[0].morphs
                    // p(res)
                    if (!res[mod]) throw new Error('no mod: ' + mod + ' morph: ' + morph + ' form: ' + form)
                    let resmod = res[mod]
                    if (!res[mod].includes(morph)) throw new Error('no mod: ' + mod + ' morph: ' + morph + ' form: ' + form)
                    p(form + ' - ' + mod + ' - ' + morph)
                })
            }
        }
    })
}

function getTests(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let tests = text.split('\n');
    // let rows = cleanRows(strs)
    // rows = _.compact(rows);
    return tests
}

// rows = rows.slice(0, 1000);
// let arr, dict;
// let docs = []
// rows.forEach(function(row, idx) {
// })


function log() { console.log.apply(console, arguments); }
function p(o) { console.log(util.inspect(o, showHidden=false, depth=null, colorize=true)) }
