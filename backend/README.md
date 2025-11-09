````markdown
# Payattn Agent Dashboard

A Next.js application for the Payattn attention economy platform with Solana wallet integration and encrypted user data storage.

## Features

### ✅ Completed Implementations

- **WP01.2.1-2: Wallet Authentication** - Solana wallet connection with signature-based authentication
  - See [WALLET_AUTH_README.md](./WALLET_AUTH_README.md) for details
  
- **WP01.2.3: Encrypted Storage** - AES-256-GCM client-side encryption for user data
  - Web Crypto API with PBKDF2 key derivation
  - Zero-knowledge architecture (data never transmitted)
  
- **WP01.2.4: JWT Token Management** - Session management with localStorage persistence
  - 24-hour session expiration
  - Seamless authentication across page reloads

See [STORAGE_AUTH_README.md](./STORAGE_AUTH_README.md) for implementation details.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing the Implementation

Visit [http://localhost:3000/storage-test](http://localhost:3000/storage-test) to test:
- Encrypted storage operations
- JWT token creation and validation
- Session persistence
- Profile data encryption/decryption

## Project Structure

```
agent-dashboard/
├── app/
│   ├── page.tsx              # Main landing page
│   └── storage-test/         # Test dashboard for encryption & JWT
├── components/
│   ├── WalletButton.tsx      # Wallet connection UI
│   ├── WalletProvider.tsx    # Solana wallet context
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── auth.ts               # Authentication & JWT management
│   ├── storage.ts            # Encrypted storage wrapper
│   └── storage-examples.ts   # Usage examples
└── hooks/
    └── useAuth.ts            # Authentication hook
```

## Documentation

- [Wallet Authentication](./WALLET_AUTH_README.md) - WP01.2.1-2 implementation
- [Encrypted Storage & JWT](./STORAGE_AUTH_README.md) - WP01.2.3-4 implementation
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Technical overview

## Key Technologies

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Solana Web3.js** - Blockchain integration
- **Solana Wallet Adapter** - Wallet connection
- **Web Crypto API** - Native browser encryption
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

## Security Features

### Client-Side Encryption
- AES-256-GCM authenticated encryption
- PBKDF2 key derivation (100,000 iterations)
- Random IV per encryption operation
- Zero-knowledge architecture

### Session Management
- JWT-based authentication tokens
- 24-hour automatic expiration
- Secure localStorage implementation
- No server-side cookies (first-party only)

## Browser Support

All features require modern browsers with Web Crypto API:
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
````
