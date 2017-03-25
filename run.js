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
    // console.log(util.inspect(docs, showHidden=false, depth=null, colorize=true))
    tests.forEach(function(json, idx) {
        if (idx > 0) return
        let test = JSON.parse(json)
        // log('TEST', test)
        for (let mod in test) {
            let cases = test[mod]
            for (let form in cases) {
                let morph = cases[form]
                antrax.query(form, 0, function(words) {
                    log(1, mod, 2, morph, 3, form)
                    log(words[0].raw)
                    let res = words[0].dicts[0].morphs
                    p(res)
                })
            }
        }
        // test.forEach(function(t, idx) {
        //     log('TEST', t)
        // })
    })
    let test = 'λύεις'
    // antrax.query(test, 0, function(words) {
    //     p(words)
    //     let morph = words[0].dicts[0].morphs
    //     console.timeEnd('_gramm');
    // })
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
