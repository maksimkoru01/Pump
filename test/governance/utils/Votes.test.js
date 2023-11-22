const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const {
  bigint: { clockFromReceipt },
} = require('../../helpers/time');
const { shouldBehaveLikeVotes } = require('./Votes.behavior.new');
const { bigintSum: sum } = require('../../helpers/math');

require('array.prototype.at/auto');

const MODES = {
  blocknumber: '$VotesMock',
  timestamp: '$VotesTimestampMock',
};

const AMOUNTS = [ethers.parseEther('10000000'), 10n, 20n];

async function fixture() {
  const [delegator, delegatee, ...accounts] = await ethers.getSigners();

  const name = 'My Vote';
  const version = '1';

  const mocks = {};
  for (const [mode, artifact] of Object.entries(MODES)) {
    mocks[mode] = await ethers.deployContract(artifact, [name, version]);
  }

  return { delegator, delegatee, accounts, name, version, mocks };
}

describe('Votes', function () {
  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
    this.amounts = {};
    for (const [index, amount] of AMOUNTS.entries()) {
      this.amounts[this.accounts[index].address] = amount;
    }
  });

  for (const [mode] of Object.entries(MODES)) {
    describe(`vote with ${mode}`, function () {
      beforeEach(function () {
        this.votes = this.mocks[mode];
      });

      shouldBehaveLikeVotes(AMOUNTS, { mode, fungible: true });

      it('starts with zero votes', async function () {
        expect(await this.votes.getTotalSupply()).to.equal(0);
      });

      describe('performs voting operations', function () {
        beforeEach(async function () {
          this.txs = [];
          for (const [account, amount] of Object.entries(this.amounts)) {
            this.txs.push(await this.votes.$_mint(account, amount));
          }
        });

        it('reverts if block number >= current block', async function () {
          const lastTxTimepoint = await clockFromReceipt[mode](this.txs.at(-1));
          const clock = await this.votes.clock();
          await expect(this.votes.getPastTotalSupply(lastTxTimepoint))
            .to.be.revertedWithCustomError(this.votes, 'ERC5805FutureLookup')
            .withArgs(lastTxTimepoint, clock);
        });

        it('delegates', async function () {
          expect(await this.votes.getVotes(this.accounts[0])).to.equal(0n);
          expect(await this.votes.getVotes(this.accounts[1])).to.equal(0n);
          expect(await this.votes.delegates(this.accounts[0])).to.be.equal(ethers.ZeroAddress);
          expect(await this.votes.delegates(this.accounts[1])).to.be.equal(ethers.ZeroAddress);

          await this.votes.delegate(this.accounts[0], ethers.Typed.address(this.accounts[0]));

          expect(await this.votes.getVotes(this.accounts[0])).to.equal(this.amounts[this.accounts[0].address]);
          expect(await this.votes.getVotes(this.accounts[1])).to.equal(0n);
          expect(await this.votes.delegates(this.accounts[0])).to.be.equal(this.accounts[0].address);
          expect(await this.votes.delegates(this.accounts[1])).to.be.equal(ethers.ZeroAddress);

          await this.votes.delegate(this.accounts[1], ethers.Typed.address(this.accounts[0]));

          expect(await this.votes.getVotes(this.accounts[0])).to.equal(
            this.amounts[this.accounts[0].address] + this.amounts[this.accounts[1].address],
          );
          expect(await this.votes.getVotes(this.accounts[1])).to.equal(0n);
          expect(await this.votes.delegates(this.accounts[0])).to.be.equal(this.accounts[0].address);
          expect(await this.votes.delegates(this.accounts[1])).to.be.equal(this.accounts[0].address);
        });

        it('cross delegates', async function () {
          await this.votes.delegate(this.accounts[0], ethers.Typed.address(this.accounts[1].address));
          await this.votes.delegate(this.accounts[1], ethers.Typed.address(this.accounts[0].address));

          expect(await this.votes.getVotes(this.accounts[0])).to.equal(this.amounts[this.accounts[1].address]);
          expect(await this.votes.getVotes(this.accounts[1])).to.equal(this.amounts[this.accounts[0].address]);
        });

        it('returns total amount of votes', async function () {
          const totalSupply = sum(...Object.values(this.amounts));
          expect(await this.votes.getTotalSupply()).to.equal(totalSupply);
        });
      });
    });
  }
});
