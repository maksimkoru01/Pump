const { expectRevert, time } = require('@openzeppelin/test-helpers');

async function getReceiptOrReason (promise, reason = undefined) {
  if (reason) {
    await expectRevert(promise, reason);
    return undefined;
  } else {
    const { receipt } = await promise;
    return receipt;
  }
}

function runGovernorWorkflow () {
  beforeEach(async () => {
    this.receipts = {};
    this.id = await this.governor.hashProposal(...this.settings.proposal.slice(0, -1));
  });

  it('run', async () => {
    // transfer tokens
    if (this.settings?.voters) {
      for (const voter of this.settings.voters) {
        if (voter.weight) {
          await this.token.transfer(voter.address, voter.weight, { from: this.settings.tokenHolder });
        }
      }
    }

    // propose
    if (this.settings?.steps?.propose?.enable != false) {
      this.receipts.propose = await getReceiptOrReason(
        this.governor.propose(...this.settings.proposal),
        this.settings?.steps?.propose?.reason,
      );
      if (this.settings?.steps?.propose?.delay) {
        await time.increase(this.settings?.steps?.propose?.delay);
      }
    }

    // vote
    if (this.settings?.voters) {
      this.receipts.castVote = [];
      for (const voter of this.settings.voters) {
        if (!voter.signature) {
          this.receipts.castVote.push(
            await getReceiptOrReason(
              this.governor.castVote(this.id, voter.support, { from: voter.address }),
              voter.reason,
            ),
          );
        } else {
          const { signature, v, r, s } = await voter.signature({ proposalId: this.id, support: voter.support });
          this.receipts.castVote.push(
            await getReceiptOrReason(
              this.governor.castVoteBySig(this.id, voter.support, v, r, s),
              voter.reason,
            ),
          );
        }
        if (voter?.delay) {
          await time.increase(voter?.delay);
        }
      }
    }

    // fast forward
    ({ deadline: this.deadline } = await this.governor.viewProposal(this.id));
    if (this.settings?.steps?.wait?.enable != false) {
      await time.increaseTo(this.deadline.addn(1));
    }

    // queue (off by default)
    if (this.settings?.steps?.queue?.enable == true) {
      this.receipts.queue = await getReceiptOrReason(
        this.governor.queue(...this.settings.proposal.slice(0, -1)),
        this.settings?.steps?.queue?.reason,
      );
      if (this.settings?.steps?.queue?.delay) {
        await time.increase(this.settings?.steps?.queue?.delay);
      }
    }

    // execute
    if (this.settings?.steps?.execute?.enable != false) {
      this.receipts.execute = await getReceiptOrReason(
        this.governor.execute(...this.settings.proposal.slice(0, -1)),
        this.settings?.steps?.execute?.reason,
      );
      if (this.settings?.steps?.execute?.delay) {
        await time.increase(this.settings?.steps?.execute?.delay);
      }
    }
  });

  afterEach(async () => {
    if(this.settings.after) { throw new Error('GOT AFTER'); }
  });
}

module.exports = {
  runGovernorWorkflow,
};
