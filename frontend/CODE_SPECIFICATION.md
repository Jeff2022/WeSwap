# DApp Specification (Current Codebase)

## 1. Project target and scope implemented

This project is a **frontend DApp for on-chain token swap on Avalanche Fuji (43113)** with two user roles:

1. **User swap interface (`/`)**
   - Connect wallet (MetaMask/Core-compatible injected provider).
   - Force/use Avalanche Fuji chain.
   - One unified swap flow:
     - select direction: `USDC → AVAX` or `AVAX → USDC`
     - input amount
     - execute swap
   - Validation before swap:
     - wallet must be connected (`Connect wallet first`)
     - amount format validation
     - best-effort `maxUSDCtoSwap()` / `maxAVAXtoSwap()` limit check (if callable)
   - USDC allowance handling before `swapUSDCForAVAX`.
   - Manual disconnect UI behavior persisted via `localStorage`.

2. **Admin tools (`/admin`, `/admin/tools`)**
   - Read contract state: owner, price, AVAX/USDC balances.
   - Owner actions (enabled only when connected wallet is owner):
     - `setPrice`
     - `withdrawAVAX`
     - `withdrawUSDC`
   - Contract address can be overridden from query param (`?contract=`) or input.

## 2. Technical stack and architecture

- **Framework**: React 18 + Vite
- **Routing**: `react-router-dom`
- **Blockchain SDK**: `ethers v6`
- **Entry**: `index.html` → `src/main.jsx` → `src/App.jsx`
- **Contract integration**:
  - ABI file: `ABI.json`
  - helpers: `src/utils/contract.js`
  - default contract address: `0x6b9883147df0928a14a9C9B842b0aD2fd399955d`
  - default RPC fallback: Avalanche Fuji RPC
- **Branding/UI**:
  - custom icon and favicon
  - centered simplified swap form
  - wallet dropdown with copy + disconnect

## 3. Build and run specification

### Prerequisites

- Node.js 18+ (recommended)
- npm
- Browser wallet extension (MetaMask/Core) for transaction features

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

- Opens local Vite dev server.
- Routes:
  - `/` user swap page
  - `/admin` admin tools page

### Production build

```bash
npm run build
```

- Output directory: `dist/`

### Local production preview

```bash
npm run preview
```

## 4. Environment/configuration specification

Optional environment variables (Vite):

- `VITE_CONTRACT_ADDRESS` (override default contract address)
- `VITE_FUJI_RPC` (override default Fuji RPC endpoint)

If not provided, defaults in `src/utils/contract.js` are used.

## 5. Deployment specification (Nginx flow used in your setup)

Build then upload `dist/` to server static directory, keep assets reachable, and reload nginx.

Typical sync target used in your deployment:

- `/usr/share/doc/HTML/` (with `/usr/share/nginx/html/assets` symlinked to that assets folder)

After deploy, verify:

1. `index.html` is updated on server.
2. `/assets/*.js`, `/assets/*.css`, `/assets/*.jpg` return HTTP 200.
3. Browser hard-refresh shows latest UI.

## 6. Functional requirements currently satisfied

- Wallet connect/disconnect UX with race-condition handling for cancel/disconnect cases.
- Fuji network targeting and chain switching support.
- Two-direction token swap through one unified form.
- Owner/admin operational controls exposed at `/admin`.
- Error feedback for invalid swap conditions and missing wallet connection.
- Ready-to-build static frontend for GitHub + server deployment.
