import { ERC20Instance, RynoLockerInstance } from '../types/truffle-contracts';

const RynoLocker = artifacts.require('RynoLocker');
const TestToken = artifacts.require('TestToken');
const toBN = web3.utils.toBN;

function convertToAmount(base: number) {
  return toBN(base).mul(toBN(10).pow(toBN(18))).toString();
}

async function setTime(time: number) {
  const provider = web3.currentProvider as any;
  return new Promise(resolve => provider.send({ method: "evm_mine", params: [time] }, resolve));
}

contract('RynoLocker', (accounts) => {
  let contract: RynoLockerInstance;
  let token: ERC20Instance;
  let time: number;

  beforeEach(async () => {
    token = await TestToken.new();
    contract = await RynoLocker.new(token.address, 1800, 900);
    time = (await contract.start()).toNumber();
    await token.transfer(contract.address, await token.totalSupply());
  });

  describe('getClaimableAmount', () => {
    it('returns correct amount', async () => {
      // 2 day
      await setTime(time + 60 * 60 * 24 * 2);
      expect((await contract.getClaimableAmount()).toString()).to.eq(convertToAmount(1));

      // 100 days
      await setTime(time + 60 * 60 * 24 * 100);
      expect((await contract.getClaimableAmount()).toString()).to.eq(convertToAmount(50));

      // 1500 days
      await setTime(time + 60 * 60 * 24 * 1500);
      expect((await contract.getClaimableAmount()).toString()).to.eq(convertToAmount(750));

      await setTime(time + 60 * 60 * 24 * 100);
      await contract.claim(convertToAmount(30));
      expect((await contract.getClaimableAmount()).toString()).to.eq(convertToAmount(20));

      await setTime(time + 60 * 60 * 24 * 1500);
      expect((await contract.getClaimableAmount()).toString()).to.eq(convertToAmount(720));

      // 2000 days - whole amount
      await setTime(time + 60 * 60 * 24 * 2000);
      const tokenBalance = await token.balanceOf(contract.address);
      expect((await contract.getClaimableAmount()).toString()).to.eq(tokenBalance.toString());
    });
  });

  describe('claim', () => {
    it('throws error if there is no enough balance', async () => {
      await setTime(time);

      try {
        await contract.claim(convertToAmount(10));
      } catch(e) {
        return true;
      }

      throw null;
    });

    it('transfers tokens correctly', async () => {
      await contract.transferOwnership(accounts[2]);
      await setTime(time + 60 * 60 * 24 * 100);
      await contract.claim(convertToAmount(25), { from: accounts[2] });
      expect((await contract.getClaimableAmount()).toString()).to.eq(convertToAmount(25));
      expect((await token.balanceOf(accounts[2])).toString()).to.eq(convertToAmount(25));
    });
  });
});