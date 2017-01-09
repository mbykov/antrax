// antrax - query simple greek
/*
  каждому слову есть массив terms, ffs, empties, added
  результат:
  word-form
  ....
  dict: morph-string
  dict-1: morph-string1
  form: ff
  ....
  при клике на dict - разные словари
  yals: tatata
  bh: tatata
  sm: tatata

*/


let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let path = require('path');
let orthos = require('../orthos');

let PouchDB = require('pouchdb-browser');
let db_term = new PouchDB('term')
// PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/term', 'term')
let db_flex = new PouchDB('flex')
// PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/flex', 'flex')
let db_dict = new PouchDB('lsdict')

// PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/lsdict', 'lsdict', {live: true})
// PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/flex', 'flex', {live: true})
replicateDB('flex')
replicateDB('term')

function destroyDB(db) {
    db.destroy().then(function (response) {
        log('DB DESTROYED', response);
    }).catch(function (err) {
        console.log(err);
    });
}

function replicateDB(dbname) {
    log('REPLICATION START')
    let url = ['http:\/\/admin:kjre4317@localhost:5984/', dbname].join('')
    PouchDB.replicate(url, dbname).then(function (response) {
        log('DB REPLICATED', response);
    }).catch(function (err) {
        console.log('REPL ERR', err);
    });
}

module.exports = antrax();

function antrax() {
    if (!(this instanceof antrax)) return new antrax();
}

antrax.prototype.query = function(str, num, cb) {

    // destroyDB(db_flex)
    // replicateDB('flex')
    // return

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
        log('main r0,r1', res[0])
        main(res[0], res[1], function(words) {
            log('main clause', words)
            cb(words)
        });
    }).catch(function (err) {
        log('ANT ERR', err);
    })
}


// rows - это words, но все morphs отдельно
function main(rows, fls, cb) {
    let empties = _.select(rows, function(row) { return row.empty })
    log('Empties', empties);
    let terms = _.select(rows, function(row) { return row.type == 'term' })
    let ffs = _.select(rows, function(row) { return row.type == 'form' }) // FFS
    log('Comp TERMS', terms)
    let possibleForms = parsePossibleForms(empties, fls);
    log('Poss-Form-queries', possibleForms);
    queryDicts(possibleForms).then(function(dicts) {
        // выбрать из possibleForms найденные
        let addedForms = trueQueries(possibleForms, dicts);
        log('addedForms:::', addedForms);
        let words = terms.concat(ffs).concat(empties).concat(addedForms);
        let clause = _.groupBy(words, 'idx' )
        // log('antrax-clause:', clause)
        cb(clause)
    }).catch(function (err) {
        log('ERR DICTS', err);
    });
}

// δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα. π

function parsePossibleForms(empties, fls) {
    let queries = [];
    log('PF ROWS SIZE', empties.length);
    empties.forEach(function(row) {
        log('PF EMPTY ROW', row);
        fls.forEach(function(flex) {
            // log('PF', flex)
            if (flex.flex != row.form.slice(-flex.flex.length)) return;
            let stem = row.form.slice(0, -flex.flex.length);
            let query = [stem, flex.dict].join('');
            let word
            if (flex.pos == 'verb') {
                // log('FLEX VERB', flex.pos, flex.var, flex.numpers)
                word = {idx: row.idx, pos: flex.pos, query: query, stem: stem, form: row.form, numpers: flex.numpers, var: flex.var}
            } else {
                // log('FLEX NAME', flex.pos, flex.var, flex.numcase, flex.gend)
                word = {idx: row.idx, pos: flex.pos, query: query, stem: stem, form: row.form, gend: flex.gend, numcase: flex.numcase, var: flex.var}
            }
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

// gend - нужен
// FIXME: тут может меняться форма ударения в кос. падежах: πῆχυς-πήχεως
// и м.б. лишние решения. Найти и избавиться
// и то же с родом
// м.б. проверять с ударением, если ноль, еще раз по плоским
// ἰχθύς - ἰχθύος
// рыба дает множество лишних вариантов, если не проверять ударения и рода
// if (q.var == 'ah') return // это зачем?


// здесь плохо то, что dict-trn добавляется к каждой added-form, их м.б. много на результат
// и строки здесь же будут из разных словарей
function trueQueries(queries, dicts) {
    let addedForms = [];
    dicts.forEach(function(d) {
        let query = {dict: d.dict, id: d._id, pos: d.pos}
        queries.forEach(function(q) {
            if (q.query != d.dict) return
            if (q.pos == 'name') {
                if (!d.var.split('--').includes(q.var)) return
                if (d.gend && !d.gend.includes(q.gend)) return
                let morph = {gend: q.gend, numcase: q.numcase}
                if (!query.morphs) query.morphs = [morph]
                else query.morphs.push(morph)
                query.idx = q.idx
                query.form = q.form
                query.ok = true
                // log('DD', d.dict)
            } else if (d.pos == 'verb') {
                // в глаголах нет gend и var
                log('DDverb==================', d, 'Q', q.dict)
                let morph = {numpers: q.numpers}
                if (!query.morphs) query.morphs = [morph]
                else query.morphs.push(morph)
                query.idx = q.idx
                query.form = q.query
                query.ok = true
            } else {
                throw new Error('NO MORPHS')
            }
            // наверное, уж коли они группирутся, то вокруг idx тоже
        })
        if (!query.ok) return
        query.trn = 'd.trn'
        addedForms.push(query)
        // то же без ударения
        // if (!addedForms.length) {
        //     queries.forEach(function(q) {
        //         if (orthos.plain(q.query) != orthos.plain(d.dict)) return //  && q.gend == d.gend
        //         // if (q.query != d.dict) return //  && q.gend == d.gend
        //         if (q.pos == 'name' || q.pos == 'noun') {
        //             if (!d.var.split('--').includes(q.var)) return
        //             if (d.gend && !d.gend.includes(q.gend)) return
        //             log('DD', d, 'Q', q.var)
        //         } else if (q.pos == 'verb') {
        //             // в глаголах нет gend и var
        //             log('DDverb', d, 'Q', q.dict)
        //         }
        //         q.dict = d.dict
        //         q.trn = 'd.trn'
        //         addedForms.push(q)
        //     })
        //     // log('ZERO')
        // }
    })
    return addedForms
}

/*
  неясно, искать отдельно os и os-ox - если нет -ox, то нужно восстановить место и вид ударения
 */
function queryDicts(queries) {
    // let keys = _.uniq(queries.map(function(q) { return (q.type == 'term') ? q.form : q.query }))
    // terms здесь не может быть
    let keys = _.uniq(queries.map(function(q) { return q.query }))
    let plains = _.uniq(keys.map(function(key) { return orthos.plain(key)}))
    // log('DICT KEYS', keys)
    log('DICT Plains:', plains)
    return new Promise(function(resolve, reject) {
        db_dict.query('lsdict/byPlain', {
            keys: plains,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no dict result')
            // let dicts = res.rows.map(function(row) {return Object.assign({}, {dict: row.key}, row.value) })
            let dicts = res.rows.map(function(row) {return row.doc })
            log('Q DICTS RES', dicts)
            resolve(dicts)
        }).catch(function (err) {
            log('Q DICTS REJECT', err)
            reject(err)
        });
    });
}

function queryTerms(sentence) {
    let keys = sentence.split(' ')
    let ukeys = _.uniq(keys)
    log('UKEYS', ukeys)
    return new Promise(function(resolve, reject) {
        db_term.query('term/byForm', {
            keys: ukeys
            // include_docs: true
        }).then(function (res) {
            log('RES-TERMS', res)
            // return
            if (!res || !res.rows) throw new Error('no term result') //  || res.rows.length == 0
            let forms = []
            let allterms = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value);});
            keys.forEach(function(key, idx) {
                log('IDX, KEY', idx, key)
                let ffs = _.select(allterms, function(term) { return term.type == 'form' && term.form == key})
                ffs.forEach(function(ff) { ff.idx = idx})
                ffs.forEach(function(ff) { ff.ffs = true})
                let terms = _.select(allterms, function(term) { return term.type == 'term' && term.form == key})
                // term всегда один, конечных форм м.б. несколько
                let term = terms[0]
                let query
                if (terms.length == 0) {
                    query = {idx: idx, form: key, empty: true } // это пустые empty non-term формы
                } else {
                    query = {idx: idx, type: 'term', form: key, dict: term.dict, pos: term.pos, trn: term.trn}
                    terms.forEach(function(term) {
                        if (term.pos == 'pron') {
                            let morph = {gend: term.gend, numcase: term.numcase}
                            if (!query.morphs) query.morphs = [morph]
                            else query.morphs.push(morph)
                        } else if (term.pos == 'art') {
                            let morph = {gend: term.gend, numcase: term.numcase}
                            if (!query.morphs) query.morphs = [morph]
                            else query.morphs.push(morph)
                        } else {
                            // terms другой - просто загнать в forms
                        }
                    })
                }
                log('FFS', ffs.length)
                forms.push(query)
                forms = forms.concat(ffs)
            })
            log('query TERMS===>', forms);
            forms = _.flatten(forms)
            resolve(forms);
        }).catch(function (err) {
            log('queryTERMS ERRS', err);
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
            if (!res || !res.rows) throw new Error('no result') //  || res.rows.length == 0
            let flexes = res.rows.map(function(row) {return Object.assign({}, {flex: row.key}, row.value) })
            // log('FLEXES', flexes.length)
            // let docs = res.rows.map(function(row) {return row.doc;})
            log('FLEXES', flexes.length)
            resolve(flexes)
        }).catch(function (err) {
            log('ERR ALL FLEX', err)
            reject(err)
        });
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
