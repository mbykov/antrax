/*

*/


let _ = require('underscore');
let path = require('path');
let fs = require('fs');
let orthos = require('../../orthos');
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

let dpath = '../test/tmp.txt';

let strMorphs = {
    'First Person Singular': 'sg.1',
    'Second Person Singular': 'sg.2',
    'Third Person Singular': 'sg.3',
    'Second Person Dual': 'du.2',
    'Third Person Dual': 'du.3',
    'First Person Plural': 'pl.1',
    'Second Person Plural': 'pl.2',
    'Third Person Plural': 'pl.3'
}

let strMods = {
    'present active indicative': 'act.pres.ind',
    'imperfect active indicative': 'act.impf.ind',
    '': ''
}

console.time('_gramm');
run()
console.timeEnd('_gramm');

function run() {
    let docs = getTmp(dpath)
    console.log(util.inspect(docs, showHidden=false, depth=null, colorize=true))
    appendTest(docs)
}

function getTmp(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let strs = text.split('\n');
    let rows = cleanRows(strs)
    // rows = _.compact(rows);
    return rows
}

function cleanRows(strs) {
    let rows  = []
    let titles
    let a = []
    let b = []
    strs.forEach(function(str) {
        if (!str) return
        if (str[0] == '#') return
        str = str.replace(/-/g, '').replace('.', '')
        if (str[0] == '*') {
            str = str.replace('*', '')
            titles = str.split('	')
            if (titles.length != 2) throw new Error('No titles' + str)
            titles = titles.map(function(t) { return t.toLowerCase()})
            titles = titles.map(function(t) { return strMods[t]})
            return
        }
        let row = str.split('	')
        if (row.length != 3) throw new Error('NO TEST: ' + str)
        let morph = row[0]
        morph = strMorphs[morph]
        if (!morph) throw new Error('NO MORPH: ' + str)
        let ra = {}
        ra[morph] = row[1]
        a.push(ra)
        let rb = {}
        rb[morph] = row[2]
        b.push(rb)
    })
    let res1 = {}
    res1[titles[0]] = a
    rows.push(res1)
    let res2 = {}
    res2[titles[1]] = b
    rows.push(res2)
    return rows
}

function appendTest(docs) {
    log(docs)
    let tpath = '../test/verbs.txt'
    tpath = path.join(__dirname, tpath);
    let text = fs.readFileSync(tpath,'utf8').trim();
    let strs = text.split('\n');
    log('OLD', strs.length)
    docs.forEach(function(doc) {
        let str = JSON.stringify(doc)
        // log('DOC', str)
        strs.push(str)
    })
    let news = strs.join('\n')
    fs.writeFile(tpath, news, function(err) {
        if(err) return log(err)
        log("The file was saved, ", strs.length)
    })
}


// rows = rows.slice(0, 1000);
// let arr, dict;
// let docs = []
// rows.forEach(function(row, idx) {
// })


function log() { console.log.apply(console, arguments); }
