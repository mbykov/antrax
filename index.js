/* query greek
*/

'use strict'

const _ = require('underscore');
const fs = require('fs');
const util = require('util');
const path = require('path');
const orthos = require('orthos');
const u = require('./lib/utils');
const modCorr = u.modCorr

// db_flex = new PouchDB('http:\/\/localhost:5984/gr-flex');
// db = new PouchDB('http:\/\/localhost:5984/greek');

let db_path = path.join(__dirname, '../antrax/pouchdb/greek')
let db_flex_path = path.join(__dirname, '../antrax/pouchdb/flex')

const PouchDB = require('pouchdb-node')
const db = new PouchDB(db_path) // , {adapter : 'leveldb'}
const db_flex = new PouchDB(db_flex_path)

module.exports = antrax()

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

function main(words, tires, fls, cb) {
    log('W', words, tires, fls.length)
    words.forEach(function(word, idx) {
        let word_indecls = _.select(tires.indecls, function(doc) { return doc.dict == word.form })
        let word_terms = _.select(tires.terms, function(doc) { return doc.form == word.form })
        if (word_indecls.length) word.dicts = word_indecls, word.indecl = true
        if (word_terms.length) word.dicts = word_terms, word.term = true
    })

    let terms = _.select(words, function(row) { return row.term })
    let empties = _.select(words, function(row) { return !row.indecl })
    let possibleFlex = parsePossibleForms(empties, fls);
    // log('Poss-Form-queries', possibleFlex.length, possibleFlex[0]);

    // dicts for terms: (other indecl already are dicts)
    let termdicts = _.uniq(_.map(tires.terms, function(doc) { return doc.dict }))

    let queries = _.uniq(possibleFlex.map(function(q) { return q.query }))
    let plains = _.uniq(queries.map(function(key) { return orthos.plain(key)}))
    let allqs = _.uniq(plains.concat(termdicts))
    log('all q keys', allqs)

    queryDicts(allqs).then(function(dpres) {
        words.forEach(function(word) {
            if (!word.term) return
            termdicts.forEach(function(tdict, idy) {
                let thisdicts = _.select(word.dicts, function(d) { return d.dict == tdict})
                if (!thisdicts.length) return
                let expos = _.select(dpres.dicts, function(d) { return d.dict == tdict })
                if (expos.length) word.dicts = word.dicts.concat(expos)
            })
        })

        dict4word(words, possibleFlex, dpres.plains);
        cb(words)
    }).catch(function (err) {
        // log('ERR DICTS', err);
    });
}

function parsePossibleForms(empties, fls) {
    let forms = [];
    empties.forEach(function(row) {
        fls.forEach(function(flex) {
            let term = flex._id
            if (flex._id != row.form.slice(-flex._id.length)) return;
            flex.morphs.forEach(function(morph) {
                if (morph.pos == 'verb') {
                    let stem = row.form.slice(0, -flex._id.length);
                    stem = orthos.plain(stem)

                    let aug
                    if (u.augmods.includes(morph.var)) {
                        aug = stem.slice(0,2)
                        if (_.keys(u.augs).includes(aug)) {
                            stem = stem.slice(2)
                        }
                    }

                    let dquery = [stem, morph.dict].join('');
                    let wquery = [stem, 'ω'].join('')

                    let dform = {idx: row.idx, pos: morph.pos, query: dquery, form: row.form, stem: stem, dict: morph.dict, term: term, numper: morph.numper, var: morph.var, descr: morph.descr, napi: true} // , morph: morph , flex: flex
                    let wform = {idx: row.idx, pos: morph.pos, query: wquery, form: row.form, stem: stem, dict: morph.dict, term: term, numper: morph.numper, var: morph.var, descr: morph.descr, api: true}

                    if (aug) dform.aug = aug, wform.aug = aug
                    if (morph.second) wform.second = true

                    forms.push(dform)
                    forms.push(wform)

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
                    let form = {idx: row.idx, pos: morph.pos, query: query, stem: stem, form: row.form, gend: morph.gend, numcase: morph.numcase, var: morph.var, dict: morph.dict, add: morph.add, term: term} // , flex: flex
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

        qnames.forEach(function(q) {
            // TODO: здесь можно убрать дубликаты morph, но сложно проверять наличие объекта в morphs
            if (!d.var) return
            let qvar2 = q.var.split(/ |, /)
            qvar2.forEach(function(qvar) {
                if (d.var != qvar) return
                let morph = {gend: q.gend, numcase: q.numcase, flex: q.flex} // , flex: q.flex
                if (d.gend && !q.add) {
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

        qparts.forEach(function(q) {
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
        })
        if (!pquery.morphs.length) return
        word.dicts.push(pquery)
    })
}

function selectInf(word, verbs, qinfs) {
    verbs.forEach(function(d) {
        let dtense = d.var.replace('.ind', '').replace('act.', '').replace('pass.', '').replace('mid.', '').replace('mp.', '')
        let iquery
        qinfs.forEach(function(q) {

            let qtense = q.var.replace('.inf', '').replace('act.', '').replace('pass.', '').replace('mid.', '').replace('mp.', '')
            if (dtense != qtense) return

            let qform = orthos.plain(q.form)
            let qterm = orthos.plain(q.term)

            let qdict = (q.api && d.var == 'act.pres.ind') ? q.api : q.dict
            qdict = orthos.plain(qdict)
            let re = new RegExp(qdict + '$')
            let stem = d.plain.replace(re, '')

            if (qform != [stem, qterm].join('')) return
            // still no perfect:
            if (/pf/.test(q.var)) return

            iquery = {idx: q.idx, form: q.form, type: d.type, dict: d.dict, pos: 'inf', trn: d.trn, var: q.var } // всегда один результат
        })
        if (!iquery) return
        word.dicts.push(iquery)
    })
}

function dict4word(words, queries, dicts) {
    let mutables = _.select(dicts, function(d) { return !d.term})

    let names = _.select(mutables, function(d) { return d.pos == 'name'} )
    let verbs = _.select(mutables, function(d) { return d.pos == 'verb'} )

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
        if (names.length && qqnames.length) selectNames(word, names, qqnames)
        if (verbs.length && qverbs.length) selectVerb(word, verbs, qverbs)
        if (verbs.length && qparts.length) selectPart(word, verbs, qparts)
        if (verbs.length && qinfs.length) selectInf(word, verbs, qinfs)
    })
}

function selectVerb(word, verbs, qverbs) {
    let napis = _.select(verbs, function(verb) {return verb.var != 'act.pres.ind'})
    if (napis.length) verbs = napis

    verbs.forEach(function(d) {
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}, weight: d.weight}

        qverbs.forEach(function(q) {
            // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
            // но пока я его не строю, пропускаю все modCorr
            // ================== FILTER ==================
            if (q.descr != d.descr) return
            let filter
            if (d.var == 'act.pres.ind') {
                if (q.api) filter = filterApi(d, q)
                // else if (q.napi) filter = filterSimple(d, q)
            }
            else if (q.napi) filter = filterNapi(d, q) // полные формы, кроме pres
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
    log('W=', word)

}

// vforms -  full verb-form: fut, aor, etc
function filterNapi(d, q) {
    if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον

    let re = new RegExp(q.term + '$')
    let qstem = q.form.replace(re, '')
    let form = [qstem, q.dict].join('')

    let pform = orthos.plain(form)
    if (q.aug && u.augmods.includes(q.var)) {
        pform = pform.slice(2)
    }
    if (d.plain != pform) return

    return true
}

function filterApi(d, q) {
    if (q.second) return

    let re = new RegExp(q.term + '$')
    let qstem = q.form.replace(re, '')
    if (q.form == qstem) return
    // let form = [qstem, q.dict].join('')
    let form = [qstem, 'ω'].join('')

    let pform = orthos.plain(form)
    if (q.aug && u.augmods.includes(q.var)) {
        pform = pform.slice(2)
    }

    if (d.plain != pform) return
    return true
}

function queryDicts(keys) {
    return new Promise(function(resolve, reject) {
        db.query('greek/byDict', {
            keys: keys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no dict result')
            let dicts = _.select(res.rows, function(row) { return row.value == 'dict' })
            let plains = _.select(res.rows, function(row) { return row.value == 'plain' })
            dicts = dicts.map(function(row) { return row.doc})
            plains = plains.map(function(row) { return row.doc})
            let result = {dicts: dicts, plains: plains}
            resolve(result)
        }).catch(function (err) {
            // log('Q DICTS REJECT', err)
            reject(err)
        })
    })
}

// ищу irregulars, prons и indecls - к terms нужно дополнительно получить разъяснение - dict потом, в queryDict
//
function queryTerms(words) {
    let keys = words.map(function(word) { return word.form})
    let ukeys = _.uniq(keys)
    // log('==UKEYS==', ukeys.toString())
    return new Promise(function(resolve, reject) {
        db.query('greek/byTerm', {
            keys: ukeys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no term result')
            let terms = _.select(res.rows, function(row) { return row.value == 'term' })
            let indecls = _.select(res.rows, function(row) { return row.value == 'indecl' })
            terms = terms.map(function(row) { return row.doc})
            indecls = indecls.map(function(row) { return row.doc})
            let result = {terms: terms, indecls: indecls}
            resolve(result)
        }).catch(function (err) {
            // log('queryTERMS ERRS', err);
            reject(err);
        })
    })
}

function getAllFlex() {
    return new Promise(function(resolve, reject) {
        db_flex.query('flex/byFlex', { // BUG in pouch, pouchdb-node: allDocs returns only 15 rows
        // db_flex.allDocs({
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no result')
            let flexes = res.rows.map(function(row) {return row.doc })
            resolve(flexes)
        }).catch(function (err) {
            // log('ERR ALL FLEX', err)
            reject(err)
        });
    });
}


// function log() { }
// function p() { }

function log() { console.log.apply(console, arguments); }
function p() { console.log(util.inspect(arguments, false, null)) }
