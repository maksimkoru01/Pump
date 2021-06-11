const { toEthSignedMessageHash } = require('../../helpers/sign');

const { expect } = require('chai');

const SignatureChecker = artifacts.require('XSignatureChecker');
const ERC1271WalletMock = artifacts.require('ERC1271WalletMock');

const TEST_MESSAGE = web3.utils.sha3('OpenZeppelin');
const WRONG_MESSAGE = web3.utils.sha3('Nope');

contract('SignatureChecker (ERC1271)', function (accounts) {
  const [signer, other] = accounts;

  before('deploying', async function () {
    this.signaturechecker = await SignatureChecker.new();
    this.wallet = await ERC1271WalletMock.new(signer);
    this.signature = await web3.eth.sign(TEST_MESSAGE, signer);
  });

  context('EOA account', function () {
    it('with matching signer and signature', async function () {
      expect(await this.signaturechecker.xisValidSignatureNow(
        signer,
        toEthSignedMessageHash(TEST_MESSAGE),
        this.signature,
      )).to.equal(true);
    });

    it('with invalid signer', async function () {
      expect(await this.signaturechecker.xisValidSignatureNow(
        other,
        toEthSignedMessageHash(TEST_MESSAGE),
        this.signature,
      )).to.equal(false);
    });

    it('with invalid signature', async function () {
      expect(await this.signaturechecker.xisValidSignatureNow(
        signer,
        toEthSignedMessageHash(WRONG_MESSAGE),
        this.signature,
      )).to.equal(false);
    });
  });

  context('ERC1271 wallet', function () {
    it('with matching signer and signature', async function () {
      expect(await this.signaturechecker.xisValidSignatureNow(
        this.wallet.address,
        toEthSignedMessageHash(TEST_MESSAGE),
        this.signature,
      )).to.equal(true);
    });

    it('with invalid signer', async function () {
      expect(await this.signaturechecker.xisValidSignatureNow(
        this.signaturechecker.address,
        toEthSignedMessageHash(TEST_MESSAGE),
        this.signature,
      )).to.equal(false);
    });

    it('with invalid signature', async function () {
      expect(await this.signaturechecker.xisValidSignatureNow(
        this.wallet.address,
        toEthSignedMessageHash(WRONG_MESSAGE),
        this.signature,
      )).to.equal(false);
    });
  });
});
