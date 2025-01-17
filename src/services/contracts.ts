import deploymentInfo from '@coordinape/hardhat/dist/deploymentInfo.json';
import {
  ApeDistributor,
  ApeDistributor__factory,
  ApeRouter,
  ApeRouter__factory,
  ApeVaultFactoryBeacon,
  ApeVaultFactoryBeacon__factory,
  ApeVaultWrapperImplementation,
  ApeVaultWrapperImplementation__factory,
  ERC20,
  ERC20__factory,
} from '@coordinape/hardhat/dist/typechain';
import type { Signer } from '@ethersproject/abstract-signer';
import type { JsonRpcProvider } from '@ethersproject/providers';
import debug from 'debug';

import { HARDHAT_CHAIN_ID, HARDHAT_GANACHE_CHAIN_ID } from 'config/env';

const log = debug('coordinape:contracts');

export const supportedChainIds: number[] =
  Object.keys(deploymentInfo).map(Number);

export class Contracts {
  vaultFactory: ApeVaultFactoryBeacon;
  router: ApeRouter;
  distributor: ApeDistributor;

  // TODO this might not be quite the right way to do this, as the
  // signer/provider used to create the contracts also has a network associated
  // with it
  chainId: number;

  provider: JsonRpcProvider;
  signer: Signer;

  constructor(chainId: number, provider: JsonRpcProvider) {
    this.chainId = chainId;
    this.provider = provider;
    this.signer = provider.getSigner();

    const info = (deploymentInfo as any)[chainId];
    if (!info) {
      throw new Error(`No info for chain ${chainId}`);
    }
    this.vaultFactory = ApeVaultFactoryBeacon__factory.connect(
      info.ApeVaultFactoryBeacon.address,
      this.signer
    );
    this.router = ApeRouter__factory.connect(
      info.ApeRouter.address,
      this.signer
    );
    this.distributor = ApeDistributor__factory.connect(
      info.ApeDistributor.address,
      this.signer
    );
  }

  getVault(address: string): ApeVaultWrapperImplementation {
    return ApeVaultWrapperImplementation__factory.connect(
      address,
      this.provider
    );
  }

  getToken(symbol: string) {
    const info = (deploymentInfo as any)[this.chainId];
    let { address } = info[symbol] || {};

    // workaround for mainnet-forked testchains
    if (
      !address &&
      [HARDHAT_CHAIN_ID, HARDHAT_GANACHE_CHAIN_ID].includes(this.chainId)
    ) {
      address = (deploymentInfo as any)[1][symbol]?.address;
      if (!address)
        throw new Error(
          `No info for token "${symbol}" on chain ${this.chainId}`
        );
      log(
        `No info for token "${symbol}" on chain ${this.chainId}; using mainnet address`
      );
    }

    return this.getERC20(address);
  }

  getERC20(address: string): ERC20 {
    return ERC20__factory.connect(address, this.signer);
  }

  getMyAddress() {
    return this.signer.getAddress();
  }

  async getETHBalance(address?: string) {
    if (!address && this.signer) return this.signer.getBalance('latest');

    if (!address) {
      throw new Error(
        'address argument is required when signer is not available'
      );
    }
    return this.provider.getBalance(address, 'latest');
  }
}
