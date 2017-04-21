/* query greek
*/

let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let util = require('util');
let path = require('path');
// let orthos = require('../orthos');
// let u = require('./lib/utils');
// let modCorr = u.modCorr

let antrax = require('../index');

module.exports = pushseq();

function pushseq() {
    if (!(this instanceof pushseq)) return new pushseq();
}

console.time('_names');

pushseq.prototype.run = function(tests, cb) {
    log('======TT', tests.length)
    let fctrs = getFactories(tests)
    log('FCTS', fctrs.length)
    sequentialize(fctrs)
}

console.timeEnd('_names');


function getFactories(tests) {
    let factories = []
    tests.forEach(function(test, idx) {
        // log('T', idx, test)
        factories.push(factory(test))
    })
    return factories
}

function factory(test) {
    return new Promise(function (resolve, reject) {
        antrax.query(test.form, 0, function(words, err) {
            if (err) {
                reject(err)
            } else {
                let res = {test: test, words: words}
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
            // let formok = false
            let ok = false
            res.words.forEach(function(word) {
                word.dicts.forEach(function(dict) {
                    dict.morphs.forEach(function(morph) {
                        if (res.test.gend == morph.gend && res.test.numcase == morph.numcase) ok = true
                    })
                })
            })
            if (ok) log('ok:', res.test)
            else p('err', res)
        })

    });
    // return {ok: oks, errs: errs};
}



function log() { console.log.apply(console, arguments); }
// function p(o) { console.log(util.inspect(o, showHidden=false, depth=null, colorize=true)) }
function p() { console.log(util.inspect(arguments, false, null, colorize=true)) }
