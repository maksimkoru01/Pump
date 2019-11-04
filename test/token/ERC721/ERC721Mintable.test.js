const { accounts, load } = require('@openzeppelin/test-env');
const [ creator, ...accounts ] = accounts;

require('@openzeppelin/test-helpers');
const { shouldBehaveLikeERC721 } = require('./ERC721.behavior');
const { shouldBehaveLikeMintAndBurnERC721 } = require('./ERC721MintBurn.behavior');

const ERC721MintableImpl = load.truffle('ERC721MintableBurnableImpl.sol');

describe('ERC721Mintable', function () {
  const minter = creator;

  beforeEach(async function () {
    this.token = await ERC721MintableImpl.new({
      from: creator,
    });
  });

  shouldBehaveLikeERC721(creator, minter, accounts);
  shouldBehaveLikeMintAndBurnERC721(creator, minter, accounts);
});
