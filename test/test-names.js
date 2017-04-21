/*

*/

let _ = require('underscore');
let path = require('path');
let fs = require('fs');
// let orthos = require('../../orthos');
var util = require('util');
var pseq = require('./push-seq');


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

let dpath = './names.txt';

// const morphs = ['title', 'sg.1', 'sg.2', 'sg.3', 'pl.1', 'pl.2', 'pl.3', '', '', '', ]

console.time('_gramm');
run()
console.timeEnd('_gramm');

function cleanRows(strs) {
    let tests = []

    let masc = { 'ὁ': 'sg.nom', 'τοῦ': 'sg.gen', 'τῷ': 'sg.dat', 'τόν': 'sg.acc', 'ὦ': 'sg.voc pl.voc', 'τὼ': 'du.nom du.acc du.voc', 'τοῖν': 'du.gen du.dat', 'οἱ': 'pl.nom', 'τῶν': 'pl.gen', 'τοῖς': 'pl.dat', 'τούς': 'pl.acc' }

    let fem = { 'ἡ': 'sg.nom', 'τῆς': 'sg.gen', 'τῇ': 'sg.dat', 'τήν': 'sg.acc', 'ὦ': 'sg.voc pl.voc', 'τὼ': 'du.nom du.acc du.voc', 'τοῖν': 'du.gen du.dat', 'αἱ': 'pl.nom', 'τῶν': 'pl.gen', 'ταῖς': 'pl.dat', 'τάς': 'pl.acc'}

    let neut = { 'τό': 'sg.nom sg.acc', 'τοῦ': 'sg.gen', 'τῷ': 'sg.dat',  'ὦ': 'sg.voc pl.voc', 'τὼ': 'du.nom du.acc du.voc', 'τοῖν': 'du.gen du.dat', 'τά': 'pl.nom pl.acc', 'τῶν': 'pl.gen', 'τοῖς': 'pl.dat'}

    let doc = {}
    strs.forEach(function(str, idx) {
        if (!str) return
        if (str[0] == '#') return
        str = str.trim()
        str = str.replace(/-/g, '')
        str = str.replace(/[\(\)]/g, '')
        str = str.replace(/\s+/g, ' ')
        log('STR', str)
        let items = str.split(' ')
        if (items.length <  10) return
        let gkey = items[0]
        // ὁ λόγος τοῦ λόγου τῷ  λόγῳ τόν λόγον (ὦ) λόγε οἱ λόγοι τῶν λόγων τοῖς λόγοις τούς λόγους (ὦ) λόγοι
        let gend =  (gkey == 'ὁ') ? masc : (gkey == 'τό') ? neut : fem
        let gname =  (gkey == 'ὁ') ? 'masc' : (gkey == 'τό') ? 'neut' : 'fem'
        if (!gend) log('NO GEND', gend)
        items.forEach(function(item, idx) {
            for (let art in gend) {
                if(item != art) continue
                let morphs = gend[art].split(' ')
                let morph = (morphs.length < 2) ? morphs[0] : (idx > 10) ? morphs[1]  : morphs[0]
                if (art == 'τό') morph = (idx == 0) ? morphs[0] : morphs[1]
                else if (art == 'τά') morph = (idx == 10) ? morphs[0] : morphs[1]
                // log(art, items[idx+1], gname, morph)
                let test = {form: items[idx+1], gend: gname, numcase: morph}
                let tstr = JSON.stringify(test)
                let reonly = new RegExp(only)
                // log(reonly, tstr, reonly.test(tstr))
                if (only && !reonly.test(tstr)) continue
                tests.push(test)
            }
        })
    })
    return tests
}

function run() {
    let tests = getTmp(dpath)
    // log('HERE', tests)
    // log('PUSH', push)
    pseq.run(tests)
}

function getTmp(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let strs = text.split('\n');
    let tests = cleanRows(strs)
    return tests
}



function log() { console.log.apply(console, arguments); }
function p(o) { console.log(util.inspect(o, showHidden=false, depth=null, colorize=true)) }
