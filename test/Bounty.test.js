import toPromise from './helpers/toPromise';

let sendReward = function (sender, receiver, value) {
  web3.eth.sendTransaction({
    from: sender,
    to: receiver,
    value: value,
  });
};
var SecureTargetBounty = artifacts.require('SecureTargetBounty');
var InsecureTargetBounty = artifacts.require('InsecureTargetBounty');

function awaitEvent (event, handler) {
  return new Promise((resolve, reject) => {
    function wrappedHandler (...args) {
      Promise.resolve(handler(...args)).then(resolve).catch(reject);
    }

    event.watch(wrappedHandler);
  });
}

contract('Bounty', function (accounts) {
  it('sets reward', async function () {
    let owner = accounts[0];
    let reward = web3.toWei(1, 'ether');
    let bounty = await SecureTargetBounty.new();
    await sendReward(owner, bounty.address, reward);

    const balance = await toPromise(web3.eth.getBalance)(bounty.address);
    assert.equal(reward, balance.toNumber());
  });

  it('empties itself when destroyed', async function () {
    let owner = accounts[0];
    let reward = web3.toWei(1, 'ether');
    let bounty = await SecureTargetBounty.new();
    await sendReward(owner, bounty.address, reward);

    const balance = await toPromise(web3.eth.getBalance)(bounty.address);
    assert.equal(reward, balance.toNumber());

    await bounty.destroy();
    const updatedBalance = await toPromise(web3.eth.getBalance)(bounty.address);
    assert.equal(0, updatedBalance.toNumber());
  });

  describe('Against secure contract', function () {
    it('cannot claim reward', async function () {
      let owner = accounts[0];
      let researcher = accounts[1];
      let reward = web3.toWei(1, 'ether');
      let bounty = await SecureTargetBounty.new();
      let event = bounty.TargetCreated({});

      let watcher = async function (err, result) {
        event.stopWatching();
        if (err) { throw err; }

        var targetAddress = result.args.createdAddress;
        await sendReward(owner, bounty.address, reward);

        const balance = await toPromise(web3.eth.getBalance)(bounty.address);
        assert.equal(reward, balance.toNumber());

        try {
          await bounty.claim(targetAddress, { from: researcher });
          assert.isTrue(false); // should never reach here
        } catch (error) {
          let reClaimedBounty = await bounty.claimed.call();
          assert.isFalse(reClaimedBounty);
        }
        try {
          await bounty.withdrawPayments({ from: researcher });
          assert.isTrue(false); // should never reach here
        } catch (err) {
          const updatedBalance = await toPromise(web3.eth.getBalance)(bounty.address);
          assert.equal(reward, updatedBalance.toNumber());
        }
      };
      await bounty.createTarget({ from: researcher });
      await awaitEvent(event, watcher);
    });
  });

  describe('Against broken contract', function () {
    it('claims reward', async function () {
      let owner = accounts[0];
      let researcher = accounts[1];
      let reward = web3.toWei(1, 'ether');
      let bounty = await InsecureTargetBounty.new();
      let event = bounty.TargetCreated({});

      let watcher = async function (err, result) {
        event.stopWatching();
        if (err) { throw err; }
        let targetAddress = result.args.createdAddress;
        await sendReward(owner, bounty.address, reward);

        const balance = await toPromise(web3.eth.getBalance)(bounty.address);
        assert.equal(reward, balance.toNumber());

        await bounty.claim(targetAddress, { from: researcher });
        let claim = await bounty.claimed.call();

        assert.isTrue(claim);

        await bounty.withdrawPayments({ from: researcher });
        const updatedBalance = await toPromise(web3.eth.getBalance)(bounty.address);
        assert.equal(0, updatedBalance.toNumber());
      };
      await bounty.createTarget({ from: researcher });
      await awaitEvent(event, watcher);
    });
  });
});
