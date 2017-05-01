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

// destroyDB(db_flex)
// destroyDB(db)
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
        main(res[0], res[1], function(clause) {
            cb(clause)
        });
    }).catch(function (err) {
        log('ANTRAX ERR', err);
    })
}

// ======================================================================
//  καὶ ὃς ἐὰν δέξηται παιδίον. τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
// τοιαύτη, τοιοῦτο, τοιοῦτον ;;; ὀνόματι
function main(words, fls, cb) {
    let indecls = _.select(words, function(row) { return row.indecl })
    log('INDECLS', indecls)
    let empties = _.select(words, function(row) { return !row.indecl })
    log('Empties', empties);
    let possibleFlex = parsePossibleForms(empties, fls);
    log('Poss-Form-queries', possibleFlex.length, possibleFlex[0]);

    // dicts for terms: (other indecl already are dicts)
    let termdicts = []
    indecls.forEach(function(word) {
        let terms = _.select(word.dicts, function(d) { return d.term })
        let wdicts = _.map(terms, function(d) { return d.dict })
        termdicts = termdicts.concat(wdicts)
    })
    log('IN-DICTS for terms:', termdicts)

    let queries = _.uniq(possibleFlex.map(function(q) { return q.query }))
    let plains = _.uniq(queries.map(function(key) { return orthos.plain(key)}))
    let allqs = plains.concat(termdicts)
    log('MAIN KEY-ALL', allqs)

    queryDicts(allqs).then(function(dicts) {
        dict4word(words, possibleFlex, dicts);
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
                        if (_.keys(u.augs).includes(aug)) sform.aug = aug
                    }
                    forms.push(sform)

                    // API: создание дополнительных api-форм для поиска по api-stem
                    if (u.augmods.includes(morph.var)) {
                        let aug = stem.slice(0,2)
                        // εἴχετε - ἔχω - не работает, надо подумать FIXME: // ἀγορᾷ
                        if (_.keys(u.augs).includes(aug)) {
                            let aquery = [stem.slice(2), 'ω'].join('')
                            aquery = [u.augs[aug], aquery].join('')
                            let form = {idx: row.idx, pos: morph.pos, query: aquery, form: row.form, numper: morph.numper, var: morph.var, descr: morph.descr, aug: aug, stem: stem, term: term, dict: morph.dict, api: true}
                            forms.push(form)
                        }
                    } else if (modCorr['act.fut.ind'].includes(morph.var)) {
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

function selectVerb(word, verbs, qverbs) {
    verbs.forEach(function(d) {
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}, weight: d.weight}

        qverbs.forEach(function(q) {
            // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
            // но пока я его не строю, пропускаю все modCorr
            // ================== FILTER ==================
            let filter
            if (d.var == 'act.pres.ind') {
                if (q.api) filter = filterApi(d, q) // искусственные формы, pres тут нет
                else if (q.woapi) filter = filterSimple(d, q) // полный презенс, независимо от наличия полных форм
                else return
                // else throw new Error('NO API FILTER')
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

//  καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
function dict4word(words, queries, dicts) {
    let terms = _.select(dicts, function(d) { return d.term})
    let mutables = _.select(dicts, function(d) { return !d.term})
    log('4w-Muts', mutables)

    let names = _.select(mutables, function(d) { return d.pos == 'name'} )
    let verbs = _.select(mutables, function(d) { return d.pos == 'verb'} )
    // let infs = _.select(mutables, function(d) { return d.pos == 'inf'} )
    // let parts = _.select(mutables, function(d) { return d.pos == 'part'} )

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
    })
    return

    let qqnames = [], qverbs = [], qinfs = [], qparts = []
    queries.forEach(function(q) {
        if (q.pos == 'name') qqnames.push(q)
        else if (q.pos == 'part') qparts.push(q)
        else if (q.pos == 'verb') qverbs.push(q)
        else if (q.pos == 'inf') qinfs.push(q)
    })

    // if (names.length) log('4w-QNames', names)
    // names.forEach(function(d) {
    //     let nquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: [], weight: d.weight }
    //     let qnstricts = _.select(qqnames, function(q) { return q.query == d.dict })
    //     let qnames = (qnstricts.length) ? qnstricts : _.select(qqnames, function(q) { return orthos.plain(q.query) == d.plain})
    //     log('4w-QNs', qnames)
    //     let qnidx = _.groupBy(qnames, 'idx')
    //     for (let idx in qnidx) {
    //         let qns = qnidx[idx]
    //         qns.forEach(function(q) {
    //             // TODO: здесь можно убрать дубликаты morph, но сложно проверять наличие объекта в morphs
    //             if (!d.var) return
    //             let qvar2 = q.var.split(/ |, /)
    //             qvar2.forEach(function(qvar) {
    //                 if (d.var != qvar) return
    //                 let morph = {gend: q.gend, numcase: q.numcase, flex: q.flex} // , flex: q.flex
    //                 if (d.gend && !q.add) {
    //                     // log('DGEND', d.gend, 'QGEND', q)
    //                     morph.gend = d.gend
    //                     nquery.morphs.push(morph)
    //                 }
    //                 else if (!d.gend){
    //                 // FIXME: здесь в fem, в ous, как всегда, pl.acc-sg.gen - убрать лишнее при ier
    //                     // двух окончаний - fem не проходит:
    //                     if (d.adj == 2 && q.gend == 'fem') return
    //                     nquery.morphs.push(morph)
    //                     if (d.term == 2 && q.gend == 'masc') {
    //                         let femorph = {gend: 'fem', numcase: q.numcase}
    //                         nquery.morphs.push(femorph)
    //                     }
    //                 }
    //             })
    //             nquery.idx = q.idx
    //             nquery.form = q.form // q.form == bare.word
    //         })
    //         if (nquery.morphs.length) {
    //             log('4w-nquery', nquery)
    //             words[nquery.idx].dicts.push(nquery)
    //         }
    //     } // end for qnidx
    // })

    // VERBS
    log('4w-Dverbs', verbs)
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
        if (pquery.morphs.length) {
            log('4w-pquery', pquery)
            words[pquery.idx].dicts.push(pquery)
        }

        qinfs.forEach(function(q) {
            let qform = orthos.plain(q.form)
            let qterm = orthos.plain(q.term)
            // inf - stem всегда api - ?
            let qdict = (q.api && d.var == 'act.pres.ind') ? q.api : q.dict
            qdict = orthos.plain(qdict)
            let re = new RegExp(qdict + '$')
            let stem = d.plain.replace(re, '')

            if (qform != [stem, qterm].join('')) return
            // пока нет perfect:
            if (/pf/.test(q.var)) return
            // log('INF AFTER FILTER')
            iquery = {idx: q.idx, form: q.form, type: d.type, dict: d.dict, pos: 'inf', trn: d.trn, var: q.var } // всегда один результат
        })
        if (iquery) {
            words[iquery.idx].dicts.push(iquery)
        }

        qverbs.forEach(function(q) {
            // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
            // но пока я его не строю, пропускаю все modCorr
            // ================== FILTER ==================
            let filter
            if (d.var == 'act.pres.ind') {
                if (q.api) filter = filterApi(d, q) // искусственные формы, pres тут нет
                else if (q.woapi) filter = filterSimple(d, q) // полный презенс, независимо от наличия полных форм
                else return
                // else throw new Error('NO API FILTER')
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
        if (_.keys(vquery.morphs).length) {
            words[vquery.idx].dicts.push(vquery)
        }
    })
}

function compare(form, aug, stem, term, d, q) {
    let qform = orthos.plain(form)
    let qterm = orthos.plain(term)
    let dstem = orthos.plain(stem)
    if (aug) {
        qform = qform.slice(2)
        if ([orthos.ac.psili, orthos.ac.dasia].includes(stem[1])) stem = stem.slice(2)
    }
    // log('COMPARE qform:', qform, 'd.stem:', dstem, 'qterm:', qterm, 'joined=', [stem, qterm].join(''))
    if (qform != [dstem, qterm].join('')) return
    // log('AFTER', d.var, q)
    return true
}

function filterSimple(d, q) {
  // log('SIMPLE OK')
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



// vforms -  full verb-form: fut, aor, etc
function filterNapi(d, q) {
    // log('filter NAPI', d.var, q.var)
    // if (q.descr != d.descr) return // for contracted verbs
    if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
    let re = new RegExp(q.dict + '$')
    let dstem = d.form.replace(re, '')
    if (dstem == d.form) return

    return compare(q.form, null, dstem, q.term, d, q)
}


function filterApi(d, q) {
    // nonuniq - те api, которые имеют full-варианты; иначе λύσω - по два dict
    log('filter API')
    if (q.descr != d.descr) return
    if (q.woapi && !u.pres.includes(q.var)) return // пропускаются только те q, которые м.б. постоены из d.api
    if (q.api) {
        if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
        // но! здесь соответствие плохо в ἔπαυσα - нужно найти aor по api стему
        // ἐπίστευσα - ἐπίστευον - нужно различить, нельзя взять api-стем для поиска aor, возьмет stem из api, и найдет impf
        // противоречие
    }

    let dstem = d.plain

    if (q.descr == 'omai-verb') dstem = dstem.replace(/ομαι$/, '')
    else if (q.descr == 'mi-verb') dstem = dstem.replace(/ωμι$/, '').replace(/ημι$/, '').replace(/υμι$/, '')
    else dstem = dstem.replace(/ω$/, '')

    let qform = orthos.plain(q.form)
    let qterm = orthos.plain(q.term)
    if (q.aug && u.augmods.includes(q.var)) {
        qform = qform.slice(2)
        if ([orthos.ac.psili, orthos.ac.dasia].includes(dstem[1])) dstem = dstem.slice(2)
    }

    // "λύω"  "λύσω" "ἔλυον" // ἦγον
    // log('API-BEFORE qform:', qform, 'dst:', dstem, 'qterm:', q.term, 'joined=', [dstem, q.term].join(''))
    if (qform != [dstem, qterm].join('')) return
    // log('API', d.plain, d.var, q)
    return true
}

function queryDicts(keys) {
    return new Promise(function(resolve, reject) {
        db.query('greek/byDict', {
            keys: keys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no dict result')
            let rdocs = res.rows.map(function(row) {return row.doc })
            log('RDICTS RES', rdocs.length)
            resolve(rdocs)
        }).catch(function (err) {
            log('Q DICTS REJECT', err)
            reject(err)
        })
    })
}

// ἄλλος εἶναι comb: εἶναι
function queryTerms(words) {
    let keys = words.map(function(word) { return word.form})
    let ukeys = _.uniq(keys)
    log('==UKEYS==', ukeys.toString())
    return new Promise(function(resolve, reject) {
        db.query('greek/byTerm', {
            keys: ukeys,
            include_docs: true
        }).then(function (res) {
            log('RES-TERMS', res.length)
            if (!res || !res.rows) throw new Error('no term result')
            let docs = res.rows.map(function(row) { return row.doc})
            log('TDOCS', docs)
            words.forEach(function(word, idx) {
                // let indecls = _.select(allterms, function(term) { return term.form == word.form})
                // term.dict - из словарей, не имеют .form;
                let indecls = _.select(docs, function(term) { return term.dict == word.form || term.form == word.form})
                if (!indecls.length) return
                let indecl = indecls[0] // always only one, its are groupped
                word.dicts = indecls
                word.indecl = true
                word.pos = indecl.pos
            })
            // log('TERM CLAUSE', words)
            resolve(words)
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
