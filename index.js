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
// clause {idx, form, plain, clean, idx, dicts, pssible -либо- indecl}
function parseClause(str, num) {
    let words = []
    let keys = str.split(' ')
    let current = str.split(' ')[num];
    if (!current) current = 0
    let plain, form, accents
    keys.forEach(function(key, idx) {
        if (idx == 0) form = orthos.dc(key)
        else form = key
        form = form.replace(/[\u002E\u002C\u0021\u003B\u00B7\u0020\u0027]/, '') // или нужен punct?
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
    // log('ANTRAX-START')
    // replicateDB('gr-flex')
    // replicateDB('greek')
    let words = parseClause(str, num)
    queryPromise(words, function(res) {
        // log('ANTRAX RES', res)
        cb(res)
    })
}

function queryPromise(words, cb) {
    // log('ANTRAX QUERY NUM', sentence, current)
    Promise.all([
        queryTerms(words),
        getAllFlex()
    ]).then(function (res) {
        // log('main r1 CLAUSE', res[0])
        // if (res[0].length == 1) log('main r1 CLAUSE DICT', res[0][0].dicts)
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
    // log('=============')
    let indecls = _.select(words, function(row) { return row.indecl })
    log('INDECLS', indecls)
    let empties = _.select(words, function(row) { return !row.indecl })
    log('Empties', empties);
    let possibleFlex = parsePossibleForms(empties, fls);
    log('Poss-Form-queries', possibleFlex.length, possibleFlex[0]);

    // let indicts = _.map(indecls, function(pron) { return pron.dicts[0].dict })
    let indicts = []
    indecls.forEach(function(word) {
        // log('-- word', word)
        let terms = _.select(word.dicts, function(d) { return d.term })
        let wdicts = _.map(terms, function(d) { return d.dict })
        indicts = indicts.concat(wdicts)
    })
    log('IN-DICTS', indicts)

    let queries = _.uniq(possibleFlex.map(function(q) { return q.query }))
    let plains = _.uniq(queries.map(function(key) { return orthos.plain(key)}))
    log('MAIN KEY-PLAINS', plains)
    let allqs = plains.concat(indicts)
    log('MAIN KEY-ALL', allqs)

    queryDicts(allqs).then(function(dicts) {
        dict4word(words, possibleFlex, dicts);
        cb(words)
    }).catch(function (err) {
        log('ERR DICTS', err);
    });
}

// =================================================
// καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
// "ἥρπαζον" // ἄλλος


function parsePossibleForms(empties, fls) {
    let forms = [];
    // let vforms = [];
    empties.forEach(function(row, idx) {
        fls.forEach(function(flex, idy) {
            let term = flex._id
            if (flex._id != row.form.slice(-flex._id.length)) return;
            // let stem = row.form.slice(0, -flex._id.length);
            flex.morphs.forEach(function(morph) {
                if (morph.pos == 'verb') {
                    let stem = row.form.slice(0, -flex._id.length);
                    let query = [stem, morph.dict].join('');
                    // log('m:====>>> stem', stem, 'morph', morph)
                    // тут только full-формы, включая act.pres.ind:
                    let sform = {idx: row.idx, pos: morph.pos, query: query, form: row.form, stem: stem, dict: morph.dict, term: term, numper: morph.numper, var: morph.var, descr: morph.descr, woapi: true} // , morph: morph , flex: flex
                    // log('SFORM==>', sform)

                    // проверка q.woapi на augment, добавляет aug, и отбрасывает impf без aug
                    if (u.augmods.includes(morph.var)) {
                        let aug = stem.slice(0,2)
                        if (_.keys(u.augs).includes(aug)) sform.aug = aug
                    }
                    forms.push(sform)
                    // if (term == 'ον' && morph.pos == 'verb') log('SFORM', morph.pos == 'verb', morph)

                    // API: создание дополнительных api-форм для поиска по api-stem
                    if (u.augmods.includes(morph.var)) {
                        let aug = stem.slice(0,2)
                        // εἴχετε - ἔχω - не работает, надо подумать FIXME: // ἀγορᾷ
                        // if (stem.slice(0,4) == 'εἴ') aug = 'εἴ'
                        // log('================== AUG', aug)
                        if (_.keys(u.augs).includes(aug)) {
                            let aquery = [stem.slice(2), 'ω'].join('')
                            aquery = [u.augs[aug], aquery].join('')
                            // log('================== AQUERY', aquery)
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
                    log('morph-inf=============', morph)
                    let stem = row.form.slice(0, -flex._id.length);
                    if (row.form != [stem, term].join('')) return // это откуда может взяться, непонятно?
                    let mdict = (morph.api) ? morph.api : morph.dict
                    let query = [stem, mdict].join('');
                    let form = {idx: row.idx, pos: 'inf', query: query, form: row.form, var: morph.var, descr: morph.descr, stem: stem, dict: morph.dict, term: term, api: morph.api}
                    log('form-inf=============', form)
                    forms.push(form)
                } else {
                    let stem = row.form.slice(0, -flex._id.length);
                    let query = [stem, morph.dict].join('');
                    // log('====>>> stem', stem, 'morph', morph)
                    let last = stem.slice(-1)
                    // в morph-part нет var!
                    // log('pFLEX', 'last', last, 'MVAR', morph.var, '_ID', flex._id, 'POS', morph.pos)
                    if (!['ε', 'ι', 'ρ']. includes(last) && ['sg.gen', 'sg.dat']. includes(morph.numcase) && ['ας']. includes(flex._id)) return
                    let form = {idx: row.idx, pos: morph.pos, query: query, stem: stem, form: row.form, gend: morph.gend, numcase: morph.numcase, var: morph.var, dict: morph.dict, add: morph.add } // , flex: flex - убрать
                    forms.push(form)
                }
            })
        })
    })
    let vvs = _.select(forms, function(f) { return f.pos == 'verb'})
    log('VVS', vvs.length)
    return forms;
}

// gnd - нужен
// FIXME: тут может меняться форма ударения в кос. падежах: πῆχυς-πήχεως
// и м.б. лишние решения. Найти и избавиться
// и то же с родом
// м.б. проверять с ударением, если ноль, еще раз по плоским
// ἰχθύς - ἰχθύος
// σκηνῇ дает три варианта, два лишних
// if (q.var == 'ah') return // это зачем?


//  καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
function dict4word(words, queries, dicts) {
    // let mutables = []
    // let names = [], verbs = [], parts = []
    dicts.forEach(function(d) {
        words.forEach(function(word) {
            // log('W->', word)
            if (word.dicts.length) {
                let wdicts = word.dicts.map(function(d) { return d.dict})
                if (wdicts.includes(d.dict)) {
                    d.weight = 5
                    word.dicts.push(d)
                }
            // } else {
                // mutables.push(d)
            }
        })
    })
    let mutables = _.select(dicts, function(d) { return d.weight != 5})
    log('4w-Muts', mutables)

    let names = _.select(mutables, function(d) { return d.pos == 'name'} )
    let verbs = _.select(mutables, function(d) { return d.pos == 'verb'} )
    let infs = _.select(mutables, function(d) { return d.pos == 'inf'} )
    let parts = _.select(mutables, function(d) { return d.pos == 'part'} )

    // log('4w-ALL QUERIES', queries.length)
    let qqnames = [], qverbs = [], qinfs = [], qparts = []
    queries.forEach(function(q) {
        if (q.pos == 'name') qqnames.push(q)
        else if (q.pos == 'part') qparts.push(q)
        else if (q.pos == 'verb') qverbs.push(q)
        else if (q.pos == 'inf') qinfs.push(q)
    })

    log('4w-QNames', names)
    // log('4w-QInfs', qinfs)
    log('4w-QVerbs', qverbs)
    // λῡόντων <<<< ================================= либо part либо verb, нужно оба
    names.forEach(function(d) {
        let nquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: []}
        let qnstricts = _.select(qqnames, function(q) { return q.query == d.dict })
        let qnames = (qnstricts.length) ? qnstricts : _.select(qqnames, function(q) { return orthos.plain(q.query) == d.plain})
        log('4w-QNs', qnames)
        qnames.forEach(function(q) {
            // if (d.pos != 'name') return
            if (!d.var) {
                log('NNV', d)
                throw new Error('NO NAME VAR')
            }
            // log('DVAR', d.var, 'QVAR', q.var) // 'FLEX', q.flex
            let vr2 = q.var.split(/ |, /)
            vr2.forEach(function(vr) {
                if (d.var != vr) return
                let morph = {gend: q.gend, numcase: q.numcase} // , flex: q.flex - это оставлять нельзя из-за conform - там строки !!!!
                if (d.gend && !q.add) {
                    log('DGEND', d.gend, 'QGEND', q)
                    // if (d.gend && !d.gend.includes(q.gend)) return
                    // if (d.gend != q.gend) return // в dict проверить gend - это всегда д.б. массив
                    morph.gend = d.gend
                    nquery.morphs.push(morph)
                }
                else if (!d.gend){
                    // FIXME: здесь в fem, в ous, как всегда, pl.acc-sg.gen - убрать лишнее при ier
                    // двух окончаний - fem не проходит:
                if (d.term == 2 && q.gend == 'fem') return
                    // term=3 и простой var (ous) == здесь fem, если есть, пролез
                    nquery.morphs.push(morph)
                    if (d.term == 2 && q.gend == 'masc') {
                        let femorph = {gend: 'fem', numcase: q.numcase}
                        nquery.morphs.push(femorph)
                    }
                }
            })
            nquery.idx = q.idx
            nquery.form = q.form // это же просто word??
            // log('NQUERY:', nquery)
        })
        if (nquery.morphs.length) {
            // nquery.trn = d.trn
            log('4w-nquery', nquery)
            words[nquery.idx].dicts.push(nquery)
        }
    })
    // VERBS
    log('4w-Dverbs', verbs)
    verbs.forEach(function(d) {
        let iquery
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}}

        qinfs.forEach(function(q) {
            // if (d.var != 'act.pres.ind') return
            // if (!filterDescr(d, q)) return
            log('==INF', d, q)
            let qform = orthos.plain(q.form)
            let qterm = orthos.plain(q.term)
            // inf - stem всегда api
            // let stem = d.plain.replace(/λω$/, '').replace(/φω$/, '').replace(/ρω$/, '').replace(/νω$/, '').replace(/εω$/, '').replace(/αω$/, '').replace(/οω$/, '').replace(/ω$/, '')
            let qdict = (q.api && d.var == 'act.pres.ind') ? q.api : q.dict
            qdict = orthos.plain(qdict)
            let re = new RegExp(qdict + '$')
            let stem = d.plain.replace(re, '')
            log('== qform', qform, 'stem', stem, 'qterm', qterm)
            if (qform != [stem, qterm].join('')) return
            // пока нет perfect:
            if (/pf/.test(q.var)) return
            log('INF AFTER FILTER')
            iquery = {idx: q.idx, form: q.form, type: d.type, dict: d.dict, pos: 'inf', trn: d.trn, var: q.var } // всегда один результат
        })
        if (iquery) {
            words[iquery.idx].dicts.push(iquery)
        }

        qverbs.forEach(function(q) {
            // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
            // но пока я его не строю, пропускаю все modCorr
            // ================== FILTER ==================
            // log('Q', q)
            let filter
            if (d.var == 'act.pres.ind') {
                if (q.api) filter = filterApi(d, q) // искусственные формы, pres тут нет
                else if (q.woapi) filter = filterSimple(d, q) // полный презенс, независимо от наличия полных форм
                else throw new Error('NO API FILTER')
            }
            else if (q.woapi) filter = filterNapi(d, q) // полные формы, кроме pres
            else {
                // log('NO FILTER MAIN', d.var, q.var)
                // d - не api, а q -api
                // throw new Error('NO API MAIN FILTER')
            }
            if (!filter) return

            // засада с фильтрами, что если два dict - а их будет много! то повторяются morphs - sg.1, sg.1
            // они проходят для каждого dict и накапливаются

            if (!vquery.morphs[q.var]) vquery.morphs[q.var] = [q.numper]
            else if (vquery.morphs[q.var].includes(q.numper)) return // это уберет неоднозначность, и можно отказаться от descr
            else vquery.morphs[q.var].push(q.numper)
            vquery.idx = q.idx
            vquery.form = q.query
            // vquery.descr = q.descr
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
    log('COMPARE qform:', qform, 'd.stem:', dstem, 'qterm:', qterm, 'joined=', [stem, qterm].join(''))
    if (qform != [dstem, qterm].join('')) return
    log('AFTER', d.var, q)
    return true
}

// ἐπάγω θέλω
// "λύω"  "λύσω" "ἔλυον" // ἦγον
function filterSimple(d, q) {
  log('SIMPLE OK')
    if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
    if (q.descr != d.descr) return // for contracted verbs

    // здесь imperfect должен строиться уже из api - ἐπάγω - ἐπῆγον
    // но пока я его не строю, пропускаю все modCorr

    let re = new RegExp(q.dict + '$')
    let dstem = d.form.replace(re, '')
    if (dstem == d.form) return

    return compare(q.form, q.aug, dstem, q.term, d, q)
}



// vforms -  full verb-form: fut, aor, etc
function filterNapi(d, q) {
    log('filter NAPI', d.var, q.var)
    // if (q.descr != d.descr) return // for contracted verbs
    if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
    log('after mod', 'q.dict', q.dict, 'd.form', d.form)
    let re = new RegExp(q.dict + '$')
    let dstem = d.form.replace(re, '')
    if (dstem == d.form) return

    return compare(q.form, null, dstem, q.term, d, q)
}


function filterApi(d, q) {
    // nonuniq - те api, которые имеют full-варианты; иначе λύσω - по два dict
    // if (d.nonuniq && q.var != 'act.pres.ind') return
    log('filter API')
    if (q.descr != d.descr) return
    // return
    // без q.api - только формы наст. вр.:
    if (q.woapi && !u.pres.includes(q.var)) return // пропускаются только те q, которые м.б. постоены из d.api
    // log('q', q)
    if (q.api) {
        if (!modCorr[d.var] || !modCorr[d.var].includes(q.var)) return // иначе возьмет stem из aor, а найдет imperfect - λέγω, ἔλεγον, εἶπον
        // но! здесь соответствие плохо в ἔπαυσα - нужно найти aor по api стему
        // ἐπίστευσα - ἐπίστευον - нужно различить, нельзя взять api-стем для поиска aor, возьмет stem из api, и найдет impf
        // противоречие
    }

    // let dstem = d.plain.replace(/εω$/, '').replace(/αω$/, '').replace(/οω$/, '').replace(/βω$/, '').replace(/πω$/, '').replace(/φω$/, '').replace(/λω$/, '').replace(/ω$/, '').replace(/ομαι$/, '').replace(/ωμι$/, '').replace(/ημι$/, '').replace(/υμι$/, '')
    let dstem = d.plain
    // let pres_mute = 'βω$|πω$|φω$'
    // let impf_mute = 'βον$|πον$|φον$' - это точно не нужно, dict на ω

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
    log('API-BEFORE qform:', qform, 'dst:', dstem, 'qterm:', q.term, 'joined=', [dstem, q.term].join(''))
    if (qform != [dstem, qterm].join('')) return
    log('API', d.plain, d.var, q)
    return true
}

function queryDicts(keys) {
    // log('DICT KEYS', keys)
    return new Promise(function(resolve, reject) {
        db.query('greek/byDict', {
            keys: keys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no dict result')
            let rdocs = res.rows.map(function(row) {return row.doc })
            log('RDICTS RES', rdocs)
            resolve(rdocs)
            // return
            // let terms = _.select(rdocs, function(d) { return d.term })
            // let mutables = _.select(rdocs, function(d) { return !d.term })
            // let groups = _.groupBy(mutables, function(dict){ return [dict.pos, dict.dict, dict.dtype].join('-') })
            // // log('GROUPS', groups)
            // let names = [], verbs = [], parts = []
            // let cnames = [], cverbs = [], cparts = []
            // // группирую, чтобы определить, есть-ли добавочные формы глагола к форме api в результатах
            // // FIXME: ошибка - если неск. verb-групп, то последняя затрет verbs, etc
            // for (let key in groups) {
            //     let arr = groups[key]
            //     // log('ARR', arr)
            //     // похоже, nonuniq и vmorphs - синонимы, группа по d.dict, а dict во всех verb-формах тот же самый? - нет, они разные
            //     cnames = _.select(arr, function(dict) { return dict.pos == 'name' })
            //     cparts = _.select(arr, function(dict) { return dict.pos == 'part' })
            //     cverbs = _.select(arr, function(dict) { return dict.pos == 'verb' })
            //     if (cverbs.length > 1) {
            //         cverbs.forEach(function(verb) {
            //             if (verb.vmorphs) verb.nonuniq = true
            //         })
            //     }
            //     names = names.concat(cnames)
            //     verbs = verbs.concat(cverbs)
            //     parts = parts.concat(cparts)
            // }
            // let dicts = {names: names, verbs: verbs, parts: parts, terms: terms}
            // log('Q DICTS RES', dicts)
            // resolve(dicts)
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
            log('RES-TERMS', res)
            if (!res || !res.rows) throw new Error('no term result') //  || res.rows.length == 0
            let allterms = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value) })
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
            log('TERM CLAUSE', words)
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
            // keys: tails
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no result')
            // let flexes = res.rows.map(function(row) {return Object.assign({}, {flex: row.key}, row.value) })
            let flexes = res.rows.map(function(row) {return row.doc })
            // log('FLEXES', flexes.length)
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
// else {
//     function log() { }
//     function p() { }
// }
