// antrax - query simple greek

/*
*/


let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let path = require('path');
let orthos = require('../orthos');

let PouchDB = require('pouchdb-browser');
let db_term = new PouchDB('gr-terms')
let db_flex = new PouchDB('flex')
let db_dict = new PouchDB('gr-dicts')

// replicateDB('flex')
// replicateDB('gr-terms')
// replicateDB('gr-dicts')

// destroyDB(db_term)
// destroyDB(db_dict)
// return

function destroyDB(db) {
    db.destroy().then(function (response) {
        log('DB DESTROYED', response);
    }).catch(function (err) {
        console.log(err);
    });
}

function replicateDB(dbname) {
    // PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/lsdict', 'lsdict', {live: true})
    // PouchDB.replicate('http:\/\/admin:kjre4317@localhost:5984/flex', 'flex', {live: true})
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
    let plain, form
    keys.forEach(function(key, idx) {
        form = orthos.toComb(key)
        plain = orthos.plain(form)
        let word = {idx: idx, form: form, plain: plain, raw: key, dicts: []}
        if (idx == num) word.current = true
        words.push(word)
    })
    return words
}

antrax.prototype.query = function(str, num, cb) {
    let words = parseClause(str, num)
    queryPromise(words, function(res) {
        // log('Q RES', res)
        cb(res)
    })
}

function queryPromise(words, cb) {
    // log('ANTRAX QUERY NUM', sentence, current)
    Promise.all([
        queryTerms(words),
        getAllFlex()
    ]).then(function (res) {
        log('main r0,r1', res[0])
        main(words, res[0], res[1], function(clause) {
            // log('main clause', clause)
            cb(clause)
        });
    }).catch(function (err) {
        log('ANT ERR', err);
    })
}

function main(sentence, clause, fls, cb) {
    let keys = sentence.split(' ')
    // let ukeys = _.uniq(keys)
    // log('UKEYS', ukeys)
    let empties = _.select(clause, function(row) { return row.empty })
    log('Empties', empties);
    // let possibleForms = parsePossibleForms(empties, fls);
    // log('Poss-Form-queries', possibleForms);
    cb(clause)
    return

    // δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα.
    // λέγω
    // ἐπιβάλλουσι
    let terms = _.select(rows, function(row) { return row.type == 'term' })
    let ffs = _.select(rows, function(row) { return row.type == 'form' }) // FFS
    // log('main TERMS', terms)
    // log('main FFS', ffs)
    //
    queryDicts(possibleForms).then(function(dicts) {
        // выбрать из possibleForms найденные
        let addedForms = trueQueries(possibleForms, dicts);
        log('addedForms:::', addedForms);
        let words = terms.concat(ffs).concat(addedForms); // concat(empties).
        // log('antrax-words:', words)
        let clause = compact(keys, terms, ffs, addedForms)
        log('==antr-CLAUSE==', clause)
        // let clause = _.groupBy(words, 'idx' )
        cb(clause)
    }).catch(function (err) {
        log('ERR DICTS', err);
    });
}

function main_old(sentence, rows, fls, cb) {
    let keys = sentence.split(' ')
    // let ukeys = _.uniq(keys)
    // log('UKEYS', ukeys)
    let empties = _.select(rows, function(row) { return row.empty })
    log('Empties', empties);
    let terms = _.select(rows, function(row) { return row.type == 'term' })
    let ffs = _.select(rows, function(row) { return row.type == 'form' }) // FFS
    // log('main TERMS', terms)
    // log('main FFS', ffs)
    let possibleForms = parsePossibleForms(empties, fls);
    // log('Poss-Form-queries', possibleForms);
    //
    queryDicts(possibleForms).then(function(dicts) {
        // выбрать из possibleForms найденные
        let addedForms = trueQueries(possibleForms, dicts);
        log('addedForms:::', addedForms);
        let words = terms.concat(ffs).concat(addedForms); // concat(empties).
        // log('antrax-words:', words)
        let clause = compact(keys, terms, ffs, addedForms)
        log('==antr-CLAUSE==', clause)
        // let clause = _.groupBy(words, 'idx' )
        cb(clause)
    }).catch(function (err) {
        log('ERR DICTS', err);
    });
}

function compact(keys, terms, ffs, afs) {
    let clause = {}
    keys.forEach(function(key, idy) {
        // log('KEY FORM IDY', idy, key)
        let kterms = _.select(terms, function(term) { return term.idx == idy })
        // let kmorphs = _.select(kterms, function(term) { return ['pron', 'art', 'verb'].includes(term.pos) })
        let kmorphs = _.select(kterms, function(term) { return term.morphs })
        let kplains = _.select(kterms, function(term) { return !term.morphs })
        if (kmorphs.length > 1) throw new Error('MANY TERMS!!!!')
        let term = kmorphs[0] // only one always
        let plain = kplains[0] // only one always
        // теперь forms здесь нет, они все в ffs
        // let forms = _.select(kterms, function(term) { return !['pron', 'art', 'verb'].includes(term.pos) })
        // let forms = _.select(kterms, function(term) { return !term.morphs })
        let kffs = _.select(ffs, function(ff) { return ff.idx == idy })
        // let kffms = _.select(kffs, function(ff) { return ff.morphs }) // это на будущее, morphs из других ист., тесты
        // let kffns = _.select(kffs, function(ff) { return !ff.morphs }) // plain, no-Morphs finite forms
        // forms = forms.concat(kffs)
        let forms = kffs
        let kafs = _.select(afs, function(af) { return af.idx == idy })
        let names = _.select(kafs, function(af) { return af.pos == 'name' })
        let verbs = _.select(kafs, function(af) { return af.pos == 'verb' })
        log('COMPACT names', names)
        // let name = names[0]
        // if (names.length > 1) throw new Error('MANY NAMES!!!!')
        // let verb = verbs[0]
        // if (verbs.length > 1) throw new Error('MANY VERBS!!!!')
        // log('COMPACT', afs)
        clause[idy] = {key: key}
        // term имеет morphs, finite forms - не имеют
        if (term) clause[idy].term = term
        if (plain) clause[idy].plain = plain
        if (forms.length) clause[idy].forms = forms
        if (names.length) clause[idy].names = names
        if (verbs.length) clause[idy].verbs = verbs
        if (_.keys(clause[idy]).length == 1 ) clause[idy].empty = {idx: idy, form: key, empty: true }
    })
    return clause
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

function parsePossibleForms(empties, fls) {
    let queries = [];
    empties.forEach(function(row) {
        fls.forEach(function(flex) {
            if (flex.flex != row.form.slice(-flex.flex.length)) return;
            let stem = row.form.slice(0, -flex.flex.length);
            let query = [stem, flex.dict].join('');
            let word
            if (flex.pos == 'verb') {
                // log('FLEX VERB', flex.pos, flex.var, flex.numpers)
                if (query.slice(0,2) == 'ἐ' && /impf/.test(flex.descr)) {
                    query = query.slice(2)
                } else if (/impf/.test(flex.descr)) {
                    return
                }
                word = {idx: row.idx, pos: flex.pos, query: query, stem: stem, form: row.form, numpers: flex.numpers, var: flex.var, descr: flex.descr}
            } else {
                // log('FLEX NAME', flex)
                word = {idx: row.idx, pos: flex.pos, query: query, stem: stem, form: row.form, gend: flex.gend, numcase: flex.numcase, var: flex.var, flex: flex} // , flex: flex
            }
            queries.push(word)
        });
    });
    return queries;
}

// gend - нужен
// FIXME: тут может меняться форма ударения в кос. падежах: πῆχυς-πήχεως
// и м.б. лишние решения. Найти и избавиться
// и то же с родом
// м.б. проверять с ударением, если ноль, еще раз по плоским
// ἰχθύς - ἰχθύος
// σκηνῇ дает три варианта, два лишних
// if (q.var == 'ah') return // это зачем?

function trueQueries(queries, dicts) {
    let addedForms = [];
    let qnames = []
    let qverbs = []
    let qparts = []
    queries.forEach(function(q) {
        if (q.pos == 'name') qnames.push(q)
        if (q.pos == 'part') qparts.push(q)
        if (q.pos == 'verb') qverbs.push(q)
    })
    // λῡόντων <<<< ================================= либо part либо verb, нужно оба
    dicts.forEach(function(d) {
        let nquery = {dict: d.dict, id: d._id, pos: d.pos}
        let vquery = {dict: d.dict, id: d._id, pos: d.pos}
        let qnstricts = _.select(qnames, function(q) { return q.query == d.dict })
        let names = (qnstricts.length) ? qnstricts : _.select(qnames, function(q) { return orthos.plain(q.query) == orthos.plain(d.dict) })
        names.forEach(function(q) {
            if (d.pos != 'name') return
            // тут - παλαιῶν -либо добавить в lsdict, кроме 'os-a-on' еще и 'h', поскольку dict=os находится в h
            // либо вообще var не сравнивать - нельзя - ἀγαθός, etc - много лишнего из-за s-dos
            // однако παλαιῶν проходит по -os-
            // отвалится на прилагательном женского-среднего рода
            // log('DVAR', d.var.split('--'), q.var, d.var.split('--').includes(q.var), q.flex)
            if (!d.var.split('--').includes(q.var)) return
            if (d.gend && !d.gend.includes(q.gend)) return

            let morph = {gend: q.gend, numcase: q.numcase } // , flex: q.flex - это оставлять нельзя из-за conform - там строки !!!!
            if (!nquery.morphs) nquery.morphs = [morph]
            else nquery.morphs.push(morph)
            nquery.idx = q.idx
            nquery.form = q.form
            nquery.trn = d.trn
        })

        qparts.forEach(function(q) {
            if (d.pos != 'verb') return
            if (orthos.plain(q.query) != orthos.plain(d.dict)) return
            let morph = {gend: q.gend, numcase: q.numcase}
            if (!nquery.morphs) nquery.morphs = [morph]
            else nquery.morphs.push(morph)
            nquery.pos = 'name'
            nquery.part = true
            nquery.idx = q.idx
            nquery.form = q.form
        })
        qverbs.forEach(function(q) {
            if (d.pos != 'verb') return
            if (orthos.plain(q.query) != orthos.plain(d.dict)) return
            let morph = {mod: q.descr, numpers: q.numpers}
            if (!vquery.morphs) {
                vquery.morphs = {}
                vquery.morphs[q.descr] = [q.numpers]
            }
            else if (vquery.morphs[q.descr]) vquery.morphs[q.descr].push(q.numpers)
            else if (!vquery.morphs[q.descr]) vquery.morphs[q.descr] = [q.numpers]
            else throw new Error('VERB STRANGE MORPH')
            vquery.idx = q.idx
            vquery.form = q.query
            vquery.descr = q.descr
        })
        if (nquery.morphs) {
            nquery.trn = d.trn
            addedForms.push(nquery)
        }
        if (vquery.morphs) {
            vquery.trn = d.trn
            addedForms.push(vquery)
        }
    })
    // if (addedForms.length > 1) {
    //     let exactForms = _.select(addedForms, function(f) { return f.query == ZZZ})
    // }
    return addedForms
}

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

// δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα.
// λέγω
// ἐπιβάλλουσι
function queryTerms(words) {
    let keys = words.map(function(word) { return word.form})
    let ukeys = _.uniq(keys)
    log('UKEYS', ukeys)
    return new Promise(function(resolve, reject) {
        db_term.query('term/byForm', {
            keys: ukeys
            // include_docs: true
        }).then(function (res) {
            log('RES-TERMS', res)
            if (!res || !res.rows) throw new Error('no term result') //  || res.rows.length == 0
            let allterms = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value);});
            let clause = {}
            words.forEach(function(word, idx) {
                let indecls = _.select(allterms, function(term) { return term.indecl && term.form == word.form})
                let terms = _.select(allterms, function(term) { return !term.indecl && term.form == word.form})
                let prons = _.select(allterms, function(term) { return !term.indecl && term.form == word.form && term.pos == 'pron'})
                let arts = _.select(allterms, function(term) { return !term.indecl && term.form == word.form && term.pos == 'art'})
                let verbs = _.select(allterms, function(term) { return !term.indecl && term.form == word.form && term.pos == 'verb'})

                // word {idx, form, plain, clean, dicts=[], possible -либо- indecl}
                log('INDS', indecls)
                log('PRONS', prons)
                log('ARTS', arts)
                // let query = {idx: idx, type: 'term', form: word.form, dict: word.form, term: true}

                if (prons.length) {
                    let qpron = {pos: 'pron', morphs: []}
                    prons.forEach(function(term) {
                        let morph = {gend: term.gend, numcase: term.numcase}
                        qpron.morphs.push(morph)
                    })
                    word.dicts.push(qpron)
                }
                if (arts.length) {
                    let qpron = {pos: 'art', morphs: []}
                    arts.forEach(function(term) {
                        let morph = {gend: term.gend, numcase: term.numcase}
                        qpron.morphs.push(morph)
                    })
                    word.dicts.push(qpron)
                }
                if (verbs.length) {
                    let qpron = {pos: 'verb', morphs: []}
                    verbs.forEach(function(term) {
                        let morph = {gend: term.gend, numcase: term.numcase}
                        qpron.morphs.push(morph)
                    })
                    word.dicts.push(qpron)
                }
                word.indecl = true
                if (indecls.length) word.dicts = indecls
            })
            log('TERM CLAUSE', words)
            resolve(words)
        }).catch(function (err) {
            log('queryTERMS ERRS', err);
            reject(err);
        });
    });
}

                // let ffs = _.select(allterms, function(term) { return term.indecl && term.form == key})
                // ffs.forEach(function(ff) { ff.idx = idx})
                // ffs.forEach(function(ff) { ff.ffs = true})
                // log('FFS', ffs)
                // let terms = _.select(allterms, function(term) { return term.type == 'term' && term.form == key})
                // log('TTS', terms)
                // term.form всегда одна, конечных форм м.б. несколько  - ан, нет - τοῦ - артикль и int.pron - что делать?

                // let term = terms[0] // убрать term <<<============== FIXME:
                // let query
                // // FIXME: ошибка, теперь INDECLS часть terms
                // if (terms.length == 0) {
                //     query = {idx: idx, form: key, empty: true } // это пустые empty non-term формы
                // } else {
                //     // <<<<<<<<<<<<<<<<<=============== HERE WE ARE ============
                //     // просто terms.forEach ?
                //     // dict: term.dict ???? всякие частицы, проверить бы
                //     if (!term.dict) term.dict = key
                //     query = {idx: idx, type: 'term', form: key, dict: term.dict, pos: term.pos, trn: term.trn} // , dtype: 'eds'
                //     terms.forEach(function(term) {
                //         if (term.pos == 'pron') {
                //             let morph = {gend: term.gend, numcase: term.numcase}
                //             if (!query.morphs) query.morphs = [morph]
                //             else query.morphs.push(morph)
                //         } else if (term.pos == 'art') {
                //             let morph = {gend: term.gend, numcase: term.numcase}
                //             if (!query.morphs) query.morphs = [morph]
                //             else query.morphs.push(morph)
                //         } else if (term.pos == 'verb') {
                //             // log('TERM VERB <<<<<<<<<<<<<<<<<')
                //             let morph = {mod: term.mod, numpers: [term.numper]}
                //             if (!query.morphs) query.morphs = {}
                //             if (!query.morphs[term.mod]) query.morphs[term.mod] = [term.numper]
                //             else query.morphs[term.mod].push(term.numper)
                //         // } else {
                //             // terms другой - просто загнать в forms
                //         }
                //     })
                // }
                // forms.push(query)
                // forms = forms.concat(ffs)

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
