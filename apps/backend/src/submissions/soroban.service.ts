import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Service for interacting with the Soroban smart contract on Stellar.
 *
 * Handles the `release` function call when a bounty owner approves a submission,
 * releasing funds from the bounty contract to the submitter.
 */
@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly server: StellarSdk.SorobanRpc.Server;
  private readonly keypair: StellarSdk.Keypair | null = null;
  private readonly contractId: string | null = null;

  constructor(private readonly configService: ConfigService) {
    // Configure Stellar RPC endpoint
    const rpcUrl = this.configService.get<string>('STELLAR_RPC_URL');
    const networkPassphrase = this.configService.get<string>(
      'STELLAR_NETWORK_PASSPHRASE',
      StellarSdk.Networks.TESTNET,
    );

    if (rpcUrl) {
      this.server = new StellarSdk.SorobanRpc.Server(rpcUrl, {
        allowHttp: rpcUrl.startsWith('http://'),
      });
    }

    // Load operator keypair for submitting Soroban transactions
    const secretKey = this.configService.get<string>('STELLAR_OPERATOR_SECRET');
    if (secretKey) {
      try {
        this.keypair = StellarSdk.Keypair.fromSecret(secretKey);
      } catch (err) {
        this.logger.warn(
          `Invalid STELLAR_OPERATOR_SECRET: ${(err as Error).message}`,
        );
      }
    }

    this.contractId = this.configService.get<string>('BOUNTY_CONTRACT_ID');

    if (!this.contractId) {
      this.logger.warn(
        'BOUNTY_CONTRACT_ID not set. Soroban contract calls will be simulated.',
      );
    }
  }

  /**
   * Call the `release` function on the bounty Soroban contract.
   * Transfers locked funds from the bounty to the approved submitter.
   *
   * @param bountyId - The bounty ID
   * @param submitterAddress - Stellar public key of the approved submitter
   * @returns Transaction hash if successful
   */
  async releaseBounty(
    bountyId: string,
    submitterAddress: string,
  ): Promise<string> {
    if (!this.contractId) {
      this.logger.warn(
        `[SIMULATED] Soroban release for bounty ${bountyId} -> ${submitterAddress}`,
      );
      return `simulated_tx_${Date.now()}`;
    }

    if (!this.keypair) {
      throw new Error(
        'STELLAR_OPERATOR_SECRET is not configured. Cannot submit Soroban transaction.',
      );
    }

    try {
      this.logger.log(
        `Releasing bounty ${bountyId} to ${submitterAddress} via Soroban contract ${this.contractId}`,
      );

      const contract = new StellarSdk.Contract(this.contractId);

      // Build the release transaction
      const tx = await contract.call(
        'release',
        StellarSdk.nativeToScVal(bountyId, { type: 'symbol' }),
        StellarSdk.nativeToScVal(submitterAddress, { type: 'symbol' }),
      );

      // Prepare and sign the transaction
      const preparedTx = await this.server.prepareTransaction(tx);
      preparedTx.sign(this.keypair);

      // Submit
      const result = await this.server.sendTransaction(preparedTx);
      const txHash = result.hash;

      this.logger.log(`Soroban release successful! TX: ${txHash}`);
      return txHash;
    } catch (error) {
      this.logger.error(
        `Soroban release failed for bounty ${bountyId}: ${(error as Error).message}`,
      );
      throw new Error(
        `Failed to release bounty via Soroban: ${(error as Error).message}`,
      );
    }
  }
}
