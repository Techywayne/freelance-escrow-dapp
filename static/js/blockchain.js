import {
  BrowserProvider,
  Contract,
  formatEther,
  isAddress,
  parseEther,
} from "https://cdn.jsdelivr.net/npm/ethers@6.15.0/+esm";

export class EscrowClient {
  constructor(config, abi) {
    this.config = config;
    this.abi = abi;
    this.provider = null;
    this.signer = null;
    this.account = null;
  }

  get isConnected() {
    return Boolean(this.signer && this.account);
  }

  get hasContract() {
    return isAddress(this.config.contractAddress || "");
  }

  setContractAddress(address) {
    if (!isAddress(address)) throw new Error("Enter a valid deployed contract address.");
    this.config.contractAddress = address;
  }

  async connect() {
    if (!window.ethereum) {
      throw new Error("MetaMask was not found. Install it or open this page in the MetaMask mobile browser.");
    }

    this.provider = new BrowserProvider(window.ethereum);
    await this.provider.send("eth_requestAccounts", []);
    await this.ensureExpectedNetwork();
    this.signer = await this.provider.getSigner();
    this.account = await this.signer.getAddress();

    return this.connectionDetails();
  }

  async ensureExpectedNetwork() {
    const expected = BigInt(this.config.chainId);
    const current = await this.provider.getNetwork();
    if (current.chainId === expected) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${expected.toString(16)}` }],
      });
      this.provider = new BrowserProvider(window.ethereum);
    } catch (error) {
      if (error?.code === 4001) throw new Error(`Switch to ${this.config.networkName} to continue.`);
      throw new Error(`This application requires ${this.config.networkName} (chain ${this.config.chainId}).`);
    }
  }

  async connectionDetails() {
    const network = await this.provider.getNetwork();
    return { account: this.account, chainId: Number(network.chainId) };
  }

  contract() {
    if (!this.isConnected) throw new Error("Connect MetaMask first.");
    if (!this.hasContract) throw new Error("Configure the deployed contract address first.");
    return new Contract(this.config.contractAddress, this.abi, this.signer);
  }

  async createEscrow({ payee, arbiter, serviceReference, amount }) {
    if (!isAddress(payee) || !isAddress(arbiter)) throw new Error("Enter valid freelancer and arbiter addresses.");
    if (!serviceReference.trim()) throw new Error("Enter a service reference.");
    if (new TextEncoder().encode(serviceReference.trim()).length > 120) {
      throw new Error("The service reference must be no more than 120 bytes.");
    }

    let value;
    try {
      value = parseEther(amount);
    } catch {
      throw new Error("Enter a valid ETH amount.");
    }
    if (value <= 0n) throw new Error("Payment amount must be greater than zero.");

    return this.contract().createEscrow(payee, arbiter, serviceReference.trim(), { value });
  }

  async getMyEscrows() {
    const contract = this.contract();
    const ids = await contract.getEscrowIdsFor(this.account);
    const items = await Promise.all(ids.map(async (id) => {
      const item = await contract.getEscrow(id);
      return {
        id,
        payer: item.payer,
        payee: item.payee,
        arbiter: item.arbiter,
        amount: item.amount,
        createdAt: item.createdAt,
        status: item.status,
        disputed: item.disputed,
        serviceReference: item.serviceReference,
      };
    }));
    return items.reverse();
  }

  release(id) { return this.contract().releaseEscrow(id); }
  refund(id) { return this.contract().refundEscrow(id); }
  dispute(id) { return this.contract().raiseDispute(id); }
  resolve(id, releaseToPayee) { return this.contract().resolveDispute(id, releaseToPayee); }
}

export function displayEscrow(item) {
  return {
    id: item.id.toString(),
    payer: item.payer,
    payee: item.payee,
    arbiter: item.arbiter,
    amount: `${formatEther(item.amount)} ETH`,
    createdAt: new Date(Number(item.createdAt) * 1000),
    status: Number(item.status),
    disputed: item.disputed,
    serviceReference: item.serviceReference,
  };
}

export function friendlyError(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") return "The request was cancelled in MetaMask.";
  const message = error?.shortMessage || error?.reason || error?.message || "Something went wrong.";
  return message.replace(/^execution reverted:\s*/i, "");
}
