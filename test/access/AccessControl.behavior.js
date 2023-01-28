const { expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { expect } = require('chai');

const { shouldSupportInterfaces } = require('../utils/introspection/SupportsInterface.behavior');

const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ROLE = web3.utils.soliditySha3('ROLE');
const OTHER_ROLE = web3.utils.soliditySha3('OTHER_ROLE');

function shouldBehaveLikeAccessControl(errorPrefix, admin, authorized, other, otherAdmin) {
  shouldSupportInterfaces(['AccessControl']);

  describe('default admin', function () {
    it('deployer has default admin role', async function () {
      expect(await this.accessControl.hasRole(DEFAULT_ADMIN_ROLE, admin)).to.equal(true);
    });

    it("other roles's admin is the default admin role", async function () {
      expect(await this.accessControl.getRoleAdmin(ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
    });

    it("default admin role's admin is itself", async function () {
      expect(await this.accessControl.getRoleAdmin(DEFAULT_ADMIN_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
    });
  });

  describe('granting', function () {
    beforeEach(async function () {
      await this.accessControl.grantRole(ROLE, authorized, { from: admin });
    });

    it('non-admin cannot grant role to other accounts', async function () {
      await expectRevert(
        this.accessControl.grantRole(ROLE, authorized, { from: other }),
        `${errorPrefix}: account ${other.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
      );
    });

    it('accounts can be granted a role multiple times', async function () {
      await this.accessControl.grantRole(ROLE, authorized, { from: admin });
      const receipt = await this.accessControl.grantRole(ROLE, authorized, { from: admin });
      expectEvent.notEmitted(receipt, 'RoleGranted');
    });
  });

  describe('revoking', function () {
    it('roles that are not had can be revoked', async function () {
      expect(await this.accessControl.hasRole(ROLE, authorized)).to.equal(false);

      const receipt = await this.accessControl.revokeRole(ROLE, authorized, { from: admin });
      expectEvent.notEmitted(receipt, 'RoleRevoked');
    });

    context('with granted role', function () {
      beforeEach(async function () {
        await this.accessControl.grantRole(ROLE, authorized, { from: admin });
      });

      it('admin can revoke role', async function () {
        const receipt = await this.accessControl.revokeRole(ROLE, authorized, { from: admin });
        expectEvent(receipt, 'RoleRevoked', { account: authorized, role: ROLE, sender: admin });

        expect(await this.accessControl.hasRole(ROLE, authorized)).to.equal(false);
      });

      it('non-admin cannot revoke role', async function () {
        await expectRevert(
          this.accessControl.revokeRole(ROLE, authorized, { from: other }),
          `${errorPrefix}: account ${other.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
        );
      });

      it('a role can be revoked multiple times', async function () {
        await this.accessControl.revokeRole(ROLE, authorized, { from: admin });

        const receipt = await this.accessControl.revokeRole(ROLE, authorized, { from: admin });
        expectEvent.notEmitted(receipt, 'RoleRevoked');
      });
    });
  });

  describe('renouncing', function () {
    it('roles that are not had can be renounced', async function () {
      const receipt = await this.accessControl.renounceRole(ROLE, authorized, { from: authorized });
      expectEvent.notEmitted(receipt, 'RoleRevoked');
    });

    context('with granted role', function () {
      beforeEach(async function () {
        await this.accessControl.grantRole(ROLE, authorized, { from: admin });
      });

      it('bearer can renounce role', async function () {
        const receipt = await this.accessControl.renounceRole(ROLE, authorized, { from: authorized });
        expectEvent(receipt, 'RoleRevoked', { account: authorized, role: ROLE, sender: authorized });

        expect(await this.accessControl.hasRole(ROLE, authorized)).to.equal(false);
      });

      it('only the sender can renounce their roles', async function () {
        await expectRevert(
          this.accessControl.renounceRole(ROLE, authorized, { from: admin }),
          `${errorPrefix}: can only renounce roles for self`,
        );
      });

      it('a role can be renounced multiple times', async function () {
        await this.accessControl.renounceRole(ROLE, authorized, { from: authorized });

        const receipt = await this.accessControl.renounceRole(ROLE, authorized, { from: authorized });
        expectEvent.notEmitted(receipt, 'RoleRevoked');
      });
    });
  });

  describe('setting role admin', function () {
    beforeEach(async function () {
      const receipt = await this.accessControl.$_setRoleAdmin(ROLE, OTHER_ROLE);
      expectEvent(receipt, 'RoleAdminChanged', {
        role: ROLE,
        previousAdminRole: DEFAULT_ADMIN_ROLE,
        newAdminRole: OTHER_ROLE,
      });

      await this.accessControl.grantRole(OTHER_ROLE, otherAdmin, { from: admin });
    });

    it("a role's admin role can be changed", async function () {
      expect(await this.accessControl.getRoleAdmin(ROLE)).to.equal(OTHER_ROLE);
    });

    it('the new admin can grant roles', async function () {
      const receipt = await this.accessControl.grantRole(ROLE, authorized, { from: otherAdmin });
      expectEvent(receipt, 'RoleGranted', { account: authorized, role: ROLE, sender: otherAdmin });
    });

    it('the new admin can revoke roles', async function () {
      await this.accessControl.grantRole(ROLE, authorized, { from: otherAdmin });
      const receipt = await this.accessControl.revokeRole(ROLE, authorized, { from: otherAdmin });
      expectEvent(receipt, 'RoleRevoked', { account: authorized, role: ROLE, sender: otherAdmin });
    });

    it("a role's previous admins no longer grant roles", async function () {
      await expectRevert(
        this.accessControl.grantRole(ROLE, authorized, { from: admin }),
        `${errorPrefix}: account ${admin.toLowerCase()} is missing role ${OTHER_ROLE}`,
      );
    });

    it("a role's previous admins no longer revoke roles", async function () {
      await expectRevert(
        this.accessControl.revokeRole(ROLE, authorized, { from: admin }),
        `${errorPrefix}: account ${admin.toLowerCase()} is missing role ${OTHER_ROLE}`,
      );
    });
  });

  describe('onlyRole modifier', function () {
    beforeEach(async function () {
      await this.accessControl.grantRole(ROLE, authorized, { from: admin });
    });

    it('do not revert if sender has role', async function () {
      await this.accessControl.methods['$_checkRole(bytes32)'](ROLE, { from: authorized });
    });

    it("revert if sender doesn't have role #1", async function () {
      await expectRevert(
        this.accessControl.methods['$_checkRole(bytes32)'](ROLE, { from: other }),
        `${errorPrefix}: account ${other.toLowerCase()} is missing role ${ROLE}`,
      );
    });

    it("revert if sender doesn't have role #2", async function () {
      await expectRevert(
        this.accessControl.methods['$_checkRole(bytes32)'](OTHER_ROLE, { from: authorized }),
        `${errorPrefix}: account ${authorized.toLowerCase()} is missing role ${OTHER_ROLE}`,
      );
    });
  });
}

function shouldBehaveLikeAccessControlEnumerable(errorPrefix, admin, authorized, other, otherAdmin, otherAuthorized) {
  shouldSupportInterfaces(['AccessControlEnumerable']);

  describe('enumerating', function () {
    it('role bearers can be enumerated', async function () {
      await this.accessControl.grantRole(ROLE, authorized, { from: admin });
      await this.accessControl.grantRole(ROLE, other, { from: admin });
      await this.accessControl.grantRole(ROLE, otherAuthorized, { from: admin });
      await this.accessControl.revokeRole(ROLE, other, { from: admin });

      const memberCount = await this.accessControl.getRoleMemberCount(ROLE);
      expect(memberCount).to.bignumber.equal('2');

      const bearers = [];
      for (let i = 0; i < memberCount; ++i) {
        bearers.push(await this.accessControl.getRoleMember(ROLE, i));
      }

      expect(bearers).to.have.members([authorized, otherAuthorized]);
    });
    it('role enumeration should be in sync after renounceRole call', async function () {
      expect(await this.accessControl.getRoleMemberCount(ROLE)).to.bignumber.equal('0');
      await this.accessControl.grantRole(ROLE, admin, { from: admin });
      expect(await this.accessControl.getRoleMemberCount(ROLE)).to.bignumber.equal('1');
      await this.accessControl.renounceRole(ROLE, admin, { from: admin });
      expect(await this.accessControl.getRoleMemberCount(ROLE)).to.bignumber.equal('0');
    });
  });
}

function shouldBehaveLikeAccessControlAdminRules(errorPrefix, delay, admin, newAdmin, other) {
  shouldSupportInterfaces(['AccessControlAdminRules']);

  it('has a default disabled delayed until', async function () {
    expect(await this.accessControl.delayedUntil()).to.be.bignumber.equal(web3.utils.toBN(0));
  });

  it('has a default pending admin', async function () {
    expect(await this.accessControl.pendingAdmin()).to.equal(ZERO_ADDRESS);
  });

  it('has a default current owner set to the initial owner', async function () {
    const owner = await this.accessControl.owner();
    expect(owner).to.equal(admin);
    expect(await this.accessControl.hasRole(DEFAULT_ADMIN_ROLE, owner)).to.be.true;
  });

  it('should revert if granting admin role', async function () {
    await expectRevert(
      this.accessControl.grantRole(DEFAULT_ADMIN_ROLE, admin, { from: admin }),
      `${errorPrefix}: can't directly grant admin role`,
    );
  });

  it('should revert if revoking admin role', async function () {
    await expectRevert(
      this.accessControl.revokeRole(DEFAULT_ADMIN_ROLE, admin, { from: admin }),
      `${errorPrefix}: can't directly revoke admin role`,
    );
  });

  it("should revert if admin's is changed", async function () {
    await expectRevert(
      this.accessControl.$_setRoleAdmin(DEFAULT_ADMIN_ROLE, admin),
      `${errorPrefix}: can't override admin's admin`,
    );
  });

  it('should not grant the admin role twice', async function () {
    await expectRevert(
      this.accessControl.$_grantRole(DEFAULT_ADMIN_ROLE, admin),
      `${errorPrefix}: admin already granted`,
    );
  });

  describe('begins transfer admin', async function () {
    it('should set pending admin and delayed until', async function () {
      const receipt = await this.accessControl.beginAdminTransfer(newAdmin, { from: admin });
      const delayedUntil = (await time.latest()).add(delay);
      expect(await this.accessControl.pendingAdmin()).to.equal(newAdmin);
      expect(await this.accessControl.delayedUntil()).to.be.bignumber.equal((await time.latest()).add(delay));
      expectEvent(receipt, 'AdminRoleChangeStarted', { newAdmin, delayedUntil });
    });

    it('should revert if it called by non-admin accounts', async function () {
      await expectRevert(
        this.accessControl.beginAdminTransfer(newAdmin, { from: other }),
        `${errorPrefix}: account ${other.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
      );
    });

    it('should revert if another transfer has started', async function () {
      await this.accessControl.beginAdminTransfer(newAdmin, { from: admin });
      await expectRevert(
        this.accessControl.beginAdminTransfer(other, { from: admin }),
        `${errorPrefix}: pending admin already set`,
      );
    });
  });

  describe('accepts transfer admin', async function () {
    let correctPendingAdmin;
    let correctIncreaseTo;

    beforeEach(async function () {
      // Set as correct so they're explicitly needed in revert tests, since conditions
      // are not mutually exclusive and accidentally an incorrect value will make it revert
      // possiblty creating false positives (eg. expect revert for incorrect caller but getting it
      // from a badly expected delayed until)
      correctPendingAdmin = newAdmin;
      correctIncreaseTo = (await time.latest()).add(delay).subn(1);

      await this.accessControl.beginAdminTransfer(correctPendingAdmin, { from: admin });
    });

    describe('caller is pending admin and delayed until is met', async function () {
      let from;
      let receipt;

      beforeEach(async function () {
        await time.increaseTo(correctIncreaseTo);
        from = correctPendingAdmin;
        receipt = await this.accessControl.acceptAdminTransfer({ from });
      });

      it('accepts a transfer and changes admin', async function () {
        expect(await this.accessControl.hasRole(DEFAULT_ADMIN_ROLE, admin)).to.be.false;
        expect(await this.accessControl.hasRole(DEFAULT_ADMIN_ROLE, newAdmin)).to.be.true;
        expect(await this.accessControl.owner()).to.equal(newAdmin);
      });

      it('accepts a transfer and emit events', async function () {
        expectEvent(receipt, 'RoleRevoked', {
          role: DEFAULT_ADMIN_ROLE,
          account: admin,
        });
        expectEvent(receipt, 'RoleGranted', {
          role: DEFAULT_ADMIN_ROLE,
          account: newAdmin,
        });
      });

      it('accepts a transfer resetting pending admin and delayed until', async function () {
        expect(await this.accessControl.delayedUntil()).to.be.bignumber.equal(web3.utils.toBN(0));
        expect(await this.accessControl.pendingAdmin()).to.equal(ZERO_ADDRESS);
      });
    });

    it('should revert if caller is not pending admin', async function () {
      await time.increaseTo(correctIncreaseTo);
      await expectRevert(
        this.accessControl.acceptAdminTransfer({ from: other }),
        `${errorPrefix}: delay must be met and caller must be pending admin`,
      );
    });

    describe('delayed until not met', async function () {
      let incorrectIncreaseTo;

      beforeEach(async function () {
        incorrectIncreaseTo = correctIncreaseTo.addn(1);
      });

      it('should revert if block.timestamp is equal to delayed until', async function () {
        await time.increaseTo(incorrectIncreaseTo);
        await expectRevert(
          this.accessControl.acceptAdminTransfer({ from: correctPendingAdmin }),
          `${errorPrefix}: delay must be met and caller must be pending admin`,
        );
      });

      it('should revert if block.timestamp is less to delayed until', async function () {
        await time.increaseTo(incorrectIncreaseTo.addn(1));
        await expectRevert(
          this.accessControl.acceptAdminTransfer({ from: correctPendingAdmin }),
          `${errorPrefix}: delay must be met and caller must be pending admin`,
        );
      });
    });
  });

  describe('cancel transfer admin', async function () {
    beforeEach(async function () {
      await this.accessControl.beginAdminTransfer(newAdmin, { from: admin });
    });

    it('resets pending admin and delayed until', async function () {
      await this.accessControl.cancelAdminTransfer({ from: admin });
      expect(await this.accessControl.delayedUntil()).to.be.bignumber.equal(web3.utils.toBN(0));
      expect(await this.accessControl.pendingAdmin()).to.equal(ZERO_ADDRESS);
    });

    it('reverts if called by non-admin accounts', async function () {
      await expectRevert(
        this.accessControl.cancelAdminTransfer({ from: other }),
        `${errorPrefix}: account ${other.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
      );
    });
  });

  describe('renouncing admin', async function () {
    let correctIncreaseTo;
    let from = admin;

    beforeEach(async function () {
      correctIncreaseTo = (await time.latest()).add(delay).subn(1);
      await this.accessControl.beginAdminTransfer(ZERO_ADDRESS, { from });
    });

    describe('caller is admin and delayed until is met', async function () {
      let receipt;

      beforeEach(async function () {
        await time.increaseTo(correctIncreaseTo);
        from = admin;
        receipt = await this.accessControl.renounceRole(DEFAULT_ADMIN_ROLE, from, { from });
      });

      it('renounces role and does not grant it to the ZERO ADDRESS', async function () {
        expect(await this.accessControl.hasRole(DEFAULT_ADMIN_ROLE, admin)).to.be.false;
        expect(await this.accessControl.hasRole(ZERO_ADDRESS, admin)).to.be.false;
      });

      it('emits events', async function () {
        expectEvent(receipt, 'RoleRevoked', {
          role: DEFAULT_ADMIN_ROLE,
          account: from,
        });
      });

      it('marks the contract as not owned', async function () {
        expect(await this.accessControl.owner()).to.equal(ZERO_ADDRESS);
      });

      it('allows to recover access using the internal _grantRole', async function () {
        const grantRoleReceipt = await this.accessControl.$_grantRole(DEFAULT_ADMIN_ROLE, other);
        expectEvent(grantRoleReceipt, 'RoleGranted', {
          role: DEFAULT_ADMIN_ROLE,
          account: other,
        });
      });
    });

    it('reverts if caller is not admin', async function () {
      await time.increaseTo(correctIncreaseTo);
      await expectRevert(
        this.accessControl.renounceRole(DEFAULT_ADMIN_ROLE, other, { from }),
        `${errorPrefix}: can only renounce roles for self`,
      );
    });

    describe('delayed until not met', async function () {
      let incorrectIncreaseTo;

      beforeEach(async function () {
        incorrectIncreaseTo = correctIncreaseTo.addn(1);
      });

      it('reverts if block.timestamp is equal to delayed until', async function () {
        await time.increaseTo(incorrectIncreaseTo);
        await expectRevert(
          this.accessControl.renounceRole(DEFAULT_ADMIN_ROLE, admin, { from }),
          `${errorPrefix}: admin can only renounce in two delayed steps`,
        );
      });

      it('reverts if block.timestamp is less to delayed until', async function () {
        await time.increaseTo(incorrectIncreaseTo.addn(1));
        await expectRevert(
          this.accessControl.renounceRole(DEFAULT_ADMIN_ROLE, admin, { from }),
          `${errorPrefix}: admin can only renounce in two delayed steps`,
        );
      });
    });
  });
}

module.exports = {
  DEFAULT_ADMIN_ROLE,
  shouldBehaveLikeAccessControl,
  shouldBehaveLikeAccessControlEnumerable,
  shouldBehaveLikeAccessControlAdminRules,
};
