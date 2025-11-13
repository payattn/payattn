/**
 * Tests for Peggy Escrow Funder
 * Funds Solana escrows for accepted offers
 */

import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Mock fs BEFORE importing
jest.mock('fs', () => ({
  readFileSync: jest.fn()
}));

// Mock Solana BEFORE importing
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn(),
    Keypair: {
      fromSecretKey: jest.fn()
    }
  };
});

// Mock Anchor BEFORE importing
jest.mock('@coral-xyz/anchor', () => ({
  AnchorProvider: jest.fn(),
  Program: jest.fn(),
  BN: jest.requireActual('@coral-xyz/anchor').BN
}));

import { EscrowFunder, X402PaymentDetails } from '../escrow-funder';
import { readFileSync } from 'fs';
import { AnchorProvider, Program } from '@coral-xyz/anchor';

const mockReadFileSync = readFileSync as jest.Mock;
const mockConnection = Connection as jest.MockedClass<typeof Connection>;
const mockKeypairFromSecretKey = Keypair.fromSecretKey as jest.Mock;

describe('EscrowFunder', () => {
  let mockConnectionInstance: any;
  let mockKeypair: any;
  let mockProgramInstance: any;

  beforeEach(() => {
    // Reset environment
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
    process.env.SOLANA_PROGRAM_ID = '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr';
    process.env.ADVERTISER_KEYPAIR_PATH = '/test/keypair.json';
    process.env.SOLANA_IDL_PATH = '/test/idl.json';

    // Mock keypair
    mockKeypair = {
      publicKey: new PublicKey('11111111111111111111111111111111'),
      secretKey: new Uint8Array(64)
    };

    // Mock PublicKey.findProgramAddressSync to return predictable PDA  
    jest.spyOn(PublicKey, 'findProgramAddressSync').mockReturnValue([
      new PublicKey('11111111111111111111111111111111'),
      255
    ]);

    // Mock connection
    mockConnectionInstance = {
      getBalance: jest.fn().mockResolvedValue(100000000000), // 100 SOL
      confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } })
    };
    mockConnection.mockImplementation(() => mockConnectionInstance);

    // Mock program
    mockProgramInstance = {
      methods: {
        createEscrow: jest.fn().mockReturnValue({
          accounts: jest.fn().mockReturnValue({
            rpc: jest.fn().mockResolvedValue('mockTxSignature123')
          })
        })
      },
      account: {
        escrow: {
          fetch: jest.fn()
        }
      }
    };
    (Program as unknown as jest.Mock).mockImplementation(() => mockProgramInstance);

    // Mock file reads
    mockReadFileSync
      .mockReturnValueOnce('[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]') // keypair
      .mockReturnValueOnce('{"name":"test_program","instructions":[]}'); // IDL

    mockKeypairFromSecretKey.mockReturnValue(mockKeypair);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default RPC URL', () => {
      delete process.env.SOLANA_RPC_URL;
      new EscrowFunder();
      expect(mockConnection).toHaveBeenCalledWith('https://api.devnet.solana.com', 'confirmed');
    });

    it('should use custom RPC URL from environment', () => {
      process.env.SOLANA_RPC_URL = 'https://custom-rpc.com';
      new EscrowFunder();
      expect(mockConnection).toHaveBeenCalledWith('https://custom-rpc.com', 'confirmed');
    });

    it('should use default program ID when not provided', () => {
      delete process.env.SOLANA_PROGRAM_ID;
      expect(() => new EscrowFunder()).not.toThrow();
    });

    it('should throw error when keypair file cannot be read', () => {
      mockReadFileSync.mockReset();
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => new EscrowFunder()).toThrow('Failed to load advertiser keypair');
    });

    it('should throw error when keypair JSON is invalid', () => {
      mockReadFileSync.mockReset();
      mockReadFileSync.mockReturnValueOnce('invalid json');

      expect(() => new EscrowFunder()).toThrow();
    });

    it('should use default keypair path when not provided', () => {
      delete process.env.ADVERTISER_KEYPAIR_PATH;
      process.env.HOME = '/home/test';
      
      mockReadFileSync.mockReset();
      mockReadFileSync
        .mockReturnValueOnce('[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]')
        .mockReturnValueOnce('{"name":"test_program","instructions":[]}');

      new EscrowFunder();
      
      expect(mockReadFileSync).toHaveBeenCalledWith('/home/test/.config/solana/advertiser.json', 'utf8');
    });
  });

  describe('createProgram and WalletWrapper', () => {
    it('should create wallet wrapper with signing capabilities', async () => {
      const escrowFunder = new EscrowFunder();
      
      // Get the wallet that was passed to AnchorProvider
      const providerCall = (AnchorProvider as unknown as jest.Mock).mock.calls[0];
      const wallet = providerCall[1];
      
      expect(wallet.publicKey).toBeDefined();
      expect(typeof wallet.signTransaction).toBe('function');
      expect(typeof wallet.signAllTransactions).toBe('function');
    });

    it('should sign transaction with keypair', async () => {
      const escrowFunder = new EscrowFunder();
      
      // Get the wallet from AnchorProvider call
      const providerCall = (AnchorProvider as unknown as jest.Mock).mock.calls[0];
      const wallet = providerCall[1];
      
      // Mock transaction
      const mockTx = {
        partialSign: jest.fn()
      };
      
      const signedTx = await wallet.signTransaction(mockTx);
      
      expect(mockTx.partialSign).toHaveBeenCalledWith(mockKeypair);
      expect(signedTx).toBe(mockTx);
    });

    it('should sign all transactions with keypair', async () => {
      const escrowFunder = new EscrowFunder();
      
      // Get the wallet from AnchorProvider call
      const providerCall = (AnchorProvider as unknown as jest.Mock).mock.calls[0];
      const wallet = providerCall[1];
      
      // Mock transactions
      const mockTx1 = { partialSign: jest.fn() };
      const mockTx2 = { partialSign: jest.fn() };
      const mockTxs = [mockTx1, mockTx2];
      
      const signedTxs = await wallet.signAllTransactions(mockTxs);
      
      expect(mockTx1.partialSign).toHaveBeenCalledWith(mockKeypair);
      expect(mockTx2.partialSign).toHaveBeenCalledWith(mockKeypair);
      expect(signedTxs).toEqual(mockTxs);
    });

    it('should expose wallet public key', async () => {
      const escrowFunder = new EscrowFunder();
      
      // Get the wallet from AnchorProvider call
      const providerCall = (AnchorProvider as unknown as jest.Mock).mock.calls[0];
      const wallet = providerCall[1];
      
      expect(wallet.publicKey).toBe(mockKeypair.publicKey);
    });
  });

  describe('fundEscrow', () => {
    let escrowFunder: EscrowFunder;
    let x402Data: X402PaymentDetails;

    beforeEach(() => {
      escrowFunder = new EscrowFunder();
      
      x402Data = {
        offerId: 'offer_123',
        escrowPda: '11111111111111111111111111111111',
        paymentAmount: 1000000,
        userPubkey: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi',
        platformPubkey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        programId: '6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr'
      };
    });

    it('should throw error if PDA mismatch', async () => {
      // Use an escrowPda that won't match the derived PDA
      const badX402Data = {
        ...x402Data,
        escrowPda: 'WrongPDAAddress123456789012345678901'
      };

      const result = await escrowFunder.fundEscrow(badX402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDA mismatch');
    });

    it('should successfully fund new escrow', async () => {
      // Mock escrow doesn't exist yet
      mockProgramInstance.account.escrow.fetch.mockRejectedValue(
        new Error('Account does not exist')
      );

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(true);
      expect(result.txSignature).toBe('mockTxSignature123');
      expect(result.escrowPda).toBe(x402Data.escrowPda);
      expect(mockConnectionInstance.confirmTransaction).toHaveBeenCalledWith('mockTxSignature123', 'confirmed');
    });

    it('should return existing escrow if already funded with correct parameters', async () => {
      const existingEscrow = {
        offerId: 'offer_123',
        amount: new BN(1000000),
        user: new PublicKey('4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi'),
        advertiser: mockKeypair.publicKey,
        platform: new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
      };

      mockProgramInstance.account.escrow.fetch.mockResolvedValue(existingEscrow);

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(true);
      expect(result.txSignature).toBeUndefined(); // No new transaction
      expect(result.escrowPda).toBe(x402Data.escrowPda);
      // Should not call createEscrow
      expect(mockProgramInstance.methods.createEscrow).not.toHaveBeenCalled();
    });

    it('should throw error if existing escrow has wrong offer ID', async () => {
      const existingEscrow = {
        offerId: 'wrong_offer',
        amount: new BN(1000000),
        user: new PublicKey('4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi'),
        advertiser: mockKeypair.publicKey,
        platform: new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
      };

      mockProgramInstance.account.escrow.fetch.mockResolvedValue(existingEscrow);

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('offer ID mismatch');
    });

    it('should throw error if existing escrow has wrong amount', async () => {
      const existingEscrow = {
        offerId: 'offer_123',
        amount: new BN(999999), // Wrong amount
        user: new PublicKey('4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi'),
        advertiser: mockKeypair.publicKey,
        platform: new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
      };

      mockProgramInstance.account.escrow.fetch.mockResolvedValue(existingEscrow);

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('amount mismatch');
    });

    it('should throw error if existing escrow has wrong user', async () => {
      const existingEscrow = {
        offerId: 'offer_123',
        amount: new BN(1000000),
        user: new PublicKey('11111111111111111111111111111111'), // Wrong user
        advertiser: mockKeypair.publicKey,
        platform: new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
      };

      mockProgramInstance.account.escrow.fetch.mockResolvedValue(existingEscrow);

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('user mismatch');
    });

    it('should handle insufficient balance', async () => {
      mockConnectionInstance.getBalance.mockResolvedValue(1000); // Very low balance
      mockProgramInstance.account.escrow.fetch.mockRejectedValue(
        new Error('Account does not exist')
      );

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });

    it('should handle transaction failure', async () => {
      mockProgramInstance.account.escrow.fetch.mockRejectedValue(
        new Error('Account does not exist')
      );
      mockProgramInstance.methods.createEscrow.mockReturnValue({
        accounts: jest.fn().mockReturnValue({
          rpc: jest.fn().mockRejectedValue(new Error('Transaction failed'))
        })
      });

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockProgramInstance.account.escrow.fetch.mockRejectedValue(
        new Error('Account does not exist')
      );
      mockProgramInstance.methods.createEscrow.mockReturnValue({
        accounts: jest.fn().mockReturnValue({
          rpc: jest.fn().mockRejectedValue('String error')
        })
      });

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should log program logs on error with logs property', async () => {
      mockProgramInstance.account.escrow.fetch.mockRejectedValue(
        new Error('Account does not exist')
      );
      
      const errorWithLogs = new Error('Program failed');
      (errorWithLogs as any).logs = ['Log line 1', 'Log line 2'];
      
      mockProgramInstance.methods.createEscrow.mockReturnValue({
        accounts: jest.fn().mockReturnValue({
          rpc: jest.fn().mockRejectedValue(errorWithLogs)
        })
      });

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Program failed');
    });

    it('should re-throw non-account-not-found errors during fetch', async () => {
      mockProgramInstance.account.escrow.fetch.mockRejectedValue(
        new Error('Network error')
      );

      const result = await escrowFunder.fundEscrow(x402Data);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('getBalance', () => {
    it('should return balance in SOL', async () => {
      const escrowFunder = new EscrowFunder();
      mockConnectionInstance.getBalance.mockResolvedValue(5000000000); // 5 SOL

      const balance = await escrowFunder.getBalance();

      expect(balance).toBe(5);
      expect(mockConnectionInstance.getBalance).toHaveBeenCalledWith(mockKeypair.publicKey);
    });

    it('should handle zero balance', async () => {
      const escrowFunder = new EscrowFunder();
      mockConnectionInstance.getBalance.mockResolvedValue(0);

      const balance = await escrowFunder.getBalance();

      expect(balance).toBe(0);
    });
  });

  describe('getPublicKey', () => {
    it('should return advertiser public key', () => {
      const escrowFunder = new EscrowFunder();

      const pubkey = escrowFunder.getPublicKey();

      expect(pubkey).toBe(mockKeypair.publicKey);
    });
  });
});
