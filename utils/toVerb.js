/*

*/


let _ = require('underscore');
let path = require('path');
let fs = require('fs');
let orthos = require('../../orthos');

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

let dpath = '../test/tmp.txt';

let strMorphs = {
    'First Person Singular': 'sg1',
    'Second Person Singular': 'sg2',
    'Third Person Singular': 'sg3',
    'Second Person Dual': 'du2',
    'Third Person Dual': 'du3',
    'First Person Plural': 'pl1',
    'Second Person Plural': 'pl2',
    'Third Person Plural': 'pl3'
}

console.time('_gramm');
run()
console.timeEnd('_gramm');

function run() {
    let rows = getTmp(dpath)
    log('RES', rows)
}

function getTmp(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let strs = text.split('\n');
    let rows = cleanRows(strs)
    rows = _.compact(rows);
    return rows
}

function cleanRows(strs) {
    let rows  = []
    let titles
    strs.forEach(function(str) {
        if (!str) return
        if (str[0] == '#') return
        str = str.replace(/-/g, '').replace('.', '')
        if (str[0] == '*') {
            str = str.replace('*', '')
            titles = str.split('	')
            titles = titles.map(function(t) { return t.toLowerCase()})
            return
        }
        let row = str.split('	')
        if (row.length != 3) throw new Error('NO TEST: ' + str)
        let morph = row[0]
        morph = strMorphs[morph]
        if (!morph) throw new Error('NO MORPH: ' + str)
        rows.push(row)
    })
    return {t: titles, r: rows}
}

// rows = rows.slice(0, 1000);
// let arr, dict;
// let docs = []
// rows.forEach(function(row, idx) {
// })


function log() { console.log.apply(console, arguments); }
