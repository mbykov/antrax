var _ = require('underscore');

module.exports = utils();

function utils() {
    if (!(this instanceof utils)) return new utils();
    return this;
}

utils.prototype.clean = function(str) {
    return 'CLEAN'
}

utils.prototype.const = {
    'a': 'a1',
    'b': 'a2'
}

let modCorr = {}

modCorr['act.pres.ind'] = ['act.pres.ind', 'act.pres.opt', 'act.pres.sub', 'act.pres.imp', 'mid-pass.pres.ind', 'mid-pass.pres.opt', 'mid-pass.pres.sub', 'mid-pass.pres.imp', 'act.impf.ind', 'mid-pass.impf.ind', 'act.pres.inf', 'mid.pres.inf']

modCorr['act.fut.ind'] = ['act.fut.ind', 'act.fut.opt', 'mid.fut.ind', 'mid.fut.opt', 'pass.fut.ind', 'pass.fut.opt', 'act.fut.inf', 'mid.fut.inf']

utils.prototype.modCorr = modCorr

let augmods = ['act.impf.ind', 'mid-pass.impf.ind', 'act.aor.ind', 'mid-pass.aor.ind', 'act.ppf.ind', 'mid-pass.ppf.ind', 'pass.aor.ind', '', '', '', '', '', '', '', ]

utils.prototype.augmods = augmods

let augs = ['ἐ', 'ἔ', '']

utils.prototype.augs = augs
