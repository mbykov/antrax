//
let util = require('util')

const ac = {
  'oxia': '\u0301',
  'varia': '\u0060',
  'peris': '\u0342',
  '': '',
  'psili': '\u0313',
  'dasia': '\u0314',
  '': '',
  'ypo': '\u0345',
  '': ''
}

// const vows = ['α', 'ι', 'ε', 'ο', 'ω', 'η', 'υ']

// TODO: экспортировать сразу функцию?

export const accents = ac

export const mutes =
  () => ['ψ', 'ξ']

// export const vowels =
  // () => ['α', 'ε', 'ι', 'ο', 'ω', 'η', 'υ']

export const contrs  = {
  'ew': ['ε', ac.oxia, 'ω'].join(''),
  'aw': ['α', ac.oxia, 'ω'].join(''),
  'ow': ['ο', ac.oxia, 'ω'].join('')
}


export const vowels =  ['α', 'ε', 'ι', 'ο', 'ω', 'η', 'υ']

// export const eaug = 'ἐ'
export const eaug = 'ε'

// ᾔνουν - αἰνέω
// export const weaks = {'η': 'α', 'ω': 'ο', 'ῃ': 'ᾳ', '': '', '': ''}
export const weaks = {
  'α': ['η'],
  'αι': ['ῃ'],
  'ανα': ['ανε', 'ανη'],
  'αν': ['ανε'],
  'απα': ['απη'],
  // 'αστ': ['ανεστ'],

  'απαι': ['απῃ'],
  'απε': ['απει'],
  'απο': ['απε', 'απω'],
  'αφαι': ['αφῃ'],
  'αφο': ['αφω'],
  'αρα': ['ηρα'],
  'ε': ['η'],
  'δια': ['διε', 'διη'],
  'διε': ['διη'],
  'διαι': ['διῃ'],
  'εισε': ['ειση'],
  'εκ': ['εξε'],
  'εκρ': ['εξερρ'],
  'εξα': ['εξη'],
  'εξε': ['εξη'],
  'εν': ['ενε'],
  'επεν': ['επενε'],
  'εμ': ['ενε'],

  'επα': ['επη'],
  'επαι': ['επῃ'],
  'επι': ['επε', 'επει'],
  'επε': ['επι', 'επη'],
  'επο': ['επω'],
  'ευα': ['ευη'],

  'η': ['ε'], // ηὗρον

  'κατα': ['κατε', 'κατη'],
  'κατοι': ['κατῳ'],
  'μετα': ['μετε'],
  'ο': ['ω'],
  'οι': ['ῳ'],
  'παρα': ['παρε'],
  'παρε': ['παρη'],
  'περι': ['περιε'],
  'περιε': ['περιη'],
  'προσ': ['προσε'],

  'προσα': ['προση'],
  'προσε': ['προση', 'προσ'],
  'προ': ['προε'],
  'ρ': ['ερρ'],
  'συνε': ['συνη', 'συνει', 'συγ', 'συλ', 'συμ'],
  'συλ': ['συνε'],
  'συμ': ['συνε'],
  'συσ': ['συνε'],
  'συγ': ['συνε'],
  'συνη': ['συνα'], // συνήγαγον - συναγόγον - to fake
  'υπα': ['υπη'],
  'υπο': ['υπε'],
  '': [''],
  '': [''],
  '': [''],
  '': [''],
  '': [''],
  '': [''],
  '': [''],
  '': [''],
  '': ['']
}


export const strongs = {'η': 'α', 'ω': 'ο', 'ᾐ': 'αι', '': '', '': '', '': ''}

export const affixes = {
  'διε': 'δια',
  'διῃ': 'διαι',
  'διη': 'δια',
  'διῳ': 'διοι',
  'εξε': 'εκ',
  'εξερρ': 'εκρ',
  'εξεκ': 'εκ',
  '': '',
  '': '',
  '': ''
}


// ᾀδοίτην


// εἰ
export const apiaugs = [
  ['α', ac.psili].join(''),
  ['α', ac.dasia].join(''),
  ['αι', ac.psili].join(''),
  ['αι', ac.dasia].join(''),
  ['αυ', ac.psili].join(''),
  ['αυ', ac.dasia].join(''),

  ['ε', ac.psili].join(''),
  ['ε', ac.dasia].join(''),
  ['ει', ac.psili].join(''),
  ['ει', ac.dasia].join(''),
  ['ευ', ac.psili].join(''),
  ['ευ', ac.dasia].join(''),

  ['ο', ac.psili].join(''),
  ['ο', ac.dasia].join(''),
  ['οι', ac.psili].join(''),
  ['οι', ac.dasia].join(''),
  ['ου', ac.psili].join(''),
  ['ου', ac.dasia].join(''),

  ['ι', ac.psili].join(''),
  ['ι', ac.dasia].join(''),
  ['υ', ac.psili].join(''),
  ['υ', ac.dasia].join(''),

  ['ω', ac.psili].join(''),
  ['ω', ac.dasia].join(''),
  ['η', ac.psili].join(''),
  ['η', ac.psili, ac.ypo].join(''),
  ['η', ac.dasia].join(''),

  // ['', ac.psili].join(''),
  // ['', ac.dasia].join(''),
  // ['', ac.psili].join(''),
  // ['', ac.dasia].join('')
    ]

export const augs = {
  'X̓': 'ἐ',
  'ἀ': 'ἀ ἠ',
  'ἠ': 'ἠ ἀ',
  'ἡ': 'ἡ',
  'ὁ': 'ὁ ὡ',
  'ὡ': 'ὁ ὡ',
  'ᾐ': 'αἰ'
}

// export const augplains = {
//   'ε': 'X',
//   'α': 'α η',
//   'η': 'η',
//   'ο': 'ο ω'
// }

// export const augs_ = [
//   ['ω', ac.psili].join(''),
//   ['ω', ac.dasia].join(''),
//   ['η', ac.psili].join(''),
//   ['η', ac.psili, ac.ypo].join(''),
//   ['η', ac.dasia].join(''),

//   // ['', ac.psili].join(''),
//   // ['', ac.dasia].join(''),
//   // ['', ac.psili].join(''),
//   // ['', ac.dasia].join('')
// ]

export const augmods = ['act.impf.ind', 'mp.impf.ind', 'act.aor.ind', 'mid.aor.ind', 'act.ppf.ind', 'mp.ppf.ind', 'pas.aor.ind']
//
// mp.pf.ind - στέλλω - ἔσταλμαι - has augment, exeption

export const apicompats = ['act.pres.ind', 'act.fut.ind', 'act.impf.ind','mp.pres.ind','mp.impf.ind','act.pres.sub','mp.pres.sub','mp.pres.opt', 'act.pres.opt', 'act.pres.imp', 'mp.pres.imp', 'mid.fut.ind', 'act.fut.opt', 'mid.fut.opt', 'act.aor.ind', 'mid.aor.ind', 'act.aor.sub', 'mid.aor.sub', 'act.aor.opt', 'mid.aor.opt', 'act.aor.imp', 'mid.aor.imp', 'pas.aor.ind', 'pas.fut.ind', 'pas.fut.opt', 'pas.aor.sub', '', '', '']


export const time =
  (vrnt) => { return vrnt.split('.')[1] }

export const voice =
  (vrnt) => { return vrnt.split('.')[0] }

export const mood =
  (vrnt) => { return vrnt.split('.')[2] }

// export const startWith =
  // (str) => { return vrnt.split('.')[2] }



let print = process.argv.slice(3)[0]

// if (process.env.NODE_ENV === 'test')
export function log () {
  if (print == 'log') console.log.apply(console, arguments)
}

export function plog () {
  var vs = _.values(arguments)
  if (vs.length === 1) vs = vs[0]
  // console.log(util.inspect(vs, {showHidden: false, depth: null}))
  console.log(util.inspect(vs, {showHidden: false, depth: 3}))
}
