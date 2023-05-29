import type { ModuleDefinitionInterface } from '@defiyield/sandbox';
import { BigNumber } from 'bignumber.js';
import { Provider } from 'ethcall';

import stDUSDAbi from '../abis/stDUSD.abi.json';

const stDUSDAddress = '0xe69a1876bdacfa7a7a4f6d531be2fde843d2165c';

const SECONDS_IN_YEAR = new BigNumber(31536000);
const HUNDRED = new BigNumber(100);
const ZERO = new BigNumber(0);

export const DUSDStake: ModuleDefinitionInterface = {
  name: 'DUSDStake',
  chain: 'polygon',
  type: 'staking',

  async preloadTokens() {
    return [stDUSDAddress];
  },

  async fetchPools({ tokens, ethcallProvider, ethcall, BigNumber, axios }) {
    const [token] = tokens;
    const contract = new ethcall.Contract(stDUSDAddress, stDUSDAbi);

    const [totalSupply] = await ethcallProvider.all<[BigNumber]>([contract.totalStaking()]);
    const tvl = (Number(totalSupply.toString()) / 10 ** token?.decimals) * (token?.price || 0);

    const sdk = await ContractsManager.getInstance({
      chainId: 'polygon', // Replace with the correct chain ID
      forceRead: true,
    });
    const jarContract = await sdk.getJarContract();

    const [rate] = await ethcallProvider.all<[BigNumber]>([jarContract.methods.rate().call()]);

    const APR = rate.isGreaterThan(ZERO)
      ? rate.multipliedBy(SECONDS_IN_YEAR).multipliedBy(HUNDRED).div(totalSupply)
      : ZERO;

    return [
      {
        id: stDUSDAddress,
        supplied: [
          {
            token: tokens[0],
            tvl,
            apr: { year: APR.toNumber() },
          },
        ],
      },
    ];
  },

  async fetchUserPositions({ pools, user, ethcall, ethcallProvider, BigNumber }) {
    const [pool] = pools;
    const { token } = pool.supplied?.[0] || {};
    if (!token) return [];

    const contract = new ethcall.Contract(stDUSDAddress, stDUSDAbi);

    const [balance] = await ethcallProvider.all<[BigNumber]>([contract.balanceOf(user)]);

    return [
      {
        id: pool.id,
        supplied: [
          {
            token,
            balance: token?.decimals && balance ? +balance.toString() / 10 ** token.decimals : 0,
          },
        ],
      },
    ];
  },
};
