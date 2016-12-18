// antrax - query simple greek


let word = process.argv.slice(2)[0] || false;
let sentence = process.argv.slice(3)[0] || false;
// if (!word) return log('what ?');
let util = require('util');

if (!sentence) {
    log('param string?');
    return;
}


let _ = require('underscore');
// let path = require('path');
let fs = require('fs');
let path = require('path');
let orthos = require('../orthos');
let PouchDB = require('pouchdb');
let db = new PouchDB('../utils/pouchdb/terms');
let db_flex = new PouchDB('../utils/pouchdb/flex');

sentence = sentence.replace(/\./, '');
let current = orthos.toComb(word);
sentence = orthos.toComb(sentence);


// current = 'ἀσθένειαν';

console.time('_query');
// queryTerms_old(sentence);
query(sentence, current);
// getMorphs(current);
console.timeEnd('_query');


/*
  взять terms, определить, cur is term?
  если нет, запросить flex - определить current-morphs
  получается, при клике на art или pron, соседей не ищу
  а если несколько words между cur и ближ. term?
  нужно всем искать flex
  но можно и облегченный вариант - проверить только найденное соответствие данного morph
*/

function query(sentence, current) {
    Promise.all([
        queryTerms(sentence),
        getAllFlex()
    ]).then(function (res) {
        main(current, res[0], res[1]);
    }).catch(function (err) {
        log('ERR', err);
    });
}

/*
  нужно: в словаре добавить dict и, главное, .var - как? по translit?
  и выбирать по gend, numcase, var
  ===> salita для греческого нужна
*/
/*
  ==>> οἱ δ' οὖν ὡς ἕκαστοι Ἕλληνες κατὰ πόλεις τε ὅσοι ἀλλήλων ξυνίεσαν καὶ ξύμπαντες ὕστερον κληθέντες οὐδὲν πρὸ τῶν Τρωικῶν δι' ἀσθένειαν καὶ ἀμειξίαν ἀλλήλων ἁθρόοι ἔπραξαν.
  δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα. πρὸ γὰρ τῶν Τρωικῶν οὐδὲν φαίνεται πρότερον κοινῇ ἐργασαμένη ἡ Ἑλλάς. δοκεῖ δέ μοι, οὐδὲ τοὄνομα τοῦτο ξύμπασά πω εἶχεν, ἀλλὰ τὰ μὲν πρὸ Ἕλληνος τοῦ Δευκαλίωνος καὶ πάνυ οὐδὲ εἶναι ἡ ἐπίκλησις αὕτη.
*/

// rows - это words, но несколько вариантов

function main(current, rows, fls) {
    // log('q-TERMS', rows);
    // return;
    log('q-FLs', fls.length);
    let cMorph = isTerm(current, rows);
    if (cMorph.length) {
        log('IS TERM', cMorph);
    } else {
        let cMorphs = selectMorphs(current, fls);
        // let chains = conform(rows, cMorphs);
        // log('CHAINS', chains);

        let queries = parseStems(rows, fls);
        // log('QS', queries);
        // return;
        queryDicts(queries).then(function(dicts) {
            let founded = trueQueries(queries, dicts);
            log('DICTS:::', founded);
        }).catch(function (err) {
            log('ERR DICTS', err);
        });
    }
}

function trueQueries(queries, dicts) {
    let founded = [];
    queries.forEach(function(q) {
        dicts.forEach(function(d) {
            if (q.query == d.dict && q.gend == d.gend) {
                q.dict = d.dict;
                q.trn = d.trn;
                founded.push(q);
            }
        });
    });
    return founded;
}

function parseStems(rows, fls) {
    let queries = [];
    rows.forEach(function(row) {
        if (row.type == 'term') return;
        if (row.pos == 'verb') return;
        row.queries = [];
        // log('ROW', row);
        // let rowMorphs = selectMorphs(row.form, fls);
        fls.forEach(function(flex) {
            if (flex.flex != row.form.slice(-flex.flex.length)) return;
            let stem = row.form.slice(0, -flex.flex.length);
            let query = [stem, flex.dict].join('');
            // row.queries.push(query);
            // FIXME: здесь, для ясности, можно создать объект word
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

            queries.push(word);
        });
        // row.stems = _.uniq(row.stems);
    });
    return queries;
    // return _.compact(_.uniq(_.flatten(queries)));
}

function queryDicts(queries) {
    let keys = _.uniq(queries.map(function(q) { return q.query; }));
    // log('KEYS', keys);
    return new Promise(function(resolve, reject) {
        db.query('terms1/byDict', {
            keys: keys
            // include_docs: true
        }).then(function (res) {
            // log('RES', res);
            if (!res || !res.rows || res.rows.length == 0) throw new Error('no dict result');
            let dicts = res.rows.map(function(row) {return Object.assign({}, {dict: row.key}, row.value);});
            resolve(dicts);
        }).catch(function (err) {
            reject(err);
        });
    });
}


function conform(rows, cMorphs) {
    // log('CONFORM words', words.slice(3,4));
    // log('CONFORM cMorphs', cMorphs[0]);
    let chains = [];
    cMorphs.forEach(function(cur) {
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


function getAllFlex() {
    // let tails = [cur.slice(-1), cur.slice(-2), cur.slice(-3), cur.slice(-4)];
    // log('CUR TAILS', cur, tails);
    return new Promise(function(resolve, reject) {
        db_flex.query('flex/byFlex', {
            // keys: tails
            // include_docs: true
        }).then(function (res) {
            if (!res || !res.rows || res.rows.length == 0) throw new Error('no result');
            let flexes = res.rows.map(function(row) {return Object.assign({}, {flex: row.key}, row.value);});
            // log('FLEXES', flexes.length);
            // let docs = res.rows.map(function(row) {return row.doc;});
            // log('FLEXES', docs.length);
            resolve(flexes);
        }).catch(function (err) {
            // log('ERR', err);
            // showDict(err);
            reject(err);
        });
    });
}

// δηλοῖ δέ μοι καὶ τόδε τῶν παλαιῶν ἀσθένειαν οὐχ ἤκιστα. π
function queryTerms(sentence) {
    let keys = sentence.split(' ');
    keys = _.uniq(keys);
    return new Promise(function(resolve, reject) {
        db.query('terms1/byForm', {
            keys: keys
            // include_docs: true
        }).then(function (res) {
            // log('RES', res);
            if (!res || !res.rows || res.rows.length == 0) throw new Error('no result');
            let forms = [];
            let pos = keys.indexOf(current);
            let rows = res.rows.map(function(row) {return Object.assign({}, {form: row.key}, row.value);});
            keys.forEach(function(key, idx) {
                rows.forEach(function(word) {
                    if (word.form != key) return;
                    word.idx = idx;
                    if (word.type == 'form') word = {type: 'form', form: key, idx: idx}; // это пустые формы
                    forms.push(word);
                });
            });
            // log('ROWS', forms);
            resolve(forms);
        }).catch(function (err) {
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
