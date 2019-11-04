const { accounts, load } = require('@openzeppelin/test-env');
const [ owner, payee, ...otherAccounts ] = accounts;

const { ether, expectRevert } = require('@openzeppelin/test-helpers');
const { shouldBehaveLikeEscrow } = require('./Escrow.behavior');

const ConditionalEscrowMock = load.truffle('ConditionalEscrowMock');

describe('ConditionalEscrow', function () {
  beforeEach(async function () {
    this.escrow = await ConditionalEscrowMock.new({ from: owner });
  });

  context('when withdrawal is allowed', function () {
    beforeEach(async function () {
      await Promise.all(otherAccounts.map(payee => this.escrow.setAllowed(payee, true)));
    });

    shouldBehaveLikeEscrow(owner, otherAccounts);
  });

  context('when withdrawal is disallowed', function () {
    const amount = ether('23');

    beforeEach(async function () {
      await this.escrow.setAllowed(payee, false);
    });

    it('reverts on withdrawals', async function () {
      await this.escrow.deposit(payee, { from: owner, value: amount });

      await expectRevert(this.escrow.withdraw(payee, { from: owner }),
        'ConditionalEscrow: payee is not allowed to withdraw'
      );
    });
  });
});
