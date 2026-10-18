# FairPay Freelance Escrow DApp

FairPay is a first-version financial DApp for holding a freelance payment on Ethereum Sepolia. A payer funds an agreement, a freelancer can voluntarily refund it, and either trading party can raise a dispute for a nominated arbiter to resolve.

This project is for coursework and testnet demonstration only. Do not use it with real funds.

## Project structure

```text
escrow-payment-dapp/
├── contracts/FreelanceEscrow.sol
├── static/
│   ├── abi/FreelanceEscrow.abi.json
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       └── blockchain.js
├── templates/index.html
├── tests/
│   ├── manual-test-cases.md
│   └── test_app.py
├── app.py
├── render.yaml
└── requirements.txt
```

The browser communicates with the smart contract through MetaMask and ethers.js. Flask serves the application and publishes non-secret deployment configuration. The server never receives or stores wallet private keys.

## Contract roles and workflow

1. The payer creates an escrow, nominates a freelancer and arbiter, and deposits Sepolia ETH.
2. The payer releases a completed payment, or the freelancer voluntarily refunds it.
3. The payer or freelancer can raise a dispute while the escrow is funded.
4. After a dispute, only the nominated arbiter can pay the freelancer or refund the payer.

Participant addresses must be different. The contract applies checks-effects-interactions and a reentrancy lock when transferring funds.

## Deploy the contract

1. Open `contracts/FreelanceEscrow.sol` in Remix.
2. Compile it with Solidity 0.8.20 or a compatible 0.8.x compiler.
3. In **Deploy & Run Transactions**, select **Injected Provider - MetaMask**.
4. Confirm MetaMask is using Ethereum Sepolia and has test ETH.
5. Deploy the contract and copy its address.

The included ABI matches this source version. If the contract is changed, compile it again and replace `static/abi/FreelanceEscrow.abi.json` with the newly generated ABI.

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
set CONTRACT_ADDRESS=0xYourDeployedContractAddress
python app.py
```

In PowerShell, set the address with:

```powershell
$env:CONTRACT_ADDRESS="0xYourDeployedContractAddress"
python app.py
```

Open `http://localhost:5000`. If `CONTRACT_ADDRESS` is empty, the page allows a local contract address to be saved in that browser.

## Automated backend tests

```bash
pytest
```

Contract behavior should also be tested in Remix or a Solidity test framework. The required manual scenarios are listed in `tests/manual-test-cases.md`.

## Deploy to Render

1. Upload this folder to a GitHub repository.
2. Create a Render Blueprint from `render.yaml`, or create a Python Web Service manually.
3. Set `CONTRACT_ADDRESS` to the Sepolia deployment address.
4. Use `pip install -r requirements.txt` as the build command.
5. Use `gunicorn app:app` as the start command.
6. Open `/api/health` on the Render URL to confirm the service is running.

## Current limitations

- The contract has not undergone a professional security audit.
- The nominated arbiter is a trusted third party and there is no arbiter replacement process.
- Service descriptions are public on-chain and cannot be edited.
- The activity panel keeps transaction links for the current browser session only. Escrow state remains permanently available on-chain.
- This first version does not include milestone payments, deadlines, partial refunds, platform fees, or a decentralized arbitration mechanism.
