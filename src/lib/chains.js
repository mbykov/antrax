//

import _ from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'
// import {oxia, comb, plain, strip} from '../../../../greek/orthos'
import { parseVerb, parseName, parsePart } from './mutables'
let log = console.log
const d = require('debug')('app')
import { vowels, aspirations, uisyms } from './utils'
const asps = _.values(aspirations)
let augs = ['ἀ', 'ἐ', 'ἠ', 'εἰ', 'ἑ', 'ἰ', 'ὠ', 'ἁ', 'ἡ', 'αἰ', 'αἱ', 'εἱ', 'εὐ', 'αὐ', 'ηὐ', 'εὑ', 'ηὑ', 'ἱ', 'ὀ', 'οἰ', 'ω', 'ὁ', 'ὡ', 'ὑ']
let augplains = ['α', 'ε', 'η', 'ει', 'ι', 'ω', 'αι', 'ευ', 'αυ', 'ηυ', 'ο', 'οι', 'υ']

export function makeChains (sgms, dicts, flexes, compound, only) {
  let chains = []
  let prefs = _.filter(dicts, dict=> { return dict.pref })
  let vsufs = _.filter(dicts, dict=> { return dict.suf && dict.stem == 'verb' })
  let muts = _.filter(dicts, dict=> { return !dict.suf && !dict.pref }) //  && !dict.irreg с irreg - разобраться
  // let irregs = _.filter(dicts, dict=> { return dict.verb && dict.irreg }) // пока только verb
  let longs = _.filter(muts, dict=> { return dict.plain.length > 1 })
  let lplains = _.uniq(muts.map(dict=> { return dict.plain }))
  let flexterms = flexes.map(flex=> { return flex.term })
  sgms = _.filter(sgms, segs=> { return flexterms.includes(_.last(segs))})
  d('SGMS', sgms.length)

  let singles = _.filter(sgms, segs=> { return segs.length == 2 })
  // log('__________________________________________make chain singles:', singles.length, 'muts:', muts.length)

  // simple w/o aug
  singles.forEach(segs => {
    if (compound) return
    let mainseg = plain(segs[0])
    muts = _.filter(muts, dict=> { return !dict.compound })
    // let verbs = _.filter(muts, dict=> { return dict.verb })
    // let names = _.filter(muts, dict=> { return dict.name })
    // // здесь есть irregs, но нужно отбросить compound:
    // let maindicts = _.filter(names, dict=> { return dict.plain == mainseg })
    // let verbdicts = _.filter(verbs, dict=> { return !dict.aug && dict.plain == mainseg && !dict.augs })
    // maindicts.push(...verbdicts)

    let maindicts = _.filter(muts, dict=> { return !dict.aug && dict.plain == mainseg })
    if (!maindicts.length) return
    // log('______________single maindicts w/o aug:', segs, mainseg, muts.length, maindicts.length)

    let flexseg = segs[1]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    if (!segflexes.length) return
    // log('______________single flexes:', flexseg, segflexes.length)

    let cdicts = makeDictFlex(maindicts, segflexes, only)
    if (!cdicts.length) return

    let commonseg = [mainseg, flexseg].join('')
    let rdict = {seg: commonseg, dicts: cdicts, cogns: maindicts, simple: true, stem: mainseg, flex: flexseg }
    let chain = [rdict]
    chains.push(chain)
  })

  // irregs не имеют aug
  // if (chains.length) return chains
  // return chains

  let doubles = _.filter(sgms, segs=> { return segs.length == 3 })

  // simple + aug
  doubles.forEach(segs => {
    if (compound) return
    let verbs = _.filter(muts, dict=> { return dict.verb && dict.aug })
    let augseg = plain(segs[0])
    if (!augs.includes(augseg)) return
    // log('____aug-verb augseg:', segs, augseg, verbs.length)
    verbs =  _.filter(verbs, dict=> { return dict.aug == augseg })
    if (!verbs.length) return

    let verbseg = plain(segs[1])
    let verbdicts = _.filter(verbs, dict=> { return dict.aug && dict.verb && dict.plain== verbseg })
    if (!verbdicts.length) return
    // log('__aug-verb: verbseg:', segs, augseg, verbseg, 'verbdicts:', verbdicts.length)

    let flexseg = segs[2]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    if (!segflexes.length) return

    let cdicts = makeDictFlex(verbdicts, segflexes, only)
    // log('__aug-verbs:', segs, verbseg, 'verbdicts:', verbdicts.length, 'cdicts:', cdicts.length)
    cdicts = _.filter(cdicts, dict=> { return dict.aug == augseg })
    if (!cdicts.length) return

    let commonseg = [augseg, verbseg, flexseg].join('')
    let verbsec = { seg: commonseg, dicts: cdicts, cogns: verbdicts, simple: true, aug: augseg, stem: verbseg, flex: flexseg }
    let chain = [verbsec]
    chains.push(chain)
  })

  if (chains.length) return chains

  // === COMPOUNDS ===
  muts = _.filter(muts, dict=> { return dict.plain.length > 1 }) // only longs

  // ex: παραστατικός
  // PREF-MUTS
  doubles.forEach(segs => {
    let prefseg = plain(segs[0])
    let prefdicts = _.filter(prefs, dict=> { return dict.plain == prefseg} )
    if (!prefdicts.length) return
    // log('____pref-muts prefdicts:', segs, prefseg, prefdicts.length)

    let mainseg = plain(segs[1])
    let maindicts = _.filter(muts, dict=> { return !dict.aug && dict.plain== mainseg })
    if (!maindicts.length) return
    // log('__pref-double: mainseg:', segs, mainseg, 'verbdicts:', maindicts)

    let flexseg = segs[2]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    if (!segflexes.length) return
    // log('__pref-double: flex:', segs, mainseg, 'segflexes:', segflexes.length)

    let cdicts = makeDictFlex(maindicts, segflexes, only)
    // log('__pref-double:', segs, mainseg, 'verbdicts:', maindicts.length, 'cdicts:', cdicts.length)
    if (!cdicts.length) return

    let prefsec = { seg: prefseg, dicts: prefdicts, doubles: true, pref: true }
    let commonseg = [mainseg, flexseg].join('')
    let mainsec = { seg: commonseg, dicts: cdicts, cogns: maindicts, stem: mainseg, flex: flexseg }
    let chain = [prefsec, mainsec]
    chains.push(chain)
  })

  // VERB-SUFF:
  doubles.forEach(segs => {
    return
    // log('______________doubles suff:', segs)
    let sufseg = plain(segs[1])
    let sufdicts = _.filter(vsufs, dict=> { return dict.plain == sufseg } )
    // if (sufdicts.length) log('______________sufdicts:', segs, sufdicts.length)
    if (!sufdicts.length) return

    let flexseg = segs[2]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    // if (segflexes.length) log('______________segflexes:', segflexes.length)

    let cdicts = makeDictFlex(sufdicts, segflexes, only)
    // log('______________suff-cdicts:', sufdicts.length, segflexes.length, cdicts.length)
    if (!cdicts.length) return

    let verbseg = plain(segs[0])
    let verbs = _.filter(muts, dict=> { return dict.verb })
    let verbdicts = selectMutable(verbseg, verbs)

    // log('______________suff-verbs:', verbdicts.length)
    if (!verbdicts.length) return

    let verbsec = { seg: verbseg, dicts: verbdicts, doubles: true }
    let commonseg
    let sufsec = { seg: sufseg, dicts: cdicts, suff: true }
    let chain = [verbsec, sufsec]
    chains.push(chain)
  })

  // DOUBLES: COMPOUND W/O CNNECTOR:
  // нужен пример w/o, но с глаголом, имеющим aug
  // βαρύτονος - имеет коннектор
  doubles.forEach(segs => {
    return
    // if (!longs.length) return

    let mainseg = plain(segs[1])
    let maindicts = selectMutablePlain(mainseg, longs)
    if (!maindicts.length) return
    // if (maindicts.length) log('______________doubles compound main:', segs, mainseg, 'muts:', muts.length, 'mutdicts:', maindicts.length)

    let flexseg = segs[2]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )

    let cdicts = makeDictFlex(maindicts, segflexes, only)
    if (!cdicts.length) return

    // log('__doubles dicts w/o cnnector __cdicts__:', segs, mainseg, 'maindicts:', maindicts.length, '_cdicts_:', cdicts.length)

    let firstseg = plain(segs[0])
    let firstdicts = selectMutable(firstseg, longs)
    // log('______________doubles compound firstdicts:', segs, mainseg, 'muts:', muts.length, 'firstdicts:', firstdicts.length)
    if (!firstdicts.length) return

    let firstsec = { seg: firstseg, dicts: firstdicts, doubles: true, compound: true }
    let commonseg
    let mainsec = { seg: mainseg, dicts: cdicts }
    let chain = [firstsec, mainsec]
    chains.push(chain)
  })


  let triples = _.filter(sgms, segs=> { return segs.length == 4 })

  // PREF-MUTS
  // ex: ἀφαιρέω
  triples.forEach(segs => {
    let prefseg = plain(segs[0])
    let prefdicts = _.filter(prefs, dict=> { return dict.plain == prefseg} )
    if (!prefdicts.length) return
    // log('____pref-verb prefdicts:', segs, prefseg, prefdicts.length)

    let verbs = _.filter(muts, dict=> { return dict.verb && dict.aug })
    let augseg = plain(segs[1])
    if (!augplains.includes(augseg)) return
    verbs =  _.filter(verbs, dict=> { return strip(dict.aug) == augseg })
    if (!verbs.length) return
    // log('____aug-verb augseg:', segs, augseg, verbs.length)

    let verbseg = plain(segs[2])
    let verbdicts = _.filter(verbs, dict=> { return dict.aug && dict.plain== verbseg })
    if (!verbdicts.length) return
    // log('__pref-verb: verbseg:', segs, verbseg, 'verbdicts:', verbdicts.length)

    let flexseg = segs[3]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    if (!segflexes.length) return

    let cdicts = makeDictFlex(verbdicts, segflexes, only)
    // log('__pref-verb:', segs, verbseg, 'verbdicts:', verbdicts.length, 'cdicts:', cdicts.length)
    if (!cdicts.length) return

    let prefsec = { seg: prefseg, dicts: prefdicts, triples: true, pref: true }
    let commonseg = [augseg, verbseg, flexseg].join('')
    let verbsec = { seg: commonseg, dicts: cdicts, cogns: verbdicts, aug: augseg, stem: verbseg, flex: flexseg }
    let chain = [prefsec, verbsec]
    chains.push(chain)
  })

  // βαρύτονος - barutonos
  // TRIPLES: COMPOUND WITH CONNECTOR
  triples.forEach(segs => {
    let connector
    let conseg = strip(segs[1])
    if (conseg.length == 1 && vowels.includes(conseg)) connector = conseg
    if (!connector) return
    // log('________________________________triples:', segs, 'conn:', connector)

    let firstseg = plain(segs[0])
    let firstdicts =  _.filter(muts, dict=> { return !dict.aug && dict.plain == firstseg })
    if (!firstdicts.length) return
    // log('__triples firstseg__:', segs, mainseg, 'maindicts:', maindicts.length, '_cdicts_:', cdicts.length, 'firstdicts:', firstdicts.length)

    let mainseg = plain(segs[2])
    let maindicts =  _.filter(muts, dict=> { return !dict.aug && dict.plain == mainseg })
    if (!maindicts.length) return
    // log('__triples mainseg__:', segs, mainseg, 'maindicts:', maindicts.length)

    let flexseg = segs[3]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    if (!segflexes.length) return

    let cdicts = makeDictFlex(maindicts, segflexes, only)
    if (!cdicts.length) return
    // log('__triples mainseg__:', segs, mainseg, 'maindicts:', maindicts.length, '_cdicts_:', cdicts.length)

    // compound with vowel in a middle:
    let firstsec = { seg: firstseg, dicts: firstdicts, stem: firstseg, triples: true, type: 'comp-connector', stem: firstseg }
    let connsec = { seg: conseg, connector: connector, dicts: [] }
    let commonseg = [mainseg, flexseg].join('')
    let secsec = { seg: commonseg, dicts: cdicts, cogns: maindicts, stem: mainseg, flex: flexseg }
    let chain = [firstsec, connsec, secsec]
    chains.push(chain)
  })

  // TRIPLES: TWO PREFS W/O AUG
  // ex: ἐγκαταβιόω, i.e. ἐγκαταβιῶ
  triples.forEach(segs => {
    // log('___________________________________________ triple-segs:', segs)
    let prefseg = plain(segs[0])
    let prefdicts = _.filter(prefs, dict=> { return dict.plain == prefseg } )
    if (!prefdicts.length) return
    // log('____triples pref-verb prefdicts:', prefseg, prefdicts.length)
    let prefss = prefs.map(dict=> { return dict.plain })

    let prefseg2 = strip(segs[1])
    let prefdicts2 = _.filter(prefs, dict=> { return strip(dict.plain) == prefseg2 } )
    if (!prefdicts2.length) return
    // log('____triples pref-verb prefdicts2:', prefseg, prefseg2, prefdicts2.length)

    let mainseg = plain(segs[2])
    let maindicts = _.filter(muts, dict=> { return !dict.aug && dict.plain == mainseg })
    if (!maindicts.length) return

    let flexseg = segs[3]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg } )
    if (!segflexes.length) return

    let cdicts = makeDictFlex(maindicts, segflexes, only)
    if (!cdicts.length) return
    // log('__triples prefs 2 mainseg__:', segs, mainseg, 'maindicts:', maindicts.length, '_cdicts_:', cdicts.length)

    let prefsec = { seg: prefseg, dicts: prefdicts, triples: true, pref: true }
    let prefsec2 = { seg: prefseg2, dicts: prefdicts2, pref2: true }
    let commonseg = [mainseg, flexseg].join('')
    let mainsec = { seg: commonseg, dicts: cdicts, cogns: maindicts, stem: mainseg, flex: flexseg }
    let chain = [prefsec, prefsec2, mainsec]
    chains.push(chain)
  })

  if (chains.length) return chains
  let quads = _.filter(sgms, segs=> { return segs.length == 5 })
  // log('QUADS', quads.length)

  // ex: προσδιαιρέω
  // QUADRUPLES: TWO PREFS + AUG
  quads.forEach(segs => {
    let prefseg = plain(segs[0])
    let prefdicts = _.filter(prefs, dict=> { return dict.plain == prefseg} )
    // log('____quads pref-verb prefdicts:', prefseg, prefdicts.length)
    if (!prefdicts.length) return

    let prefseg2 = strip(segs[1])
    let prefdicts2 = _.filter(prefs, dict=> { return strip(dict.plain) == prefseg2} )
    if (!prefdicts2.length) return
    // log('____quads pref-verb prefdicts2:', prefseg, prefseg2, prefdicts2.length)

    let augseg = strip(segs[2])
    if (!augplains.includes(augseg)) return
    log('____quads pref-verb augseg:', prefseg, prefseg2, augseg)

    let mainseg = plain(segs[3])
    let maindicts = _.filter(muts, dict=> { return dict.aug && strip(dict.aug) == augseg && dict.plain == mainseg } )
    if (!maindicts.length) return

    let flexseg = segs[4]
    let segflexes = _.filter(flexes, flex => { return flex.term === flexseg} )
    if (!segflexes.length) return

    let cdicts = makeDictFlex(maindicts, segflexes, only)
    if (!cdicts.length) return

    // log('__quads prefs3 mainseg__:', segs, mainseg, 'maindicts:', maindicts.length, '_cdicts_:', cdicts.length)

    let prefsec = { seg: prefseg, dicts: prefdicts, quads: true, pref: true }
    let prefsec2 = { seg: prefseg2, dicts: prefdicts2, pref2: true }
    let commonseg = [augseg, mainseg, flexseg].join('')
    let mainsec = { seg: commonseg, dicts: cdicts, cogns: maindicts, aug: augseg, stem: mainseg, flex: flexseg }
    let chain = [prefsec, prefsec2, mainsec]
    chains.push(chain)
  })

  chains = _.compact(chains)
  return chains
}

function makeDictFlex (dicts, flexes, only) {
  let names = _.filter(dicts, dict => { return dict.name && !dict.verb }) // errs in some dicts
  let nflexes = _.filter(flexes, flex => { return flex.name })
  let verbs = _.filter(dicts, dict => { return dict.verb })
  let vflexes = _.filter(flexes, flex => { return flex.verb })

  // log('_____________________________________ verb-name:', dicts.length, 'verbs:', verbs.length, vflexes.length, 'names:', names.length, nflexes.length)
  // let cdicts = []
  let cdicts = parseName(names, nflexes, only)
  // cdicts.push(ndicts)

  let vdicts = parseVerb(verbs, vflexes, only)
  cdicts.push(...vdicts)

  let exacts = _.filter(cdicts, dict=> { return !dict.possible })
  if (exacts.length) cdicts = exacts

  // let pdicts = parsePart(verbs, pflexes) // осторожно - εἴη дает бред
  // cdicts.push(pdicts)
  // cdicts = _.flatten(cdicts)
  return cdicts
}

function parseAugPlain_ (aplain) {
  let pfirst = _.first(aplain)
  let second = aplain[1]
  // let third = aplain[X]
  let aug
  if (vowels.includes(pfirst)) {
    if (uisyms.includes(second)) aug = aplain.slice(0,2) // i.e. NO aspiration
    // else if (third == ypo) aug = aplain.slice(0,X)
    else aug = pfirst
  }
  return aug
}

// function selectMutablePlain(seg, muts) {
//   let irregs = _.filter(muts, dict=> { return dict.irreg && dict.plain == seg })
//   let regs = _.filter(muts, dict=> { return !dict.irreg  })
//   let names = _.filter(regs, dict=> { return dict.name && dict.plain == seg})
//   let verbs = _.filter(regs, dict=> { return dict.verb })
//   let fits
//   // log('____V seg:', seg, verbs.length, 'irregs', irregs.length )
//   let aug = parseAugPlain(seg)
//   if (aug) {
//     let reaug = new RegExp('^' + aug)
//     let rplain = seg.replace(reaug, '')
//     let augdicts = _.filter(verbs, dict=> {
//       if (!dict.augs) return
//       let augs = dict.augs.map(aug=> { return strip(aug) })
//       // log('____AUG seg:', seg, dict.rdict,  'aug:', aug, 'augs:', augs )
//       return dict.plain == rplain && augs.includes(aug) && seg == [aug, dict.plain].join('')
//       // return dict.augs && augs.includes(aug) && seg == [aug, dict.plain].join('')
//     })
//     fits = augdicts
//   } else {
//     fits = _.filter(verbs, dict=> { return dict.plain == seg && !vowels.includes(comb(dict.rdict)[0]) })
//     names = _.filter(names, dict=> { return !vowels.includes(comb(dict.rdict)[0]) }) // во всех словарях должет быть dict
//   }

//   fits.push(...names)
//   fits.push(...irregs)
//   // log('____FITS seg:', seg, fits.length, 'irregs', irregs.length )

//   return fits
// }

// // MUTS:
// function selectMutable(seg, muts) {
//   let irregs = _.filter(muts, dict=> { return dict.irreg && dict.plain == seg })
//   let regs = _.filter(muts, dict=> { return !dict.irreg  })
//   let names = _.filter(regs, dict=> { return dict.name && dict.plain == seg})
//   let verbs = _.filter(regs, dict=> { return dict.verb })
//   let fits
//   // log('____V seg:', seg, muts.length, 'irregs', irregs.length )
//   let aug = parseAug(seg)
//   if (aug) {
//     let reaug = new RegExp('^' + aug)
//     let rplain = seg.replace(reaug, '')
//     let augdicts = _.filter(verbs, dict=> {
//       return dict.augs && dict.plain == rplain && dict.augs.includes(aug) && seg == [aug, dict.plain].join('')
//     })
//     fits = augdicts
//   } else {
//     fits = _.filter(verbs, dict=> { return dict.plain == seg && !vowels.includes(comb(dict.rdict)[0]) })
//     names = _.filter(names, dict=> { return !vowels.includes(comb(dict.rdict)[0]) }) // во всех словарях должет быть dict
//   }

//   fits.push(...names)
//   fits.push(...irregs)
//   // log('____END seg:', seg, fits.length, 'irregs', irregs.length )

//   // здесь exacts быть не может, они возникают позже, в parseName только // но не влияют-ли compounds?
//   let notexacts = _.filter(fits, dict=> { return dict.possible })
//   if (notexacts.length) {
//     log('_________________________ NOT EXACTS HERE', notexacts)
//     throw new Error()
//   }
//   return fits
// }

// // нужно упростить радикально
// function selectMutableNew(seg, muts) {
//   let irregs = _.filter(muts, dict=> { return dict.irreg && dict.plain == seg })
//   let regs = _.filter(muts, dict=> { return !dict.irreg  })
//   let names = _.filter(regs, dict=> { return dict.name && dict.plain == seg})
//   let verbs = _.filter(regs, dict=> { return dict.verb && dict.plain == seg })

//   verbs.push(...names)
//   verbs.push(...irregs)
//   // log('____END seg:', seg, fits.length, 'irregs', irregs.length )
//   return verbs
// }

// function parseAug (aplain) {
//   let syms = aplain.split('')
//   let inters = _.intersection(syms, asps)
//   let aug
//   if (inters.length) {
//     let aspidx = syms.indexOf(inters[0])
//     aug = syms.slice(0,aspidx+1).join('')
//   }
//   return aug
// }

// function parseAugPlain (aplain) {
//   let pfirst = _.first(aplain)
//   let second = aplain[1]
//   let uisyms = ['υ', 'ι']
//   let aug
//   if (vowels.includes(pfirst)) {
//     if (uisyms.includes(second)) aug = aplain.slice(0,2)
//     else aug = aplain.slice(0,1)
//   }
//   if (!aug) aug = ''
//   // log('_________________aplain, aug', aplain, pfirst, second, ':', aug)
//   return aug
// }

// function parseAug_WKT (aplain) {
//   let pfirst = _.first(aplain)
//   let second = aplain[1]
//   let uisyms = ['υ', 'ι']
//   let aug
//   if (vowels.includes(pfirst)) {
//     if (uisyms.includes(second)) aug = aplain.slice(0,3)
//     else if (asps.includes(second)) aug = aplain.slice(0,2) // aspiration
//     else aug = aplain.slice(0,1)
//   }
//   if (!aug) aug = ''
//   // log('_________________aplain, aug', aplain, pfirst, second, ':', aug)
//   return aug
// }
