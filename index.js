/* query greek
*/

let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let util = require('util');
let path = require('path');
let orthos = require('../orthos');
let u = require('./lib/utils');
let modCorr = u.modCorr

let forTest = process.argv.slice(2)[0] || false;
// console.log('FOR TEST', forTest, forTest == '--no-sandbox')

let PouchDB, db_flex, db
if (forTest == '--no-sandbox') {
    PouchDB = require('pouchdb-browser');
    db_flex = new PouchDB('gr-flex')
    db = new PouchDB('greek')
} else {
    PouchDB = require('pouchdb');
    db_flex = new PouchDB('http:\/\/localhost:5984/gr-flex');
    db = new PouchDB('http:\/\/localhost:5984/greek');
}

// destroyDB(db)
// destroyDB(db_flex)
// return

// ἀτύχημα <<== проверить LS

replicateDB('gr-flex')
replicateDB('greek')
// return

function destroyDB(db) {
    db.destroy().then(function (response) {
        console.log('DB DESTROYED', response);
    }).catch(function (err) {
        console.log(err);
    });
}

function replicateDB(dbname) {
    log('REPLICATION START', dbname)
    let url = ['http:\/\/admin:kjre4317@localhost:5984/', dbname].join('')
    PouchDB.replicate(url, dbname).then(function (response) {
        log('DB REPLICATED', dbname, response);
    }).catch(function (err) {
        console.log('REPL ERR', err);
    });
}

module.exports = antrax();

function antrax() {
    if (!(this instanceof antrax)) return new antrax();
}

// punctuation \u002E\u002C\u0021\u003B\u00B7\u0020\u0027 - ... middle dot, space, apostrophe
function parseClause(str, num) {
    let words = []
    let keys = str.split(' ')
    let current = str.split(' ')[num];
    if (!current) current = 0
    let plain, form, accents
    keys.forEach(function(key, idx) {
        if (idx == 0) form = orthos.dc(key) // downcase
        else form = key
        form = form.replace(/[\u002E\u002C\u0021\u003B\u00B7\u0020\u0027]/, '') // punctuation ?
        form = orthos.toComb(form)
        plain = orthos.plain(form)
        accents = form.length - plain.length
        if (accents > 1) form = orthos.correctAccent(form)
        let word = {idx: idx, form: form, plain: plain, raw: key, dicts: []}
        if (idx == num) word.current = true
        words.push(word)
    })
    return words
}

antrax.prototype.query = function(str, num, cb) {
    let words = parseClause(str, num)
    queryPromise(words, function(res) {
        cb(res)
    })
}

function queryPromise(words, cb) {
    Promise.all([
        queryTerms(words),
        getAllFlex()
    ]).then(function (res) {
        main(words, res[0], res[1], function(clause) {
            cb(clause)
        });
    }).catch(function (err) {
        log('ANTRAX ERR', err);
    })
}

// ======================================================================
//  καὶ ὃς ἐὰν δέξηται παιδίον. τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
// τοιαύτη, τοιοῦτο, τοιοῦτον ;;; ὀνόματι
function main(words, tires, fls, cb) {
    // выбираю только indecls:
    words.forEach(function(word, idx) {
        let word_indecls = _.select(tires.indecls, function(doc) { return doc.dict == word.form })
        let word_terms = _.select(tires.terms, function(doc) { return doc.form == word.form })
        if (word_indecls.length) word.dicts = word_indecls, word.indecl = true
        if (word_terms.length) word.dicts = word_terms, word.term = true
    })
    log('Ws', words)

    let terms = _.select(words, function(row) { return row.term })
    // log('INDECLS', indecls)
    let empties = _.select(words, function(row) { return !row.indecl })
    log('Empties', empties);
    let possibleFlex = parsePossibleForms(empties, fls);
    log('Poss-Form-queries', possibleFlex.length, possibleFlex[0]);

    // dicts for terms: (other indecl already are dicts)

    let termdicts = _.map(tires.terms, function(doc) { return doc.dict })

    let queries = _.uniq(possibleFlex.map(function(q) { return q.query }))
    let plains = _.uniq(queries.map(function(key) { return orthos.plain(key)}))
    log('plains', plains)
    // let tplains = _.uniq(termdicts.map(function(key) { return orthos.plain(key)}))
    log('tdicts', termdicts)
    let allqs = plains.concat(termdicts)
    log('MAIN KEY-ALL', allqs)

    queryDicts(allqs).then(function(dpres) {
        words.forEach(function(word) {
            if (!word.term) return
            termdicts.forEach(function(tdict) {
                let thisdicts = _.select(word.dicts, function(d) { return d.dict == tdict})
                if (!thisdicts.length) return
                let expos = _.select(dpres.dicts, function(d) { return d.dict == tdict })
                // log('EXPOS', expos)
                if (expos.length) word.dicts = word.dicts.concat(expos)
            })
        })

        dict4word(words, possibleFlex, dpres.plains);
        cb(words)
    }).catch(function (err) {
        log('ERR DICTS', err);
    });
}

function parsePossibleForms(empties, fls) {
    let forms = [];
    empties.forEach(function(row) { // , idx
        fls.forEach(function(flex) {
            let term = flex._id
            if (flex._id != row.form.slice(-flex._id.length)) return;
            flex.morphs.forEach(function(morph) {
                if (morph.pos == 'verb') {
                    let stem = row.form.slice(0, -flex._id.length);
                    let query = [stem, morph.dict].join('');
                    // тут только full-формы, включая act.pres.ind:
                    let sform = {idx: row.idx, pos: morph.pos, query: query, form: row.form, stem: stem, dict: morph.dict, term: term, numper: morph.numper, var: morph.var, descr: morph.descr, woapi: true} // , morph: morph , flex: flex

                    // проверка q.woapi на augment, добавляет aug, и отбрасывает impf без aug
                    if (u.augmods.includes(morph.var)) {
                        let aug = stem.slice(0,2)
                        if (_.keys(u.augs).includes(aug)) sform.aug = aug, forms.push(sform)
                    }
                    else forms.push(sform)

                    // API: создание дополнительных api-форм для поиска по api-stem
                    // εἴχετε - ἔχω - не работает, надо подумать FIXME: // ἀγορᾷ
                    if (u.augmods.includes(morph.var)) {
                        let aug = stem.slice(0,2)
                        if (_.keys(u.augs).includes(aug)) {
                            let aquery = [stem.slice(2), 'ω'].join('')
                            aquery = [u.augs[aug], aquery].join('')
                            let form = {idx: row.idx, pos: morph.pos, query: aquery, form: row.form, numper: morph.numper, var: morph.var, descr: morph.descr, aug: aug, stem: stem, term: term, dict: morph.dict, api: true}
                            forms.push(form)
                        }
                    // } else if (modCorr['act.fut.ind'].includes(morph.var)) {
                    } else {
                        let aquery = [stem, 'ω'].join('')
                        let form = {idx: row.idx, pos: morph.pos, query: aquery, form: row.form, numper: morph.numper, var: morph.var, descr: morph.descr, stem: stem, term: term, dict: morph.dict, api: true}
                        forms.push(form)
                    }
                } else if (morph.pos == 'inf') {
                    // здесь нужно конструировать aug для aor2 - inf определяется только по словарю, но там aor имеет aug
                    // FIXME: aug для aor - λαμβάνω, aor ἔλαβον, inf λαβεῖν
                    let stem = row.form.slice(0, -flex._id.length);
                    if (row.form != [stem, term].join('')) return // это откуда может взяться, непонятно?
                    let mdict = (morph.api) ? morph.api : morph.dict
                    let query = [stem, mdict].join('');
                    let form = {idx: row.idx, pos: 'inf', query: query, form: row.form, var: morph.var, descr: morph.descr, stem: stem, dict: morph.dict, term: term, api: morph.api}
                    forms.push(form)
                } else {
                    // name & part
                    let stem = row.form.slice(0, -flex._id.length);
                    let query = [stem, morph.dict].join('');
                    let last = stem.slice(-1)
                    let last2 = stem.slice(-2)
                    // ἀξίας - sg.gen - проходит, если закомментировать:
                    // if (!['ε', 'ι', 'ρ']. includes(last) && ['sg.gen', 'sg.dat']. includes(morph.numcase) && ['ας']. includes(flex._id)) return
                    if (last2 == 'σσ' && ['sg.gen', 'sg.dat']. includes(morph.numcase) && 'ας' == flex._id ) return
                    let form = {idx: row.idx, pos: morph.pos, query: query, stem: stem, form: row.form, gend: morph.gend, numcase: morph.numcase, var: morph.var, dict: morph.dict, add: morph.add, term: term} // , flex: flex - убрать
                    forms.push(form)
                }
            })
        })
    })
    return forms;
}

function selectNames(word, names, qqnames) {
    names.forEach(function(d) {
        let nquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: [], weight: d.weight }
        let qnstricts = _.select(qqnames, function(q) { return q.query == d.dict })
        let qnames = (qnstricts.length) ? qnstricts : _.select(qqnames, function(q) { return orthos.plain(q.query) == d.plain})
        log('4w-QNs', qnames)
        qnames.forEach(function(q) {
            // TODO: здесь можно убрать дубликаты morph, но сложно проверять наличие объекта в morphs
            if (!d.var) return
            let qvar2 = q.var.split(/ |, /)
            qvar2.forEach(function(qvar) {
                if (d.var != qvar) return
                let morph = {gend: q.gend, numcase: q.numcase, flex: q.flex} // , flex: q.flex
                if (d.gend && !q.add) {
                    // log('DGEND', d.gend, 'QGEND', q)
                    morph.gend = d.gend
                    nquery.morphs.push(morph)
                }
                else if (!d.gend){
                    // FIXME: здесь в fem, в ous, как всегда, pl.acc-sg.gen - убрать лишнее при ier
                    // двух окончаний - fem не проходит:
                    if (d.adj == 2 && q.gend == 'fem') return
                    nquery.morphs.push(morph)
                    if (d.term == 2 && q.gend == 'masc') {
                        let femorph = {gend: 'fem', numcase: q.numcase}
                        nquery.morphs.push(femorph)
                    }
                }
            })
            nquery.form = q.form // q.form == bare.word
        })
        if (!nquery.morphs.length) return
        word.dicts.push(nquery)
    })
}

function selectPart(word, verbs, qparts) {
    verbs.forEach(function(d) {
        let iquery
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}, weight: d.weight}
        let pquery = {type: d.type, dict: d.dict, pos: 'part', trn: d.trn, morphs: [], weight: d.weight }

        log('4s-qps', qparts)
        qparts.forEach(function(q) {
            // log('==PART', d, q)
            if (d.var != 'act.pres.ind') return

            let qform = orthos.plain(q.form)
            let qterm = orthos.plain(q.term)
            let qdict = orthos.plain(q.dict)

            let reterm = new RegExp(qterm + '$')
            let qstem = qform.replace(reterm, '')
            let qplain = [qstem, qdict].join('')

            if (qplain != d.plain) return

            let morph = {gend: q.gend, numcase: q.numcase}
            pquery.morphs.push(morph)

            pquery.idx = q.idx
            pquery.form = q.form // это же просто word??
            pquery.var = q.var // здесь значение затирается, считаю, что все morph - принадлежат одному var
            // log('PART AFTER FILTER')
        })
        if (!pquery.morphs.length) return
        // log('4w-pquery', pquery)
        word.dicts.push(pquery)
    })
}

function selectInf(word, verbs, qinfs) {
    log('INFS, qinfs:', qinfs)
    verbs.forEach(function(d) {
        let iquery
        qinfs.forEach(function(q) {
            let qform = orthos.plain(q.form)
            let qterm = orthos.plain(q.term)
            // inf - stem всегда api - ?
            let qdict = (q.api && d.var == 'act.pres.ind') ? q.api : q.dict
            qdict = orthos.plain(qdict)
            let re = new RegExp(qdict + '$')
            let stem = d.plain.replace(re, '')

            if (qform != [stem, qterm].join('')) return
            // still no perfect:
            if (/pf/.test(q.var)) return
            log('INF AFTER FILTER')
            iquery = {idx: q.idx, form: q.form, type: d.type, dict: d.dict, pos: 'inf', trn: d.trn, var: q.var } // всегда один результат
        })
        if (!iquery) return
        word.dicts.push(iquery)
    })
}


//  καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
function dict4word(words, queries, dicts) {
    // let terms = _.select(dicts, function(d) { return d.term})
    let mutables = _.select(dicts, function(d) { return !d.term})
    log('4w-Muts', mutables)
    log('4w-queries', queries)

    let names = _.select(mutables, function(d) { return d.pos == 'name'} )
    let verbs = _.select(mutables, function(d) { return d.pos == 'verb'} )
    // let infs = _.select(mutables, function(d) { return d.pos == 'inf'} )
    // let parts = _.select(mutables, function(d) { return d.pos == 'part'} )
    log('4w-Verbs', verbs)

    words.forEach(function(word) {
        let qqnames = [], qverbs = [], qinfs = [], qparts = []
        queries.forEach(function(q) {
            if (word.idx != q.idx) return
            if (word.form != q.form) return
            else if (q.pos == 'name') qqnames.push(q)
            else if (q.pos == 'part') qparts.push(q)
            else if (q.pos == 'verb') qverbs.push(q)
            else if (q.pos == 'inf') qinfs.push(q)
        })
        log('4w-qv', qverbs)
        log('4w-qi', qinfs)
        if (names.length && qqnames.length) selectNames(word, names, qqnames)
        if (verbs.length && qverbs.length) selectVerb(word, verbs, qverbs)
        if (verbs.length && qparts.length) selectPart(word, verbs, qparts)
        if (verbs.length && qinfs.length) selectInf(word, verbs, qinfs)
    })
}

function selectVerb(word, verbs, qverbs) {
    log('4w-qverbs', qverbs)
    let napis = _.select(verbs, function(verb) {return verb.var != 'act.pres.ind'})
    if (napis.length) verbs = napis
    log('4w-napis', verbs)

    verbs.forEach(function(d) {
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}, weight: d.weight}

        qverbs.forEach(function(q) {
            // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
            // но пока я его не строю, пропускаю все modCorr
            // ================== FILTER ==================
            if (q.descr != d.descr) return
            let filter
            if (d.var == 'act.pres.ind') {
                if (q.api) filter = filterApi(d, q) // искусственные формы всех времен, pres тут нет
                // else if (q.woapi) filter = filterSimple(d, q) // все формы презенса
            }
            else if (q.woapi) filter = filterNapi(d, q) // полные формы, кроме pres
            else {
                // log('NO FILTER MAIN', d.var, q.var)
                // d - не api, а q -api
                // throw new Error('NO API MAIN FILTER')
            }
            if (!filter) return

            if (!vquery.morphs[q.var]) vquery.morphs[q.var] = [q.numper]
            else if (vquery.morphs[q.var].includes(q.numper)) return // это уберет неоднозначность, и можно отказаться от descr
            else vquery.morphs[q.var].push(q.numper)
            vquery.idx = q.idx
            vquery.form = q.query
        })
        if (!_.keys(vquery.morphs).length) return
        word.dicts.push(vquery)
    })
}

// vforms -  full verb-form: fut, aor, etc
function filterNapi(d, q) {
    log('filter NAPI', d.var, q.var)
    if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον

    log('mod ok')
    // строим plain dict.form
    let re = new RegExp(q.term + '$')
    let qstem = q.form.replace(re, '')
    let form = [qstem, q.dict].join('')
    let pform = orthos.plain(form)
    if (d.plain != pform) return

    return true
    // return compare(q.form, null, dstem, q.term, d, q)
}

// if (q.woapi) return
// if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
// но! здесь соответствие плохо в ἔπαυσα - нужно найти aor по api стему
// ἐπίστευσα - ἐπίστευον - нужно различить, нельзя взять api-стем для поиска aor, возьмет stem из api, и найдет impf
// противоречие
// if (q.descr != d.descr) return
function filterApi(d, q) {
    log('filter API')
    if (!modCorr['act.pres.ind'].includes(q.var)) return
    log('mod ok, q', q)

    // строим plain dict.form
    let re = new RegExp(q.term + '$')
    let qstem = q.form.replace(re, '')
    let form = [qstem, q.dict].join('')

    if (q.aug && u.augmods.includes(q.var)) {
        form = form.slice(2)
        // if ([orthos.ac.psili, orthos.ac.dasia].includes(dstem[1])) dstem = dstem.slice(2)
    }

    // log('aug ok, form', form, 'd.plain', d.plain)

    let pform = orthos.plain(form)
    if (d.plain != pform) return

    return true

    // let dstem = d.plain

    // if (q.descr == 'omai-verb') dstem = dstem.replace(/ομαι$/, '')
    // else if (q.descr == 'mi-verb') dstem = dstem.replace(/ωμι$/, '').replace(/ημι$/, '').replace(/υμι$/, '')
    // else dstem = dstem.replace(/ω$/, '')

    // let qform = orthos.plain(q.form)
    // let qterm = orthos.plain(q.term)
    // if (q.aug && u.augmods.includes(q.var)) {
    //     qform = qform.slice(2)
    //     if ([orthos.ac.psili, orthos.ac.dasia].includes(dstem[1])) dstem = dstem.slice(2)
    // }

    // // "λύω"  "λύσω" "ἔλυον" // ἦγον
    // // log('API-BEFORE qform:', qform, 'dst:', dstem, 'qterm:', q.term, 'joined=', [dstem, q.term].join(''))
    // if (qform != [dstem, qterm].join('')) return
    // // log('API', d.plain, d.var, q)
    // return true
}

function compare(form, aug, stem, term, d, q) {
    let qform = orthos.plain(form)
    let qterm = orthos.plain(term)
    let dstem = orthos.plain(stem)
    if (aug) {
        qform = qform.slice(2)
        if ([orthos.ac.psili, orthos.ac.dasia].includes(stem[1])) stem = stem.slice(2)
    }
    log('COMPARE qform:', qform, 'd.stem:', dstem, 'qterm:', qterm, 'joined=', [stem, qterm].join(''))
    if (qform != [dstem, qterm].join('')) return
    log('AFTER d', d, 'q', q)
    return true
}




function filterSimple(d, q) {
    log('SIMPLE OK')
    if (d.var != 'act.pres.ind') return
    if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
    if (q.descr != d.descr) return // for contracted verbs

    // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
    // но пока я его не строю, пропускаю все modCorr
    if (!d.form) d.form = d.dict // это убрать, пока нет form для api

    let re = new RegExp(q.dict + '$')
    let dstem = d.form.replace(re, '')
    if (dstem == d.form) return

    return compare(q.form, q.aug, dstem, q.term, d, q)
}

function queryDicts(keys) {
    return new Promise(function(resolve, reject) {
        db.query('greek/byDict', {
            keys: keys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no dict result')
            log('DICT-ROWS', res.rows)
            let dicts = _.select(res.rows, function(row) { return row.value == 'dict' })
            let plains = _.select(res.rows, function(row) { return row.value == 'plain' })
            dicts = dicts.map(function(row) { return row.doc})
            plains = plains.map(function(row) { return row.doc})
            let result = {dicts: dicts, plains: plains}
            log('D-RESULT', result)
            resolve(result)
            // let rdocs = res.rows.map(function(row) {return row.doc })
            // log('RDICTS RES', rdocs)
            // resolve(rdocs)
        }).catch(function (err) {
            log('Q DICTS REJECT', err)
            reject(err)
        })
    })
}

// ищу irregulars, prons и indecls - к terms нужно дополнительно получить разъяснение - dict потом, в queryDict
//
function queryTerms(words) {
    let keys = words.map(function(word) { return word.form})
    let ukeys = _.uniq(keys)
    log('==UKEYS==', ukeys.toString())
    return new Promise(function(resolve, reject) {
        db.query('greek/byTerm', {
            keys: ukeys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no term result')
            log('TERM-ROWS', res.rows)
            let terms = _.select(res.rows, function(row) { return row.value == 'term' })
            let indecls = _.select(res.rows, function(row) { return row.value == 'indecl' })
            terms = terms.map(function(row) { return row.doc})
            indecls = indecls.map(function(row) { return row.doc})
            let result = {terms: terms, indecls: indecls}
            log('T-RESULT', result)
            resolve(result)

            // let docs = res.rows.map(function(row) { return row.doc})
            // log('TDOCS', docs)
            // words.forEach(function(word, idx) {
            //     // и после этого я не могу этот word исследовать на possible
            //     let indecls = _.select(docs, function(doc) { return doc.dict == word.form || doc.form == word.form})
            //     if (!indecls.length) return
            //     let indecl = indecls[0] // always only one, its are groupped
            //     word.dicts = indecls
            //     word.indecl = true
            //     word.pos = indecl.pos
            // })
            // // log('TERM CLAUSE', words)
            // resolve(words)
        }).catch(function (err) {
            log('queryTERMS ERRS', err);
            reject(err);
        })
    })
}

function getAllFlex() {
    return new Promise(function(resolve, reject) {
        db_flex.allDocs({
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no result')
            let flexes = res.rows.map(function(row) {return row.doc })
            resolve(flexes)
        }).catch(function (err) {
            log('ERR ALL FLEX', err)
            reject(err)
        });
    });
}


function log() { }
function p() { }

if (forTest == '--no-sandbox') {
    function log() { console.log.apply(console, arguments); }
    function p() { console.log(util.inspect(arguments, false, null)) }
}
