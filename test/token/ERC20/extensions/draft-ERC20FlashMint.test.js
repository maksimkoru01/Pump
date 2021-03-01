/* eslint-disable */

const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { MAX_UINT256, ZERO_ADDRESS, ZERO_BYTES32 } = constants;

const ERC20FlashMintMock = artifacts.require('ERC20FlashMintMock');
const ERC3156FlashBorrowerMock = artifacts.require('ERC3156FlashBorrowerMock');

contract('ERC20FlashMint', function (accounts) {
  const [ initialHolder, other ] = accounts;

  const name = 'My Token';
  const symbol = 'MTKN';

  const initialSupply = new BN(100);
  const loanAmount = new BN(10000000000000);

  beforeEach(async function () {
    this.token = await ERC20FlashMintMock.new(name, symbol, initialHolder, initialSupply);
  });

  describe('maxFlashLoan', function () {
    it('token match', async function () {
      expect(await this.token.maxFlashLoan(this.token.address)).to.be.bignumber.equal(MAX_UINT256.sub(initialSupply));
    });

    it('token missmatch', async function () {
      expect(await this.token.maxFlashLoan(ZERO_ADDRESS)).to.be.bignumber.equal('0');
    });
  });

  describe('flashFee', function () {
    it('token match', async function () {
      expect(await this.token.flashFee(this.token.address, loanAmount)).to.be.bignumber.equal('0');
    });

    it('token missmatch', async function () {
      expect(await this.token.flashFee(ZERO_ADDRESS, loanAmount)).to.be.bignumber.equal('0');
    });
  });

  describe('flashLoan', function () {
    it('success', async function () {
      const receiver = await ERC3156FlashBorrowerMock.new(true, true);
      const { tx } = await this.token.flashLoan(receiver.address, this.token.address, loanAmount, '0x');

      expectEvent.inTransaction(tx, this.token, 'Transfer', { from: ZERO_ADDRESS, to: receiver.address, value: loanAmount });
      expectEvent.inTransaction(tx, this.token, 'Transfer', { from: receiver.address, to: ZERO_ADDRESS, value: loanAmount });
      expectEvent.inTransaction(tx, receiver, 'BalanceOf', { token: this.token.address, account: receiver.address, value: loanAmount });
      expectEvent.inTransaction(tx, receiver, 'TotalSupply', { token: this.token.address, value: initialSupply.add(loanAmount) });

      expect(await this.token.totalSupply()).to.be.bignumber.equal(initialSupply);
      expect(await this.token.balanceOf(receiver.address)).to.be.bignumber.equal('0');
      expect(await this.token.allowance(receiver.address, this.token.address)).to.be.bignumber.equal('0');
    });

    it ('missing return value', async function () {
      const receiver = await ERC3156FlashBorrowerMock.new(false, true);
      await expectRevert(
        this.token.flashLoan(receiver.address, this.token.address, loanAmount, '0x'),
        'ERC20FlashMint: invalid return value',
      );
    });

    it ('missing approval', async function () {
      const receiver = await ERC3156FlashBorrowerMock.new(true, false);
      await expectRevert(
        this.token.flashLoan(receiver.address, this.token.address, loanAmount, '0x'),
        'ERC20FlashMint: allowance does not allow refund',
      );
    });

    it ('unavailable funds', async function () {
      const receiver = await ERC3156FlashBorrowerMock.new(true, true);
      const data = this.token.contract.methods.transfer(other, 10).encodeABI();
      await expectRevert(
        this.token.flashLoan(receiver.address, this.token.address, loanAmount, data),
        'ERC20: burn amount exceeds balance',
      );
    });
  });
});
