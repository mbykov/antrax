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
console.log('FOR TEST', forTest, forTest == '--no-sandbox')

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

// clause {idx, form, plain, clean, idx, dicts, possible -либо- indecl}
function parseClause(str, num) {
    let words = []
    let keys = str.split(' ')
    let current = str.split(' ')[num];
    if (!current) current = 0
    let plain, form, accents
    keys.forEach(function(key, idx) {
        form = orthos.toComb(key)
        // form = form.replace('ττ', 'σσ') // TALASSA
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
//  καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT
// τοιαύτη, τοιοῦτο, τοιοῦτον ;;; ὀνόματι
function main(words, fls, cb) {
    // log('=============')
    let indecls = _.select(words, function(row) { return row.indecl })
    log('INDECLS', indecls)
    let empties = _.select(words, function(row) { return !row.indecl })
    log('Empties', empties);
    // хорошо бы possFlex сразу раскладывать по words, кстати
    let possibleFlex = parsePossibleForms(empties, fls);
    log('Poss-Form-queries', possibleFlex.length, possibleFlex[0]);

    // let terms = _.select(rows, function(row) { return row.type == 'term' })
    // let ffs = _.select(rows, function(row) { return row.type == 'form' }) // FFS
    // log('main TERMS', terms)
    // log('main FFS', ffs)
    let tqueries = []
    indecls.forEach(function(ind) {
        let dd = ind.dicts.map(function(d) { return d.dict})
        if (!dd.length) return // articles does not have dict
        tqueries = tqueries.concat(dd)
    })
    // allkeys - для term, включая indecl, полная форма, для possible - plain
    // решил, что пока не нужно - иначе выбирать из результата по gnd
    // но как же так, если косвенная форма, то значение из большого словаря не будет обнаружено.
    let queries = _.uniq(possibleFlex.map(function(q) { return q.query }))
    // log('qqueries', qqueries)
    // let squeries = _.uniq(possibleFlex.map(function(q) { return q.squery }))
    // squeries = _.compact(squeries) // names have no squery
    // log('squeries', squeries)
    // let allqs = qqueries.concat(squeries)
    // log('aqueries', allqs)
    let plains = _.uniq(queries.map(function(key) { return orthos.plain(key)}))
    // let allkeys = tqueries.concat(plains)
    // log('MAIN KEY-PLAINS', tqueries, qqueries, plains, allkeys)
    log('MAIN KEY-PLAINS', plains)

    queryDicts(plains).then(function(dicts) {
        // log('DICTS:::', dicts);
        dict4word(words, possibleFlex, dicts);
        // expliciteMorphs(words)
        // log('addedForms:::', addedForms);
        // <<<<<<<<<<<<<<<<<<<<<<<< HERE, вместе два словаря, и добавть utexas - indecls
        // и вывести наружу
        cb(words)
    }).catch(function (err) {
        log('ERR DICTS', err);
    });
}

// =================================================
// καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT


function parsePossibleForms(empties, fls) {
    let forms = [];
    // let vforms = [];
    empties.forEach(function(row, idx) {
        fls.forEach(function(flex, idy) {
            if (flex._id != row.form.slice(-flex._id.length)) return;
            let term = flex._id
            // let stem = row.form.slice(0, -flex._id.length);
            flex.morphs.forEach(function(morph) {
                if (morph.pos == 'verb') {
                    let stem = row.form.slice(0, -flex._id.length);
                    let query = [stem, morph.dict].join('');
                    // log('m:====>>> stem', stem, 'morph', morph)
                    // тут только full-формы, включая act.pres.ind:
                    let sform = {idx: row.idx, pos: morph.pos, query: query, form: row.form, stem: stem, dict: morph.dict, term: term, numper: morph.numper, var: morph.var, descr: morph.descr, woapi: true, flex: flex} // , morph: morph
                    // log('SFORM==>', sform)
                    forms.push(sform)

                    // создание дополнительных api-форм:
                    if (u.augmods.includes(morph.var)) {
                        let aug = stem.slice(0,2)
                        // log('================== AUG', aug)
                        if (_.keys(u.augs).includes(aug)) {
                            let aquery = [stem.slice(2), 'ω'].join('')
                            aquery = [u.augs[aug], aquery].join('')
                            // log('================== AQUERY', aquery)
                            let form = {idx: row.idx, pos: morph.pos, query: aquery, form: row.form, numper: morph.numper, var: morph.var, descr: morph.descr, aug: aug, stem: stem, term: term, api: true}
                            forms.push(form)
                        }
                    } else if (modCorr['act.fut.ind'].includes(morph.var)) {
                        let aquery = [stem, 'ω'].join('')
                        let form = {idx: row.idx, pos: morph.pos, query: aquery, form: row.form, numper: morph.numper, var: morph.var, descr: morph.descr, stem: stem, term: term, api: true}
                        forms.push(form)
                    }

                } else {
                    let stem = row.form.slice(0, -flex._id.length);
                    let query = [stem, morph.dict].join('');
                    // log('====>>> stem', stem, 'morph', morph)
                    let last = stem.slice(-1)
                    // в morph-part нет var!
                    // log('pFLEX', 'last', last, 'MVAR', morph.var, '_ID', flex._id, 'POS', morph.pos)
                    if (!['ε', 'ι', 'ρ']. includes(last) && ['sg.gen', 'sg.dat']. includes(morph.numcase) && ['ας']. includes(flex._id)) return
                    let form = {idx: row.idx, pos: morph.pos, query: query, stem: stem, form: row.form, gend: morph.gend, numcase: morph.numcase, var: morph.var, add: morph.add } // , flex: flex - убрать
                    forms.push(form)
                }
            })
        })
    })
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
    // let addedForms = [];
    let qqnames = []
    let qverbs = []
    let qparts = []
    queries.forEach(function(q) {
        if (q.pos == 'name') qqnames.push(q)
        else if (q.pos == 'part') qparts.push(q)
        else if (q.pos == 'verb') qverbs.push(q)
    })

    log('4w-Qdicts', dicts.verbs)
    log('4w-QVqs', qverbs)
    // λῡόντων <<<< ================================= либо part либо verb, нужно оба
    dicts.names.forEach(function(d) {
        let nquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: []}
        let qnstricts = _.select(qqnames, function(q) { return q.query == d.dict })
        let qnames = (qnstricts.length) ? qnstricts : _.select(qqnames, function(q) { return orthos.plain(q.query) == d.plain})
    })
    dicts.verbs.forEach(function(d) {
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}}
        qverbs.forEach(function(q) {
            if (!filterDescr(d, q)) return

            // log('============================== API ?', d.pos, d.var == 'act.pres.ind')
            let filter = (d.var == 'act.pres.ind') ? filterAPI(d, q) : filterWOapi(d, q)
            // let filter = filterAPI(d, q)
            if (!filter) return

            let morph = {var: q.var, numper: q.numper}
            if (!vquery.morphs[q.var]) vquery.morphs[q.var] = [q.numper]
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

// additional full verb-form: fut, aor, etc
function filterWOapi(d, q) {
    // log('filterWO', q)
    if (q.api) return // - тут дополнительных не нужно

    // log('filterWO 1')
    if (!modCorr[d.var].includes(q.var)) return
    // log('modCorr ok', q.query, '=', d.plain)
    // log('filterWO 2')

    if (orthos.plain(q.query) != d.plain) return
    // log('plain ok, q.var:', q.var)


    let dstem
    if (modCorr['act.pres.ind'].includes(q.var)) dstem = d.plain.replace(/ω$/, '')
    if (modCorr['act.fut.ind'].includes(q.var)) dstem = d.plain.replace(/σω$/, '')
    else if (modCorr['act.aor.ind'].includes(q.var)) dstem = d.plain.replace(/σα$/, '')
    // dstem = orthos.plain(d.dict).replace(/νω$/, '') // -nw - для liquid-n
    // log('Q-form', q.form, 'dstem', dstem, 'qt', q.term, 'qvar', q.var)

    let qform = orthos.plain(q.form)
    let qterm = orthos.plain(q.term)
    // если aug, то отбросить, ибо в словаре и в форме ... нет, тут не нужно отбрасывать?????  <<=====
    // а нельзя-ли тут всегда slice(2) сделать?
    if (q.aug && u.augmods.includes(q.var)) { // no-aug = q.woapi
        let qaug = orthos.plain(q.aug)
        let reaug = new RegExp('^' + qaug)
        qform = qform.replace(reaug, '')
        if (qaug) log('q - AUG', qaug, qform)
        // } else if (u.augmods.includes(q.var)) { // q.api &&  для api - imperfect, etc
        // qform = qform.slice(2)
    }

    // "λύω"  "λύσω" "ἔλυον"
    log('NAPI-BEFORE-MAIN qform:', qform, 'dst:', dstem, 'qterm:', qterm, 'joined=', [dstem, qterm].join(''))
    if (qform != [dstem, qterm].join('')) return
    log('NAPI', d.plain, d.var, q)

    return true
}

// q - д.б. либо наст.вр, либо любой с пометкой .api
//
function filterAPI(d, q) {
    log('filter API')
    if (q.woapi && !u.pres.includes(q.var)) return
    log('WOAPI ok', q.query, '=', d.plain, 'q', q)

    // здесь d.plain = plain(d.dict)

    let dstem = d.plain.replace(/ω$/, '')

    // dstem = orthos.plain(d.dict).replace(/νω$/, '') // -nw - для liquid-n
    log('Q-form', q.form, 'dstem', dstem, 'qt', q.term, 'qvar', q.var)

    let qform = orthos.plain(q.form)
    let qterm = orthos.plain(q.term)
    // if (!q.aug) log('q - NO AUG', q)
    // а нельзя-ли тут всегда slice(2) сделать?
    if (q.aug && u.augmods.includes(q.var)) { // no-aug = q.woapi
        let qaug = orthos.plain(q.aug)
        let reaug = new RegExp('^' + qaug)
        qform = qform.replace(reaug, '')
        if (qaug) log('q - AUG', qaug, qform)
        // } else if (u.augmods.includes(q.var)) { // q.api &&  для api - imperfect, etc
        // qform = qform.slice(2)
    }

    // "λύω"  "λύσω" "ἔλυον"
    log('API-BEFORE-MAIN qform:', qform, 'dst:', dstem, 'qterm:', qterm, 'joined=', [dstem, qterm].join(''))
    if (qform != [dstem, qterm].join('')) return
    log('API', d.plain, d.var, q)
    return true
}

function filterDescr(d, q) {
    if (!d.descr) throw new Error('dict wo descr!')
    if (d.descr != q.descr) log('BADDESCRS', d.descr, 'q', q.descr)
    if (d.descr != q.descr) return false // αἰτέω - проверить
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
            let rdicts = res.rows.map(function(row) {return row.doc })
            // log('Q RDICTS RES', rdicts)
            let groups = _.groupBy(rdicts, function(dict){ return [dict.pos, dict.dtype].join('-') })
            // log('GROUPS', groups)
            let names = [], verbs = [], parts = []
            for (let key in groups) {
                let arr = groups[key]
                // log('ARR', arr)
                if (arr.length > 1) arr = _.select(arr, function(dict) { return !dict.vmorphs})
                names = names.concat(_.select(arr, function(dict) { return dict.pos == 'name' }))
                verbs = verbs.concat(_.select(arr, function(dict) { return dict.pos == 'verb' }))
                parts = parts.concat(_.select(arr, function(dict) { return dict.pos == 'part' }))
            }
            let dicts = {names: names, verbs: verbs, parts: parts}
            log('Q DICTS RES', dicts)
            resolve(dicts)
        }).catch(function (err) {
            log('Q DICTS REJECT', err)
            reject(err)
        })
    })
}

function queryTerms(words) {
    let keys = words.map(function(word) { return word.form})
    let ukeys = _.uniq(keys)
    log('==UKEYS==', ukeys.toString())
    return new Promise(function(resolve, reject) {
        db.query('greek/byTerm', {
            keys: ukeys
            // , include_docs: true
        }).then(function (res) {
            log('RES-TERMS', res)
            if (!res || !res.rows) throw new Error('no term result') //  || res.rows.length == 0
            let allterms = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value);});
            // let clause = {}
            words.forEach(function(word, idx) {
                let onlyterms = _.select(allterms, function(term) { return term.form == word.form})
                let indecls = _.select(onlyterms, function(term) { return term.indecl})
                // compact terms by grouping morphs:
                let terms = _.select(onlyterms, function(term) { return !term.indecl})
                let prons = _.select(terms, function(term) { return term.pos == 'pron'})
                let arts = _.select(terms, function(term) { return term.pos == 'art'})
                let verbs = _.select(terms, function(term) { return term.pos == 'verb'})
                let names = _.select(terms, function(term) { return term.pos == 'name'})

                // word {idx, form, plain, clean, dicts=[], possible -либо- indecl}
                // log('INDS', indecls)
                log('PRONS', prons)
                // log('ARTS', arts)
                // let query = {idx: idx, type: 'term', form: word.form, dict: word.form, term: true}

                if (prons.length) {
                    let qterm = {pos: 'pron', morphs: []}
                    prons.forEach(function(term) {
                        qterm.trn = term.trn
                        qterm.dict = term.dict
                        let morph = {gend: term.gend, numcase: term.numcase}
                        qterm.morphs.push(morph)
                    })
                    log('P W', word)
                    log('P D', qterm)
                    word.dicts.push(qterm)
                }
                if (names.length) {
                    let qterm = {pos: 'name', morphs: []}
                    names.forEach(function(term) {
                        qterm.trn = term.trn
                        qterm.dict = term.dict
                        let morph = {gend: term.gend, numcase: term.numcase}
                        qterm.morphs.push(morph)
                    })
                    word.dicts.push(qterm)
                }
                if (arts.length) {
                    let qterm = {pos: 'art', morphs: []}
                    arts.forEach(function(term) {
                        qterm.trn = term.trn
                        qterm.dict = term.dict
                        let morph = {gend: term.gend, numcase: term.numcase}
                        qterm.morphs.push(morph)
                    })
                    word.dicts.push(qterm)
                }
                if (verbs.length) {
                    let qterm = {pos: 'verb', morphs: {} }
                    verbs.forEach(function(term) {
                        qterm.trn = term.trn
                        qterm.dict = term.dict
                        // FIXME: WTF gend?:
                        let morph = {gend: term.gend, numcase: term.numcase}
                        if (!qterm.morphs[term.mod]) qterm.morphs[term.mod] = [term.numper]
                        else qterm.morphs[term.mod].push(term.numper)
                    })
                    word.dicts.push(qterm)
                }
                if (terms.length || indecls.length) word.indecl = true
                if (indecls.length) word.dicts = word.dicts.concat(indecls)
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
