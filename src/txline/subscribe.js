import "../polyfills.js";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import txoracleIdl from "./txoracle.json";

const DEFAULT_WEEKS = 4;

export async function subscribeAndActivateWorldCup({ provider, readiness, leagues = [] }) {
  if (!provider?.publicKey || !provider?.signTransaction || !provider?.signMessage) {
    throw new Error("Connected wallet must support Solana transaction and message signing");
  }

  const walletPublicKey = new PublicKey(provider.publicKey.toString());
  const connection = new web3.Connection(readiness.rpcUrl, "confirmed");
  const walletAdapter = {
    publicKey: walletPublicKey,
    signTransaction: provider.signTransaction.bind(provider),
    signAllTransactions: provider.signAllTransactions
      ? provider.signAllTransactions.bind(provider)
      : async (transactions) => Promise.all(transactions.map((transaction) => provider.signTransaction(transaction))),
  };
  const anchorProvider = new AnchorProvider(connection, walletAdapter, { commitment: "confirmed" });
  const program = new Program({ ...txoracleIdl, address: readiness.programId }, anchorProvider);
  const programId = new PublicKey(readiness.programId);
  const txlTokenMint = new PublicKey(readiness.txlTokenMint);

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    walletPublicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  await ensureAssociatedTokenAccount({ connection, provider, owner: walletPublicKey, tokenMint: txlTokenMint, tokenAccount: userTokenAccount });

  const subscriptionTx = await program.methods
    .subscribe(new BN(Number(readiness.serviceLevel)), new BN(DEFAULT_WEEKS))
    .accounts({
      user: walletPublicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const txSig = await signAndSendTransaction({ connection, provider, transaction: subscriptionTx, feePayer: walletPublicKey });
  const messagePayload = await fetchJson(`/api/activation-message?txSig=${encodeURIComponent(txSig)}`);
  const signature = await signActivationMessage(provider, messagePayload.message);
  const activation = await fetchJson("/api/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txSig, walletSignature: signature, leagues }),
  });

  return { txSig, activation };
}

async function ensureAssociatedTokenAccount({ connection, provider, owner, tokenMint, tokenAccount }) {
  const existing = await connection.getAccountInfo(tokenAccount, "confirmed");
  if (existing) return;

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      owner,
      tokenAccount,
      owner,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  await signAndSendTransaction({ connection, provider, transaction, feePayer: owner });
}

async function signAndSendTransaction({ connection, provider, transaction, feePayer }) {
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");
  return signature;
}

async function signActivationMessage(provider, message) {
  const encoded = new TextEncoder().encode(message);
  const result = await provider.signMessage(encoded, "utf8");
  const signature = result?.signature || result;
  return bytesToBase64(signature);
}

function bytesToBase64(bytes) {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  values.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Request failed with ${response.status}`);
  }

  return payload;
}
