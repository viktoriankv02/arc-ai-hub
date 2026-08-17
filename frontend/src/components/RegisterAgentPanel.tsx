import React from "react";
import { registerAgent } from "../agentRegistry";

type Props = {
  ethereum: any;
  registryAddress: string;
  chainId: number;
  requiredChainId: number;
  onRegistered?: () => void;
};

export function RegisterAgentPanel({ ethereum, registryAddress, chainId, requiredChainId, onRegistered }: Props) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [version, setVersion] = React.useState("1.0.0");
  const [endpoint, setEndpoint] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (chainId !== requiredChainId) {
      setMessage(`Перемкни MetaMask на потрібну мережу (chain ID ${requiredChainId})`);
      return;
    }
    if (!name.trim() || !description.trim() || !endpoint.trim()) {
      setMessage("Заповни назву, опис і endpoint");
      return;
    }

    try {
      setBusy(true);
      setMessage("Підтвердь транзакцію в MetaMask...");
      const result = await registerAgent(ethereum, registryAddress, name.trim(), description.trim(), version.trim(), endpoint.trim());
      setMessage(result.agentId ? `Agent #${result.agentId} зареєстровано. Tx: ${result.txHash}` : `Agent зареєстровано. Tx: ${result.txHash}`);
      setName("");
      setDescription("");
      setEndpoint("");
      onRegistered?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <h2>Register AI Agent</h2>
    <form className="form" onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" disabled={busy} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" disabled={busy} />
      <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version" disabled={busy} />
      <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="Endpoint / API URL" disabled={busy} />
      <button type="submit" disabled={busy || !registryAddress}>{busy ? "Registering..." : "Register Agent"}</button>
    </form>
    {!registryAddress && <p className="message">AI Agent Registry ще не налаштований для цієї мережі.</p>}
    {message && <p className="message">{message}</p>}
  </section>;
}
