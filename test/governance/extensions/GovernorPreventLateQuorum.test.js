const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const Enums = require('../../helpers/enums');
const { GovernorHelper } = require('../../helpers/governance');

const Token = artifacts.require('ERC20VotesCompMock');
const Governor = artifacts.require('GovernorPreventLateQuorumMock');
const CallReceiver = artifacts.require('CallReceiverMock');

contract('GovernorPreventLateQuorum', function (accounts) {
  const [owner, proposer, voter1, voter2, voter3, voter4] = accounts;

  const name = 'OZ-Governor';
  // const version = '1';
  const tokenName = 'MockToken';
  const tokenSymbol = 'MTKN';
  const tokenSupply = web3.utils.toWei('100');
  const votingDelay = new BN(4);
  const votingPeriod = new BN(16);
  const lateQuorumVoteExtension = new BN(8);
  const quorum = web3.utils.toWei('1');
  const value = web3.utils.toWei('1');

  beforeEach(async function () {
    this.owner = owner;
    this.token = await Token.new(tokenName, tokenSymbol);
    this.mock = await Governor.new(
      name,
      this.token.address,
      votingDelay,
      votingPeriod,
      quorum,
      lateQuorumVoteExtension,
    );
    this.receiver = await CallReceiver.new();

    this.helper = new GovernorHelper(this.mock);

    await web3.eth.sendTransaction({ from: owner, to: this.mock.address, value });

    await this.token.mint(owner, tokenSupply);
    await this.helper.delegate(
      { token: this.token, to: voter1, value: web3.utils.toWei('10') },
      { from: owner },
    );
    await this.helper.delegate(
      { token: this.token, to: voter2, value: web3.utils.toWei('7') },
      { from: owner },
    );
    await this.helper.delegate(
      { token: this.token, to: voter3, value: web3.utils.toWei('5') },
      { from: owner },
    );
    await this.helper.delegate(
      { token: this.token, to: voter4, value: web3.utils.toWei('2') },
      { from: owner },
    );

    // default proposal
    this.proposal = this.helper.setProposal(
      [
        {
          target: this.receiver.address,
          value,
          data: this.receiver.contract.methods.mockFunction().encodeABI(),
        },
      ],
      '<proposal description>',
    );
  });

  it('deployment check', async function () {
    expect(await this.mock.name()).to.be.equal(name);
    expect(await this.mock.token()).to.be.equal(this.token.address);
    expect(await this.mock.votingDelay()).to.be.bignumber.equal(votingDelay);
    expect(await this.mock.votingPeriod()).to.be.bignumber.equal(votingPeriod);
    expect(await this.mock.quorum(0)).to.be.bignumber.equal(quorum);
    expect(await this.mock.lateQuorumVoteExtension()).to.be.bignumber.equal(
      lateQuorumVoteExtension,
    );
  });

  it('nominal workflow unaffected', async function () {
    const txPropose = await this.helper.propose({ from: proposer });
    await this.helper.waitForSnapshot();
    await this.helper.vote({ support: Enums.VoteType.For }, { from: voter1 });
    await this.helper.vote({ support: Enums.VoteType.For }, { from: voter2 });
    await this.helper.vote({ support: Enums.VoteType.Against }, { from: voter3 });
    await this.helper.vote({ support: Enums.VoteType.Abstain }, { from: voter4 });
    await this.helper.waitForDeadline();
    await this.helper.execute();

    expect(await this.mock.hasVoted(this.proposal.id, owner)).to.be.equal(false);
    expect(await this.mock.hasVoted(this.proposal.id, voter1)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.proposal.id, voter2)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.proposal.id, voter3)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.proposal.id, voter4)).to.be.equal(true);

    await this.mock.proposalVotes(this.proposal.id).then(results => {
      expect(results.forVotes).to.be.bignumber.equal(web3.utils.toWei('17'));
      expect(results.againstVotes).to.be.bignumber.equal(web3.utils.toWei('5'));
      expect(results.abstainVotes).to.be.bignumber.equal(web3.utils.toWei('2'));
    });

    const startBlock = new BN(txPropose.receipt.blockNumber).add(votingDelay);
    const endBlock = new BN(txPropose.receipt.blockNumber).add(votingDelay).add(votingPeriod);
    expect(await this.mock.proposalSnapshot(this.proposal.id)).to.be.bignumber.equal(startBlock);
    expect(await this.mock.proposalDeadline(this.proposal.id)).to.be.bignumber.equal(endBlock);

    expectEvent(txPropose, 'ProposalCreated', {
      proposalId: this.proposal.id,
      proposer,
      targets: this.proposal.targets,
      // values: this.proposal.values.map(value => new BN(value)),
      signatures: this.proposal.signatures,
      calldatas: this.proposal.data,
      startBlock,
      endBlock,
      description: this.proposal.description,
    });
  });

  it('Delay is extended to prevent last minute take-over', async function () {
    const txPropose = await this.helper.propose({ from: proposer });

    // compute original schedule
    const startBlock = new BN(txPropose.receipt.blockNumber).add(votingDelay);
    const endBlock = new BN(txPropose.receipt.blockNumber).add(votingDelay).add(votingPeriod);
    expect(await this.mock.proposalSnapshot(this.proposal.id)).to.be.bignumber.equal(startBlock);
    expect(await this.mock.proposalDeadline(this.proposal.id)).to.be.bignumber.equal(endBlock);

    // wait for the last minute to vote
    await this.helper.waitForDeadline(-1);
    const txVote = await this.helper.vote({ support: Enums.VoteType.For }, { from: voter2 });

    // cannot execute yet
    expect(await this.mock.state(this.proposal.id)).to.be.bignumber.equal(
      Enums.ProposalState.Active,
    );

    // compute new extended schedule
    const extendedDeadline = new BN(txVote.receipt.blockNumber).add(lateQuorumVoteExtension);
    expect(await this.mock.proposalSnapshot(this.proposal.id)).to.be.bignumber.equal(startBlock);
    expect(await this.mock.proposalDeadline(this.proposal.id)).to.be.bignumber.equal(
      extendedDeadline,
    );

    // still possible to vote
    await this.helper.vote({ support: Enums.VoteType.Against }, { from: voter1 });

    await this.helper.waitForDeadline();
    expect(await this.mock.state(this.proposal.id)).to.be.bignumber.equal(
      Enums.ProposalState.Active,
    );
    await this.helper.waitForDeadline(+1);
    expect(await this.mock.state(this.proposal.id)).to.be.bignumber.equal(
      Enums.ProposalState.Defeated,
    );

    // check extension event
    expectEvent(txVote, 'ProposalExtended', { proposalId: this.proposal.id, extendedDeadline });
  });

  describe('onlyGovernance updates', function () {
    it('setLateQuorumVoteExtension is protected', async function () {
      await expectRevert(this.mock.setLateQuorumVoteExtension(0), 'Governor: onlyGovernance');
    });

    it('can setLateQuorumVoteExtension through governance', async function () {
      this.helper.setProposal(
        [
          {
            target: this.mock.address,
            data: this.mock.contract.methods.setLateQuorumVoteExtension('0').encodeABI(),
          },
        ],
        '<proposal description>',
      );

      await this.helper.propose();
      await this.helper.waitForSnapshot();
      await this.helper.vote({ support: Enums.VoteType.For }, { from: voter1 });
      await this.helper.waitForDeadline();

      expectEvent(await this.helper.execute(), 'LateQuorumVoteExtensionSet', {
        oldVoteExtension: lateQuorumVoteExtension,
        newVoteExtension: '0',
      });

      expect(await this.mock.lateQuorumVoteExtension()).to.be.bignumber.equal('0');
    });
  });
});
