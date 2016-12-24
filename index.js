// antrax - query simple greek


// let word = process.argv.slice(2)[0] || false;
// let sentence = process.argv.slice(3)[0] || false;

// let util = require('util');

// if (!sentence) {
    // log('param string?');
    // return;
// }

let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let path = require('path');
let orthos = require('../orthos');
let PouchDB = require('pouchdb-browser');
let db_term = new PouchDB('term')
// PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/terms', 'term')
let db_flex = new PouchDB('flex')
// PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/flex', 'flex')

// sentence = sentence.replace(/\./, '');
// let current = orthos.toComb(word);
// sentence = orthos.toComb(sentence);
// return

// current = 'ἀσθένειαν';
// console.time('_query')
// queryTerms_old(sentence)
// query(sentence, current)
// getMorphs(current)
// console.timeEnd('_query')

/*
  взять terms, определить, cur is term?
  если нет, запросить flex - определить current-morphs
  получается, при клике на art или pron, соседей не ищу
  а если несколько words между cur и ближ. term?
  нужно всем искать flex
  но можно и облегченный вариант - проверить только найденное соответствие данного morph
*/


module.exports = antrax();

function antrax() {
    if (!(this instanceof antrax)) return new antrax();
}

antrax.prototype.query = function(str, num, cb) {
    let current = str.split(' ')[num];
    queryPromise(str, current, function(res) {
        // log('Q RES', res)
        cb(res)
    })
}

function queryPromise(sentence, current, cb) {
    // log('ANTRAX QUERY NUM', sentence, current)
    Promise.all([
        queryTerms(sentence),
        getAllFlex()
    ]).then(function (res) {
        main(current, res[0], res[1], function(words) {
            // log('words', words)
            cb(words)
        });
    }).catch(function (err) {
        log('ANT ERR', err);
    })
}

// rows - это words, но все morphs отдельно
function main(sentence, rows, fls, cb) {
    // log('q-ROWS', rows.length);
    // log('q-FLs', fls.length);
    // log('q-curr', current);
    let keys = sentence.split(' ')

    // let cMorph = isTerm(current, rows);
    if (false) { // cMorph.length
        // log('IS TERM - cancel', cMorph);
        //
    } else {
        // let currentFlexes = selectMorphs(current, fls);
        // log('currentFlexes', current, currentFlexes);
        let possibleForms = parsePossibleForms(rows, fls);
        // log('QS', possibleForms);
        queryDicts(possibleForms).then(function(dicts) {
            // выбрать из possibleForms найденные
            let addedForms = trueQueries(possibleForms, dicts);
            // log('addedForms:::', addedForms);
            let words = rows.concat(addedForms);
            let clause = {};
            words.forEach(function(word) {
                if (!clause[word.form]) clause[word.form] = [word]
                else clause[word.form].push(word)
            })
            cb(clause)

            // let chains = conform(words, currentFlexes);
            // log('CHAINS:::', chains);
            // cb(chains)
        }).catch(function (err) {
            log('ERR DICTS', err);
        });
    }
}

// δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα. π

function parsePossibleForms(rows, fls) {
    let queries = [];
    rows.forEach(function(row) {
        if (row.type == 'term') {
            queries.push(row)
            return;
        }
        if (row.pos == 'verb') return;
        // row.queries = [];
        // log('ROW', row);
        if (!row.form) log('NO FORM', row)
        fls.forEach(function(flex) {
            if (flex.flex != row.form.slice(-flex.flex.length)) return;
            let stem = row.form.slice(0, -flex.flex.length);
            let query = [stem, flex.dict].join('');
            // row.queries.push(query);
            let word = {idx: row.idx, pos: flex.pos, query: query, stem: stem, form: row.form, gend: flex.gend, numcase: flex.numcase, var: flex.var};
            // { flex: 'ῶν',
            //   gend: 'masc',
            //   numcase: 'pl.gen',
            //   descr: 'prima',
            //   var: 'a-cont',
            //   pos: 'noun',
            //   dict: 'ᾶ',
            //   size: 3,
            //   type: 'greek-flex' },

            queries.push(word)
        });
        // row.stems = _.uniq(row.stems);
    });
    return queries;
}

function trueQueries(queries, dicts) {
    let addedForms = [];
    queries.forEach(function(q) {
        dicts.forEach(function(d) {
            if (q.query == d.dict && q.gend == d.gend) {
                if (q.var == 'ah') return;
                q.dict = d.dict;
                q.trn = d.trn;
                addedForms.push(q);
            }
        });
    });
    return addedForms;
}

function queryDicts(queries) {
    let keys = _.uniq(queries.map(function(q) { return (q.type == 'term') ? q.form : q.query }))
    log('DICT KEYS', keys)
    return new Promise(function(resolve, reject) {
        db_term.query('terms1/byDict', {
            keys: keys
            // include_docs: true
        }).then(function (res) {
            // log('RES', res)
            if (!res || !res.rows || res.rows.length == 0) throw new Error('no dict result')
            let dicts = res.rows.map(function(row) {return Object.assign({}, {dict: row.key}, row.value) })
            resolve(dicts)
        }).catch(function (err) {
            reject(err)
        });
    });
}


// δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα.
function conform(rows, currentFlexes) {
    // log('CONFORM words', words.slice(3,4));
    // log('CONFORM currentFlexes', currentFlexes[0]);
    let chains = [];
    currentFlexes.forEach(function(cur) {
        if (!cur.gend) {
            chains.push(cur);
            return;
        }
        // log('cur-dict', cur.dict);
        let chain = [];
        // chain.push(cur);
        rows.forEach(function(word, idx) {
            // log('W', idx, word.form);
            // if (word.idx < pos - 3 || word.idx > pos + 3) return; // <<<<== POS ?
            if (cur.gend == word.gend && cur.numcase == word.numcase) {
                // if (word.dict) log('W', word.dict, cur.dict, cur.dict.length, '=', word.dict.slice(-cur.dict.length));
                if (word.dict && word.dict.slice(-cur.dict.length) != cur.dict) return;
                chain.push(word);
            }
        });
        // if (chain.length < 2) return;
        chains.push(chain);
        let max = _.max(chains.map(function(ch) { return ch.length; }));
        // log('MAX', max);
        chains = _.select(chains, function(ch) { return ch.length == max; });
    });
    return chains;
}

function isTerm(current, rows) {
    let curs = _.select(rows, function(w) { return w.type == 'term' && w.form == current;});
    // log('TERM CURS', curs);
    return curs;
}

// morphs для current
function selectMorphs(current, fls) {
    return _.select(fls, function(flex) { return flex.flex == current.slice(-flex.flex.length);});
}


function queryTerms(sentence) {
    let keys = sentence.split(' ')
    let ukeys = _.uniq(keys)
    return new Promise(function(resolve, reject) {
        db_term.query('terms1/byForm', {
            keys: ukeys
            // include_docs: true
        }).then(function (res) {
            // log('RES', res)
            // return
            if (!res || !res.rows || res.rows.length == 0) throw new Error('no result')
            let forms = []
            // let pos = keys.indexOf(current);
            let rows = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value);});
            keys.forEach(function(key, idx) {
                rows.forEach(function(word) {
                    if (word.form != key) return;
                    word.idx = idx;
                    if (word.type == 'form') word = {type: 'form', form: key, idx: idx}; // это пустые формы
                    // как то их можно прикрутить для тестов
                    forms.push(word);
                });
            });
            // log('queryTERMS FORMS', forms);
            resolve(forms);
        }).catch(function (err) {
            reject(err);
        });
    });
}

function getAllFlex() {
    return new Promise(function(resolve, reject) {
        db_flex.query('flex/byFlex', {
            // keys: tails
            // include_docs: true
        }).then(function (res) {
            if (!res || !res.rows || res.rows.length == 0) throw new Error('no result');
            let flexes = res.rows.map(function(row) {return Object.assign({}, {flex: row.key}, row.value);});
            // log('FLEXES', flexes.length);
            // let docs = res.rows.map(function(row) {return row.doc;});
            log('FLEXES', flexes.length);
            resolve(flexes);
        }).catch(function (err) {
            log('ERR ALL FLEX', err);
            // showDict(err);
            reject(err);
        });
    });
}


function showTerm(curs) {
    log('TERM', curs);
    return true;
}



// let sentence = [];
// keys.forEach(function(word, idx) {
//     if (word != key) return;
//     let doc = {idx: idx, word: word, keys: keys};
//     sentence.push(doc);
// });


function queryTerms_old(sentence) {
    let keys = sentence.split(' ');
    keys = _.uniq(keys);
    db.query('terms/byForm', {
        keys: keys
        // include_docs: true
    }).then(function (res) {
        // log('RES', res);
        let note = '';
        if (!res || !res.rows || res.rows.length == 0) {
            note = ['no result for', keys].join('\n');
            showDict(note);
            return;
        }
        let pos = keys.indexOf(current);
        let words = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value);});
        keys.forEach(function(key, idx) {
            words.forEach(function(word) {
                if (word.form != key) return;
                word.idx = idx;
            });
        });
        let curs = _.select(words, function(w) { return w.form == current;});
        // δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα.
        // ἀλλὰ τὰ μὲν πρὸ Ἕλληνος τοῦ Δευκαλίωνος καὶ πάνυ οὐδὲ εἶναι ἡ ἐπίκλησις καὶ αὕτη.
        let chains = [];
        curs.forEach(function(cur) {
            if (!cur.gend) {
                chains.push(cur);
                return;
            }
            // log('cur');
            let chain = [];
            words.forEach(function(word) {
                if (word.idx < pos - 3 || word.idx > pos + 3) return;
                if (cur.gend == word.gend && cur.numcase == word.numcase) {
                    chain.push(word);
                }
            });
            // if (chain.length < 2) return;
            chains.push(chain);
            let max = _.max(chains.map(function(ch) { return ch.length; }));
            // log('MAX', max);
            chains = _.select(chains, function(ch) { return ch.length == max; });
        });
        log('CHAINS', chains);

    }).catch(function (err) {
        log('ERR', err);
    });
}



function showDict(str) {
    let exec = require('child_process').exec;
    let cmd = 'notify-send "' + str + '"';
    exec(cmd, function(error, stdout, stderr) {
        // command output is in stdout
        if (stderr) log('EXEC', stderr);
    });
}




function log() { console.log.apply(console, arguments); }

function p() { console.log(util.inspect(arguments, false, null)) }



// 758. DEFINITE ARTICLE.
//     MASCULINE	FEMININE	NEUTER
// Nominative Singular	ὁ	ἡ	τό
// Genitive Singular	τοῦ	τῆς	τοῦ
// Dative Singular	τῷ	τῇ	τῷ
// Accusative Singular	τόν	τήν	τό
// Nominative and Accusative Dual	τώ	τώ	τώ
// Genitive and Dative Dual	τοῖν	τοῖν	τοῖν
// Nominative Plural	οἱ	αἱ	τά
// Genitive Plural	τῶν	τῶν	τῶν
// Dative Plural	τοῖς	ταῖς	τοῖς
// Accusative Plural	τούς	τάς	τά

// ταῖς
