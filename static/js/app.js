import { displayEscrow, EscrowClient, friendlyError } from "./blockchain.js";

const $ = (id) => document.getElementById(id);
const shortAddress = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const sameAddress = (left, right) => left?.toLowerCase() === right?.toLowerCase();
const STATUS_NAMES = ["Funded", "Released", "Refunded"];

let client;
let busy = false;

function setStatus(message, kind = "") {
  $("status").textContent = message;
  $("status").className = `status ${kind}`;
}

function setBusy(value) {
  busy = value;
  syncControls();
}

function syncControls() {
  const ready = Boolean(client?.isConnected && client?.hasContract) && !busy;
  $("connect-wallet").disabled = busy;
  $("create-submit").disabled = !ready;
  $("refresh").disabled = !ready;
  document.querySelectorAll(".escrow-actions button").forEach((button) => {
    button.disabled = busy;
  });
}

function addActivity(label, hash) {
  const list = $("activity-list");
  if (list.children.length === 1 && !list.querySelector("a")) list.innerHTML = "";
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = `${client.config.explorerUrl}/tx/${hash}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `${label}: ${hash.slice(0, 10)}…${hash.slice(-8)}`;
  item.append(link);
  list.prepend(item);
}

async function runTransaction(label, send) {
  setBusy(true);
  try {
    setStatus(`Confirm “${label}” in MetaMask.`);
    const transaction = await send();
    setStatus(`Transaction submitted. Waiting for confirmation: ${transaction.hash}`);
    await transaction.wait();
    addActivity(label, transaction.hash);
    setStatus(`${label} confirmed on ${client.config.networkName}.`, "success");
    await loadEscrows();
    return true;
  } catch (error) {
    setStatus(friendlyError(error), "error");
    return false;
  } finally {
    setBusy(false);
  }
}

async function connectWallet() {
  setBusy(true);
  try {
    const details = await client.connect();
    $("wallet-value").textContent = shortAddress(details.account);
    $("network-value").textContent = `${client.config.networkName} (${details.chainId})`;
    $("connect-wallet").textContent = "Wallet connected";
    setStatus("Wallet connected. You can now create or manage an escrow.", "success");
    await loadEscrows();
  } catch (error) {
    setStatus(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

function actionButton(label, kind, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button compact ${kind}`;
  button.textContent = label;
  button.disabled = busy;
  button.addEventListener("click", handler);
  return button;
}

function renderEscrow(raw) {
  const item = displayEscrow(raw);
  const card = $("escrow-template").content.firstElementChild.cloneNode(true);
  card.querySelector(".escrow-id").textContent = `ESCROW #${item.id}`;
  card.querySelector(".escrow-reference").textContent = item.serviceReference;
  card.querySelector(".escrow-amount").textContent = item.amount;
  card.querySelector(".escrow-payer").textContent = shortAddress(item.payer);
  card.querySelector(".escrow-payee").textContent = shortAddress(item.payee);
  card.querySelector(".escrow-arbiter").textContent = shortAddress(item.arbiter);
  card.querySelector(".escrow-created").textContent = item.createdAt.toLocaleString();

  const badge = card.querySelector(".escrow-status");
  badge.textContent = item.disputed && item.status === 0 ? "Disputed" : STATUS_NAMES[item.status];
  badge.dataset.status = item.disputed && item.status === 0 ? "disputed" : STATUS_NAMES[item.status].toLowerCase();

  const actions = card.querySelector(".escrow-actions");
  if (item.status === 0 && !item.disputed) {
    if (sameAddress(client.account, item.payer)) {
      actions.append(actionButton("Release payment", "", () => runTransaction("Release payment", () => client.release(item.id))));
    }
    if (sameAddress(client.account, item.payee)) {
      actions.append(actionButton("Refund payer", "ghost", () => runTransaction("Refund payer", () => client.refund(item.id))));
    }
    if (sameAddress(client.account, item.payer) || sameAddress(client.account, item.payee)) {
      actions.append(actionButton("Raise dispute", "danger", () => runTransaction("Raise dispute", () => client.dispute(item.id))));
    }
  }

  if (item.status === 0 && item.disputed && sameAddress(client.account, item.arbiter)) {
    actions.append(
      actionButton("Pay freelancer", "", () => runTransaction("Resolve for freelancer", () => client.resolve(item.id, true))),
      actionButton("Refund payer", "ghost", () => runTransaction("Resolve for payer", () => client.resolve(item.id, false))),
    );
  }

  if (!actions.children.length) {
    const note = document.createElement("span");
    note.className = "muted small";
    note.textContent = item.status === 0 ? "No action is available for your role." : "This escrow is complete.";
    actions.append(note);
  }
  return card;
}

async function loadEscrows() {
  if (!client?.isConnected || !client?.hasContract) return;
  const list = $("escrow-list");
  const empty = $("empty-state");
  list.innerHTML = "";
  empty.textContent = "Loading on-chain agreements…";
  empty.classList.remove("hidden");

  try {
    const items = await client.getMyEscrows();
    if (!items.length) {
      empty.textContent = "No escrows are linked to this wallet yet.";
      return;
    }
    empty.classList.add("hidden");
    items.forEach((item) => list.append(renderEscrow(item)));
  } catch (error) {
    empty.textContent = "Escrows could not be loaded.";
    setStatus(friendlyError(error), "error");
  }
}

async function createEscrow(event) {
  event.preventDefault();
  const values = {
    serviceReference: $("reference").value,
    payee: $("payee").value.trim(),
    arbiter: $("arbiter").value.trim(),
    amount: $("amount").value.trim(),
  };
  const completed = await runTransaction("Create funded escrow", () => client.createEscrow(values));
  if (completed) event.currentTarget.reset();
}

function saveManualContract() {
  try {
    const address = $("manual-contract").value.trim();
    client.setContractAddress(address);
    localStorage.setItem("fairPayContractAddress", address);
    $("contract-value").textContent = shortAddress(address);
    $("contract-setup").classList.add("hidden");
    setStatus("Contract address saved for this browser. Connect MetaMask to continue.", "success");
    syncControls();
  } catch (error) {
    setStatus(friendlyError(error), "error");
  }
}

async function initialise() {
  try {
    const [configResponse, abiResponse] = await Promise.all([
      fetch("/api/config"),
      fetch("/static/abi/FreelanceEscrow.abi.json"),
    ]);
    if (!configResponse.ok || !abiResponse.ok) throw new Error("Application configuration could not be loaded.");

    const config = await configResponse.json();
    const abi = await abiResponse.json();
    if (!config.contractAddress) config.contractAddress = localStorage.getItem("fairPayContractAddress") || "";
    client = new EscrowClient(config, abi);

    $("network-value").textContent = `${config.networkName} (${config.chainId})`;
    if (client.hasContract) {
      $("contract-value").textContent = shortAddress(config.contractAddress);
      setStatus("Application ready. Connect MetaMask to continue.");
    } else {
      $("contract-value").textContent = "Not configured";
      $("contract-setup").classList.remove("hidden");
      setStatus("Deploy the contract and configure its address before connecting.");
    }
  } catch (error) {
    setStatus(friendlyError(error), "error");
  } finally {
    syncControls();
  }
}

$("connect-wallet").addEventListener("click", connectWallet);
$("save-contract").addEventListener("click", saveManualContract);
$("create-form").addEventListener("submit", createEscrow);
$("refresh").addEventListener("click", loadEscrows);
window.ethereum?.on?.("accountsChanged", () => window.location.reload());
window.ethereum?.on?.("chainChanged", () => window.location.reload());

initialise();
