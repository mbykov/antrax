import { dbg as clog, time } from './utils'
import _ from 'lodash'
import { verbkeys } from './verb-reg-keys'
import { namekeys } from './name-reg-keys'
const d = require('debug')('app')

let log = console.log

// verbs строятся по разным stems, т.е. один verb может порождать один chain по разным stems :
export function parseVerb (verbs, flexes, only) {

  let vdicts = []
  verbs.forEach(dict => {

    if (dict.augs) throw new Error('DICT-AUGS!') // :NB:

    // βραχυνομένῳ - lsj - это ужас, но работает. Нужно привести в порядок    // // нужно проверить - κλίνεσθαι
    if (!dict.keys && dict.key) dict.keys = verbkeys[dict.key] || [] // lsj, etc
    if (dict.plain == only) d('VERB-d ===========================>>>', dict.rdict, 'key:', dict.key, 'dict.keys:', dict.keys.length)

    let fls = _.map(flexes, flex => {
      // if (dict.plain == only) d('verb-flex ----------------', flex.term, flex.tense, flex.key)

      let dkey = _.find(dict.keys, dkey=> { return dkey.key == flex.key && dkey.tense == flex.tense })

      // то есть если для глаголов хороший набор флексий, есть все с аугментами, то для причастий примеров склонения мало. И флексии с нужным
      // аугментом попросту нет. Возможен костыль, но тогда здесь нужны флексии прилагательных:
      // сделать только для part, -- добавить parsePart - возможно возникновение лишних результатов
      // if (!dkey) dkey = _.find(dict.keys, dkey=> { return dkey.key == flex.key })

      if (!dkey) return
      if (dict.plain == only) d('verb-DKEY-flex ------------------------', dict.rdict, dkey, flex.key)

      let cflex
      // if (flex.numcase) cflex = { tense: flex.tense, numcase: flex.numcase, gend: flex.gend, voice: flex.voice, dictpkeys: JSON.stringify(dict.pkeys), pkey: flex.pkey }
      if (flex.numcase) cflex = { tense: flex.tense, numcase: flex.numcase, gend: flex.gend }
      else if (flex.numper) cflex = { tense: flex.tense, numper: flex.numper }
      // else if (flex.numper) cflex = { tense: flex.tense, numper: flex.numper, dictpkeys: JSON.stringify(dict.vkeys), pkey: flex.vkey }
      // else  cflex = { tense: flex.tense, adv: flex.adv }
      return cflex
    })

    fls = _.compact(fls) // map, not filter!
    if (dict.plain == only) d('NC-FLS =========>>>', dict.rdict, fls.length)
    if (!fls.length) return

    let cfls = []
    let keyfls = {}
    _.flatten(fls).forEach(flex=> {
      let keyflex = JSON.stringify(flex)
      if (keyfls[keyflex]) return
      cfls.push(flex)
      keyfls[keyflex] = true
    })
    dict.fls = cfls
    // d('______________________>>>', dict.rdict)
    vdicts.push(dict)
  })
  return vdicts
}

// NAME
export function parseName (names, flexes, only) {
  let ndicts = []
  // let nnames = _.filter(names, dict => { return dict.name })
  // let nflexes = _.filter(flexes, flex => { return flex.name })

  names.forEach(dict => {
    // log('_________________________________________________________________________D', dict.rdict, dict.plain)
    if (dict.plain == only) d('NAME-d ===========================>>>', dict.rdict)
    /*
      key - проверяется, но не обязательно. Сколько плохих значений возникнет?
      или - сделать это только в компаундах? Где меняется ударение, и правильная флексия может отсутствовать. И вообще меняется склонение
    */
    // if (dict.key && !dict.keys) dict.keys = namekeys[dict.key]
    // if (dict.key && !dict.keys) log('_________________________________')

    let fls = _.filter(flexes, flex => {
      // if (dict.plain == only) log('NAME-f -------------->', flex)
      let fkey = flex.key.split('-')[0]
      // if (!dict.gends && dict.key && dict.key != fkey) return false
      if (!dict.gends && dict.key && dict.key != flex.key && dict.key != fkey) return false // corr. - στατικός
      if (dict.gends && !dict.gends.includes(flex.gend)) return false
      // if (flex.adv) dict.pos = 'adv'
      // это неясно, правильно ли, т.е. всегда ли, на все ли dict нужно навесить pos=adv

      return true
    })

    if (dict.plain == only) d('NAME-flex.size ===========================>>>', fls.length)
    if (!fls.length) return

    // непонятно, как избавиться от лишних значений adj в ἡμισέως, т.е. adv: - или пропадет значение при совпадении adv и adj?
    let advfls = _.filter(fls, fl=> { return fl.adv })
    // if (advfls.length) fls = advfls

    // добавить в dict и потом отбросить лишние dicts, если есть exacts
    let exactfls
    let ksize = dict.key.split('-').length
    let keys
    if (ksize == 1) keys = namekeys[dict.key], exactfls = _.filter(fls, flex=> { return keys.includes(flex.key) })
    else exactfls = _.filter(fls, flex=> { return dict.key == flex.key })

    // log('__KEYS', dict.key, dict.keys)
    if (!exactfls.length && dict.plain.length < 3) return // плохие значения от одной буквы в стеме, типа ἰσθμός = ἰσθ + μ

    if (exactfls.length) fls = exactfls
    else dict.possible = true

    dict.fls = compactNameFls(fls, exactfls.length)
    ndicts.push(dict)
    // log('___ DICT', dict.rdict, dict.fls.length)
  })

  // log('___________________ EXDICTS', ndicts.length)
  let exdicts = _.filter(ndicts, dict=> { return !dict.possible })
  if (exdicts) ndicts = exdicts
  // log('________________ NDICTS', ndicts.length)
  return ndicts
}

function compactNameFls(fls, exact) {
  let cleanfls = []
  let flkey = {}
  fls.forEach(flex=> {
    let clflex
    // if (flex.adv) clflex = { adv: true, term: flex.term, degree: flex.degree } // только для тестов
    // else clflex = { name: true, term: flex.term, numcase: flex.numcase }
    if (flex.adv) clflex = { degree: flex.degree }
    else clflex = { numcase: flex.numcase }
    if (flex.gend) clflex.gend = flex.gend
    if (!exact) clflex.possible = true
    let flexkey = [clflex.gend, clflex.numcase].join('-')
    if (flkey[flexkey]) return
    cleanfls.push(clflex)
    flkey[flexkey] = true
  })
  return cleanfls
}


// export function parsePart_ (verbs, flexes) {
// }
