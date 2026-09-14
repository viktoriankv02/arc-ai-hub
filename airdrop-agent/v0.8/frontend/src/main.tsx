import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Mode = "online" | "demo";
type Testnet = {
  network: string;
  chain_id: number;
  rpc: string;
  explorer: string;
  status?: string;
  block_number?: number;
};
type WalletInfo = {
  chain_id: number;
  block_number: number;
  balance_native: number;
  balance_wei: string;
};
type Proposal = {
  proposal_id: string;
  chain: string;
  to: string;
  value_wei: string;
  data: string;
  purpose: string;
  risk_level?: string;
  approval_required?: boolean;
  status?: string;
};

const API = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const DEMO: Testnet = {
  network: "ARC Testnet",
  chain_id: 57001,
  rpc: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  status: "ready",
};

function App() {
  const [mode, setMode] = useState<Mode>("demo");
  const [testnet, setTestnet] = useState<Testnet>(DEMO);
  const [wallet, setWallet] = useState("");
  const [walletOk, setWalletOk] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [msg, setMsg] = useState("Готово до тестування");
  const [busy, setBusy] = useState(false);

  const request = async (path: string, options?: RequestInit) => {
    const response = await fetch(API + path, options);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  };

  const load = async () => {
    setBusy(true);
    try {
      const [health, demo, queue] = await Promise.all([
        request("/api/health"),
        request("/api/demo/testnet"),
        request("/api/tx/proposals"),
      ]);
      if (!health.ok) throw new Error("Backend health check failed");
      setMode("online");
      setTestnet(demo);
      setProposals(queue.items || []);
      setMsg("Backend підключено");
    } catch {
      setMode("demo");
      setTestnet(DEMO);
      setMsg("DEMO MODE — backend не підключений");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const checkTestnet = async () => {
    setBusy(true);
    try {
      const result = await request("/api/testnet/status");
      setTestnet((current) => ({ ...current, ...result, status: result.ok ? "RPC ONLINE" : "CHAIN ID ERROR" }));
      setMsg(result.ok ? `ARC Testnet OK • block ${result.block_number}` : "RPC відповідає, але Chain ID не збігається");
    } catch {
      setMsg("Не вдалося отримати дані ARC RPC");
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    const address = wallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setWalletOk(false);
      setWalletInfo(null);
      setMsg("Некоректна EVM-адреса");
      return;
    }
    if (mode === "demo") {
      setWalletOk(true);
      setMsg("Адреса валідна • локальна перевірка");
      return;
    }
    try {
      await request("/api/wallet/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chains: ["arc-testnet"] }),
      });
      setWalletOk(true);
      setMsg("Wallet перевірено");
    } catch {
      setWalletOk(false);
      setMsg("Wallet validation failed");
    }
  };

  const inspectWallet = async () => {
    if (!walletOk) {
      setMsg("Спочатку перевірте wallet");
      return;
    }
    if (mode === "demo") {
      setMsg("DEMO MODE: баланс доступний після запуску backend");
      return;
    }
    setBusy(true);
    try {
      const result = await request("/api/wallet/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet, chain: "arc-testnet" }),
      });
      setWalletInfo(result);
      setMsg(`Wallet inspected • ${result.balance_native} ARC`);
    } catch {
      setMsg("Не вдалося прочитати wallet через ARC RPC");
    } finally {
      setBusy(false);
    }
  };

  const createProposal = async () => {
    if (!walletOk) {
      setMsg("Спочатку перевірте wallet");
      return;
    }
    const item: Proposal = {
      proposal_id: "test-" + Date.now(),
      chain: "arc-testnet",
      to: wallet.trim(),
      value_wei: "0",
      data: "0x",
      purpose: "ARC AI HUB frontend test",
      status: "PENDING_APPROVAL",
      approval_required: true,
      risk_level: "LOW",
    };
    if (mode === "demo") {
      setProposals((current) => [item, ...current]);
      setMsg("TEST proposal створено локально • без підпису");
      return;
    }
    setBusy(true);
    try {
      const result = await request("/api/tx/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      setProposals((current) => [result.proposal, ...current]);
      setMsg("Proposal створено • потрібне підтвердження користувача");
    } catch {
      setMsg("Не вдалося створити proposal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header>
        <div>
          <b>ARC AI HUB</b>
          <span>Airdrop Agent • v0.9</span>
        </div>
        <div className={`badge ${mode}`}>
          {mode === "online" ? "● ONLINE" : "● DEMO MODE"}
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">WEB3 REWARDS OPERATING SYSTEM</p>
            <h1>Testnet Control Center</h1>
            <p>Живий контроль ARC Testnet: RPC, wallet, баланс та безпечна черга Transaction Proposals.</p>
          </div>
          <button onClick={() => void load()} disabled={busy}>↻ Refresh</button>
        </section>

        <div className="grid">
          <article>
            <div className="card-head"><h2>1. ARC Testnet</h2><span className="pill">Chain {testnet.chain_id}</span></div>
            <div className="status">● {testnet.status || "ready"}</div>
            <dl>
              <dt>Network</dt><dd>{testnet.network}</dd>
              <dt>RPC</dt><dd title={testnet.rpc}>{testnet.rpc}</dd>
              {testnet.block_number !== undefined && <><dt>Block</dt><dd>{testnet.block_number.toLocaleString()}</dd></>}
            </dl>
            <div className="actions">
              <button onClick={() => void checkTestnet()} disabled={busy}>Перевірити RPC</button>
              <a href={testnet.explorer} target="_blank" rel="noreferrer">Explorer →</a>
            </div>
          </article>

          <article>
            <div className="card-head"><h2>2. Wallet</h2><span className={walletOk ? "pill good" : "pill"}>{walletOk ? "VALID" : "NOT CHECKED"}</span></div>
            <input value={wallet} onChange={(e) => { setWallet(e.target.value); setWalletOk(false); setWalletInfo(null); }} placeholder="0x..." spellCheck={false} />
            <div className="actions">
              <button onClick={() => void validate()}>Перевірити адресу</button>
              <button onClick={() => void inspectWallet()} disabled={!walletOk || busy}>Баланс / RPC</button>
            </div>
            {walletOk && <div className="ok">✓ Wallet готовий до тесту</div>}
            {walletInfo && <div className="wallet-info"><b>{walletInfo.balance_native}</b> ARC <small>block {walletInfo.block_number.toLocaleString()}</small></div>}
          </article>

          <article>
            <div className="card-head"><h2>3. Transaction Guard</h2><span className="pill warning-pill">APPROVAL</span></div>
            <p>Будь-яка дія: <b>Proposal → Review → Approval</b>. Приватні ключі не зберігаються, автоматичного signing/broadcast немає.</p>
            <button className="primary full" onClick={() => void createProposal()} disabled={!walletOk || busy}>Створити TEST proposal</button>
            <div className="warning">⚠ TEST proposal не витрачає кошти й не підписує транзакцію.</div>
          </article>

          <article>
            <div className="card-head"><h2>4. Test results</h2><span className="pill">LOCAL</span></div>
            <div className="metric"><b>{proposals.length}</b><span>proposals in queue</span></div>
            <button onClick={() => setMsg("Frontend interaction OK • buttons responsive")}>Запустити UI test</button>
            <p className="muted">{msg}</p>
          </article>
        </div>

        <section className="queue">
          <div className="card-head"><h2>Approval Queue</h2><span className="pill">{proposals.length}</span></div>
          {proposals.length === 0 ? <p className="muted">Черга порожня. Створіть TEST proposal.</p> : proposals.map((item) => (
            <div className="row" key={item.proposal_id}>
              <span><b>{item.proposal_id}</b><small>{item.purpose || "Transaction proposal"}</small><small>{item.to}</small></span>
              <span className="pending">{item.status || "PENDING_APPROVAL"}</span>
            </div>
          ))}
        </section>
      </main>

      <footer>ARC AI HUB • Safety: no seed phrase • no private key • no invisible signing • user approval required</footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
