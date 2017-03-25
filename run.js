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
    tests.forEach(function(test) {
        log('TEST', test)
    })
    let test = 'λύεις'
    antrax.query(test, 0, function(words) {
        log('RUN', words)

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
