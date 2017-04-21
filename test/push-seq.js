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
    sequentialize(tests)
    let fctrs = getFactories(tests)
    log(fctrs.length)
    sequentialize(fctrs)
}

console.timeEnd('_names');


function getFactories(tests) {
    let factories = []
    tests.forEach(function(test, idx) {
        log('T', idx, test)
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
            // log('F', factory)
            log('R', res)
            // let formok = false
            // let modok = false
            // let morphok = false
            // res.words.forEach(function(word) {
            //     if (res.form == word.form) formok = true
            //     word.dicts.forEach(function(dict) {
            //         if (_.keys(dict.morphs).includes(res.mod)) modok = true
            //         if (/inf/.test(res.mod) && dict.var == res.mod) modok = true
            //         if (/inf/.test(res.mod)) morphok = true
            //         else if (_.flatten(_.values(dict.morphs)).includes(res.morph)) morphok = true
            //     })
            // })
            // if (formok && modok && morphok) log('ok:', res.form, res.mod, res.morph)
            // else p('err', res)
        })

    });
    // return {ok: oks, errs: errs};
}



function log() { console.log.apply(console, arguments); }
// function p(o) { console.log(util.inspect(o, showHidden=false, depth=null, colorize=true)) }
function p() { console.log(util.inspect(arguments, false, null, colorize=true)) }
