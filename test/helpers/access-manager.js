const { time } = require('@openzeppelin/test-helpers');
const { MAX_UINT64 } = require('./constants');

function buildBaseRoles() {
  const roles = {
    ADMIN: {
      id: web3.utils.toBN(0),
    },
    SOME_ADMIN: {
      id: web3.utils.toBN(17),
    },
    SOME_GUARDIAN: {
      id: web3.utils.toBN(35),
    },
    SOME: {
      id: web3.utils.toBN(42),
    },
    PUBLIC: {
      id: MAX_UINT64,
    },
  };

  // Names
  Object.assign(roles, Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, { ...v, name: k }])));

  // Defaults
  for (const role of Object.keys(roles)) {
    roles[role].admin = roles.ADMIN;
    roles[role].guardian = roles.ADMIN;
  }

  // Admins
  roles.SOME.admin = roles.SOME_ADMIN;

  // Guardians
  roles.SOME.guardian = roles.SOME_GUARDIAN;

  return roles;
}

const formatAccess = access => [access[0], access[1].toString()];

const MINSETBACK = time.duration.days(5);
const EXPIRATION = time.duration.weeks(1);

module.exports = {
  buildBaseRoles,
  formatAccess,
  MINSETBACK,
  EXPIRATION,
};