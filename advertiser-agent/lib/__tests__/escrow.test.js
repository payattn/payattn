import { jest } from '@jest/globals';

// Mock the file system and Solana/Anchor modules
jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn((path) => {
    if (path.includes('idl') || path.includes('payattn_escrow.json')) {
      return JSON.stringify({
        version: '0.1.0',
        name: 'payattn_escrow',
        instructions: []
      });
    }
    // Keypair file
    return JSON.stringify(Array.from(new Uint8Array(64)));
  })
}));

jest.unstable_mockModule('@solana/web3.js', () => ({
  Connection: jest.fn(),
  Keypair: {
    fromSecretKey: jest.fn()
  },
  PublicKey: jest.fn().mockImplementation((key) => ({
    toBase58: jest.fn(() => key),
    toString: jest.fn(() => key)
  })),
  SystemProgram: {
    programId: 'SystemProgramId'
  }
}));

jest.unstable_mockModule('@coral-xyz/anchor', () => ({
  AnchorProvider: jest.fn(),
  Program: jest.fn()
}));

jest.unstable_mockModule('bn.js', () => ({
  BN: jest.fn().mockImplementation((value) => ({ value }))
}));

jest.unstable_mockModule('../../config.js', () => ({
  config: {
    solanaRpcUrl: 'https://api.devnet.solana.com',
    advertiserKeypairPath: '/path/to/keypair.json',
    programId: 'ProgramId123'
  }
}));

// Import after mocking
const { readFileSync } = await import('fs');
const { Connection, Keypair, PublicKey, SystemProgram } = await import('@solana/web3.js');
const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
const { BN } = await import('bn.js');
const { EscrowFunder } = await import('../escrow.js');

describe('EscrowFunder', () => {
  let mockConnection;
  let mockProgram;
  let mockKeypair;
  let mockPublicKey;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset PublicKey mock
    PublicKey.mockImplementation((key) => ({
      toBase58: jest.fn(() => key),
      toString: jest.fn(() => key)
    }));
    
    // Setup PublicKey.findProgramAddressSync
    PublicKey.findProgramAddressSync = jest.fn().mockReturnValue([
      { toBase58: () => 'EscrowPDA123' },
      255
    ]);
    
    // Mock keypair
    mockPublicKey = {
      toBase58: jest.fn(() => 'AdvertiserPubkey123'),
      toString: jest.fn(() => 'AdvertiserPubkey123')
    };
    
    mockKeypair = {
      publicKey: mockPublicKey,
      secretKey: new Uint8Array(64)
    };
    
    Keypair.fromSecretKey.mockReturnValue(mockKeypair);
    
    // Mock connection
    mockConnection = {
      getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL
      confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } })
    };
    
    Connection.mockImplementation(() => mockConnection);
    
    // Mock program methods
    const mockRpc = jest.fn().mockResolvedValue('TransactionSignature123');
    const mockAccounts = jest.fn().mockReturnValue({ rpc: mockRpc });
    const mockMethods = jest.fn().mockReturnValue({
      accounts: mockAccounts
    });
    
    mockProgram = {
      methods: {
        createEscrow: mockMethods
      }
    };
    
    Program.mockImplementation(() => mockProgram);
    
    // Mock file reads (both IDL and keypair)
    readFileSync.mockImplementation((path) => {
      if (path.includes('idl') || path.includes('payattn_escrow.json')) {
        return JSON.stringify({
          version: '0.1.0',
          name: 'payattn_escrow',
          instructions: []
        });
      }
      // Keypair file
      return JSON.stringify(Array.from(new Uint8Array(64)));
    });
  });
  
  describe('constructor', () => {
    it('should initialize with Solana connection and program', () => {
      const escrow = new EscrowFunder();
      
      expect(Connection).toHaveBeenCalledWith('https://api.devnet.solana.com', 'confirmed');
      expect(escrow.connection).toBe(mockConnection);
      expect(escrow.advertiserKeypair).toBe(mockKeypair);
      expect(escrow.program).toBe(mockProgram);
    });
  });
  
  describe('loadKeypair', () => {
    it('should load keypair from file successfully', () => {
      const escrow = new EscrowFunder();
      const keypair = escrow.loadKeypair();
      
      expect(readFileSync).toHaveBeenCalledWith('/path/to/keypair.json', 'utf8');
      expect(Keypair.fromSecretKey).toHaveBeenCalled();
      expect(keypair).toBe(mockKeypair);
    });
    
    it('should throw error when keypair file cannot be read', () => {
      readFileSync.mockImplementation((path) => {
        if (path.includes('keypair')) {
          throw new Error('File not found');
        }
        return JSON.stringify({ version: '0.1.0', name: 'payattn_escrow' });
      });
      
      expect(() => new EscrowFunder()).toThrow('Failed to load advertiser keypair: File not found');
    });
  });
  
  describe('createProgram', () => {
    it('should create Anchor program with provider', () => {
      const escrow = new EscrowFunder();
      
      expect(AnchorProvider).toHaveBeenCalled();
      expect(Program).toHaveBeenCalled();
      expect(escrow.program).toBe(mockProgram);
    });
    
    it('should create wallet wrapper with signing capabilities', async () => {
      const escrow = new EscrowFunder();
      
      // Get the wallet that was passed to AnchorProvider
      const providerCall = AnchorProvider.mock.calls[0];
      const wallet = providerCall[1];
      
      expect(wallet.publicKey).toBe(mockPublicKey);
      expect(typeof wallet.signTransaction).toBe('function');
      expect(typeof wallet.signAllTransactions).toBe('function');
      
      // Test signTransaction
      const mockTx = { partialSign: jest.fn() };
      const signedTx = await wallet.signTransaction(mockTx);
      expect(mockTx.partialSign).toHaveBeenCalledWith(mockKeypair);
      expect(signedTx).toBe(mockTx);
      
      // Test signAllTransactions
      const mockTxs = [
        { partialSign: jest.fn() },
        { partialSign: jest.fn() }
      ];
      const signedTxs = await wallet.signAllTransactions(mockTxs);
      expect(mockTxs[0].partialSign).toHaveBeenCalledWith(mockKeypair);
      expect(mockTxs[1].partialSign).toHaveBeenCalledWith(mockKeypair);
      expect(signedTxs).toEqual(mockTxs);
    });
  });
  
  describe('fundEscrow', () => {
    it('should fund escrow successfully', async () => {
      const escrow = new EscrowFunder();
      
      const x402Data = {
        offerId: 'offer123',
        escrowPda: 'EscrowPDA123',
        paymentAmount: 50000000, // 0.05 SOL
        userPubkey: 'UserPubkey456',
        platformPubkey: 'PlatformPubkey789'
      };
      
      const signature = await escrow.fundEscrow(x402Data);
      
      expect(PublicKey.findProgramAddressSync).toHaveBeenCalledWith(
        [Buffer.from('escrow'), Buffer.from('offer123')],
        expect.anything()
      );
      
      expect(mockConnection.getBalance).toHaveBeenCalledWith(mockPublicKey);
      
      expect(mockProgram.methods.createEscrow).toHaveBeenCalledWith(
        'offer123',
        expect.objectContaining({ value: 50000000 })
      );
      
      expect(mockConnection.confirmTransaction).toHaveBeenCalledWith('TransactionSignature123', 'confirmed');
      expect(signature).toBe('TransactionSignature123');
    });
    
    it('should throw error when PDA does not match', async () => {
      PublicKey.findProgramAddressSync.mockReturnValue([
        { toBase58: () => 'WrongPDA' },
        255
      ]);
      
      const escrow = new EscrowFunder();
      
      const x402Data = {
        offerId: 'offer123',
        escrowPda: 'EscrowPDA123',
        paymentAmount: 50000000,
        userPubkey: 'UserPubkey456',
        platformPubkey: 'PlatformPubkey789'
      };
      
      await expect(escrow.fundEscrow(x402Data)).rejects.toThrow('PDA mismatch!');
    });
    
    it('should throw error when insufficient balance', async () => {
      mockConnection.getBalance.mockResolvedValue(10000000); // 0.01 SOL - not enough
      
      const escrow = new EscrowFunder();
      
      const x402Data = {
        offerId: 'offer123',
        escrowPda: 'EscrowPDA123',
        paymentAmount: 50000000, // 0.05 SOL
        userPubkey: 'UserPubkey456',
        platformPubkey: 'PlatformPubkey789'
      };
      
      await expect(escrow.fundEscrow(x402Data)).rejects.toThrow('Insufficient balance');
    });
    
    it('should handle transaction submission errors', async () => {
      const mockRpc = jest.fn().mockRejectedValue(new Error('Transaction failed'));
      const mockAccounts = jest.fn().mockReturnValue({ rpc: mockRpc });
      mockProgram.methods.createEscrow = jest.fn().mockReturnValue({
        accounts: mockAccounts
      });
      
      const escrow = new EscrowFunder();
      
      const x402Data = {
        offerId: 'offer123',
        escrowPda: 'EscrowPDA123',
        paymentAmount: 50000000,
        userPubkey: 'UserPubkey456',
        platformPubkey: 'PlatformPubkey789'
      };
      
      await expect(escrow.fundEscrow(x402Data)).rejects.toThrow('Transaction failed');
    });
    
    it('should log program logs when transaction fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const errorWithLogs = new Error('Transaction failed');
      errorWithLogs.logs = ['Log line 1', 'Log line 2'];
      
      const mockRpc = jest.fn().mockRejectedValue(errorWithLogs);
      const mockAccounts = jest.fn().mockReturnValue({ rpc: mockRpc });
      mockProgram.methods.createEscrow = jest.fn().mockReturnValue({
        accounts: mockAccounts
      });
      
      const escrow = new EscrowFunder();
      
      const x402Data = {
        offerId: 'offer123',
        escrowPda: 'EscrowPDA123',
        paymentAmount: 50000000,
        userPubkey: 'UserPubkey456',
        platformPubkey: 'PlatformPubkey789'
      };
      
      await expect(escrow.fundEscrow(x402Data)).rejects.toThrow('Transaction failed');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Program logs:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('      Log line 1');
      expect(consoleErrorSpy).toHaveBeenCalledWith('      Log line 2');
      
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('getBalance', () => {
    it('should return balance in SOL', async () => {
      const escrow = new EscrowFunder();
      
      mockConnection.getBalance.mockResolvedValue(1500000000); // 1.5 SOL
      
      const balance = await escrow.getBalance();
      
      expect(mockConnection.getBalance).toHaveBeenCalledWith(mockPublicKey);
      expect(balance).toBe(1.5);
    });
    
    it('should handle balance query errors', async () => {
      const escrow = new EscrowFunder();
      
      mockConnection.getBalance.mockRejectedValue(new Error('Network error'));
      
      await expect(escrow.getBalance()).rejects.toThrow('Network error');
    });
  });
  
  describe('getPublicKey', () => {
    it('should return advertiser public key', () => {
      const escrow = new EscrowFunder();
      
      const publicKey = escrow.getPublicKey();
      
      expect(publicKey).toBe(mockPublicKey);
    });
  });
});
