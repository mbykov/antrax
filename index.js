/* query greek
*/

let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let path = require('path');
let orthos = require('../orthos');
let u = require('./lib/utils');
let modCorr = u.modCorr

// let PouchDB = require('pouchdb-browser');
// let db_flex = new PouchDB('gr-flex')
// let db = new PouchDB('greek')

let PouchDB = require('pouchdb');
// let db = new PouchDB('my_db');
// PouchDB.plugin(require('pouchdb-adapter-memory'));
// let pouch = new PouchDB('myDB', {adapter: 'memory'});
let db_flex = new PouchDB('http:\/\/localhost:5984/gr-flex');
let db = new PouchDB('http:\/\/localhost:5984/greek');
// let db_flex = new PouchDB('localhost:5984/gr-flex', {adapter: 'memory'});
// let db = new PouchDB('localhost:5984/greek', {adapter: 'memory'});

// destroyDB(db_flex)
// destroyDB(db)
// return

let forTest = process.argv.slice(2)[0] || false;

// replicateDB('gr-flex')
// replicateDB('greek')
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
    let plain, form, accents
    keys.forEach(function(key, idx) {
        form = orthos.toComb(key)
        form = form.replace('ττ', 'σσ') // TALASSA
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
    log('ANTRAX-START')
    // replicateDB('gr-flex')
    // replicateDB('greek')
    let words = parseClause(str, num)
    queryPromise(words, function(res) {
        log('ANTRAX RES', res)
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
        log('ANT ERR', err);
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

// { flex: 'ῶν',
//   gnd: 'masc',
//   numcase: 'pl.gen',
//   descr: 'prima',
//   var: 'a-cont',
//   pos: 'noun',
//   dict: 'ᾶ',
//   size: 3,
//   type: 'greek-flex' },
// =================================================
// καὶ ὃς ἐὰν δέξηται παιδίον τοιοῦτον ἓν ἐπὶ τῷ ὀνόματί μου, ἐμὲ δέχεται· // TXT


                    // ИТОГО: искать в списке, если нет - строить простой dict - лексическую форму

// 1. palmer = все формы {form: var, }
                    // 2. здесь - query + squeries для опростых пока, потом модуль
                    // 3. ddocs - выводить все формы - справа var
                    // 4. в dicts - разделить indecls, names, vars, parts

                    // let aug = stem.slice(0,2)
                    // let augs = ['ἐ', 'ἔ', '']
                    // log('augs===>', aug, augs.includes(aug))
                    // if (augs.includes(aug) && (/impf/.test(morph.var) || /aor/.test(morph.var))) {
                    //     log('AUG E', morph)
                    //     query = query.slice(2)
                    // } else if (/impf/.test(morph.var) || /aor/.test(morph.var)) {
                    //     log('AUG OTHER', morph)
                    //     return
                    // }
                    //

function parsePossibleForms(empties, fls) {
    let forms = [];
    // let vforms = [];
    empties.forEach(function(row) {
        fls.forEach(function(flex) {
            // if (flex.flex == 'εις') log('=========>>>>FLEX', flex)
            if (flex._id != row.form.slice(-flex._id.length)) return;
            let stem = row.form.slice(0, -flex._id.length);
            // let last2 = stem.slice(-2)
            // log('FLEX', flex)
            flex.morphs.forEach(function(morph) {
                if (morph.pos == 'verb') log('=========>>>> flex._id:', flex._id, 'stem:', stem)
                // if (morph.pos == 'verb') log('=========>>>> MORPH', morph)
                let query = [stem, morph.dict].join('');
                let form
                if (morph.pos == 'verb') {
                    form = {idx: row.idx, pos: morph.pos, query: query, form: row.form, numper: morph.numper, var: morph.var, descr: morph.descr}
                    log('FLEX V MORPH', morph.var)
                    // log('P FORM QUERY', form)
                    // log('CONST', modCorr['act.pres.ind'])
                    if (modCorr['act.pres.ind'].includes(morph.var)) form.api = true
                    // if (morph.var == 'act.pres.ind') form.api = true
                    forms.push(form)
                } else {
                    let last = stem.slice(-1)
                    // в morph-part нет var!
                    // log('pFLEX', 'last', last, 'MVAR', morph.var, '_ID', flex._id, 'POS', morph.pos)
                    if (!['ε', 'ι', 'ρ']. includes(last) && ['sg.gen', 'sg.dat']. includes(morph.numcase) && ['ας']. includes(flex._id)) return
                    form = {idx: row.idx, pos: morph.pos, query: query, stem: stem, form: row.form, gend: morph.gend, numcase: morph.numcase, var: morph.var, add: morph.add, flex: flex} // , flex: flex - убрать
                    forms.push(form)
                }
                // forms.push(form)
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
    let addedForms = [];
    let qqnames = []
    let qverbs = []
    let qparts = []
    queries.forEach(function(q) {
        if (q.pos == 'name') qqnames.push(q)
        if (q.pos == 'part') qparts.push(q)
        if (q.pos == 'verb') qverbs.push(q)
    })

    log('4w-Qdicts', dicts)
    log('4w-QVERBs', qverbs)
    // λῡόντων <<<< ================================= либо part либо verb, нужно оба
    dicts.forEach(function(d) {
        let nquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: []} // FIXME: _id не нужен - id: d._id,
        let vquery = {type: d.type, dict: d.dict, pos: d.pos, trn: d.trn, morphs: {}}

        let qnstricts = _.select(qqnames, function(q) { return q.query == d.dict })
        let qnames = (qnstricts.length) ? qnstricts : _.select(qqnames, function(q) { return orthos.plain(q.query) == orthos.plain(d.dict) })

        // let word = {idx: idx, form: form, plain: plain, raw: key, dicts: []}
        qnames.forEach(function(q) {
            if (d.pos != 'name') return
            if (!d.var) {
                log('NNV', d)
                throw new Error('NO NAME VAR')
            }
            log('DVAR', d.var, 'QVAR', q.var) // 'FLEX', q.flex
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

        log('API d', d)
        qverbs.forEach(function(q) {
            if (d.pos != 'verb') return
            log('DESCR', d.descr, 'q', q.descr)
            if (d.descr && d.descr != q.descr) return // αἰτέω - проверить

            // query - либо api (простые и сконструированные), либо modCorr
            if (d.var == 'act.pres.ind') {
                if (!q.api) return
                // if (_.values(d.vmorphs).includes(q.var)) return // - ищем по доп-форме, раз она есть
            } else {
                if (modCorr[d.var] && !modCorr[d.var].includes(q.var)) return
                log('===========================================>', d.var, q.var)
            }
            if (orthos.plain(q.query) != d.plain) return

            log('API q', q)
            log('<------> here we are', d.plain, 'd:', d.var, 'q:', q.var)
            log('<------> here we are d:', d.plain, q.query)

            let morph = {var: q.var, numper: q.numper}
            if (!vquery.morphs[q.var]) vquery.morphs[q.var] = [q.numper]
            else vquery.morphs[q.var].push(q.numper)
            // else throw new Error('VERB STRANGE MORPH')
            vquery.idx = q.idx
            vquery.form = q.query
            vquery.descr = q.descr
        })

        qparts.forEach(function(q) {
            if (d.pos != 'verb') return
            log('PART', d)
            log('PART', q)
            if (orthos.plain(q.query) != orthos.plain(d.dict)) return
            let morph = {gend: q.gend, numcase: q.numcase}
            if (!nquery.morphs) nquery.morphs = [morph]
            else nquery.morphs.push(morph)
            nquery.pos = 'name'
            nquery.part = true
            nquery.idx = q.idx
            nquery.form = q.form
        })

        if (nquery.morphs.length) {
            // nquery.trn = d.trn
            words[nquery.idx].dicts.push(nquery)
        }
        if (_.keys(vquery.morphs).length) {
            // vquery.trn = d.trn
            // log('>>> VQUERY', vquery)
            words[vquery.idx].dicts.push(vquery)
        }
    })
    // if (addedForms.length > 1) {
    //     let exactForms = _.select(addedForms, function(f) { return f.query == ZZZ})
    // }
    return addedForms
}

// так нельзя - м.б. один name, из LS - но два dict, adj и noun, или вообще name и verb
//
// function expliciteMorphs (words) {
//     words.forEach(function(word) {
//         if (word.indecl) return
//         let lsdict = _.find(word.dicts, function(dict) { return dict.type == 'ls'})
//         let morphs = (lsdict) ? lsdict.morphs : words.dicts[0].morphs
//         word.morphs = morphs
//     })
// }

// function notInException(d, q) {
//     // но - тут подставляется gnd из flex, т.е. masc - а в словаре fem. как быть?
//     let osEx = ['ὁδός', '']
//     if (q.var == 'os' && osEx.includes(d.dict)) {
//         q.gend = d.gend[0]
//         return false
//     }
//     else return true
// }



function queryDicts(keys) {
    // log('DICT KEYS', keys)
    return new Promise(function(resolve, reject) {
        db.query('greek/byDict', {
            keys: keys,
            include_docs: true
        }).then(function (res) {
            if (!res || !res.rows) throw new Error('no dict result')
            let dicts = res.rows.map(function(row) {return row.doc })
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
                // log('PRONS', prons)
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
                if (indecls.length) word.dicts = indecls
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
    // function log() { console.log.apply(console, arguments); }
    // function p() { console.log(util.inspect(arguments, false, null)) }







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
