import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogError } from "./ModalDialog";
import type { SshKeyInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type KeyType = "ed25519" | "rsa";

const DEFAULT_FILENAME: Record<KeyType, string> = {
  ed25519: "id_ed25519",
  rsa: "id_rsa",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 9px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 10,
};

const actionBtnStyle = (accent = false, disabled = false): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 6,
  border: accent ? "none" : "1px solid var(--border)",
  background: disabled ? "var(--surface-3)" : accent ? "var(--accent)" : "transparent",
  color: disabled ? "var(--text-muted)" : accent ? "var(--text-on-color)" : "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  flexShrink: 0,
});

const copyBtnStyle = (copied: boolean): React.CSSProperties => ({
  padding: "3px 10px",
  borderRadius: 5,
  border: "1px solid var(--border)",
  background: copied ? "var(--green)" : "transparent",
  color: copied ? "var(--text-on-color)" : "var(--text-muted)",
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  flexShrink: 0,
  transition: "all 0.15s",
});

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </div>
  );
}

function CopyableText({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ marginTop: 8 }}>
      {label && <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          background: "var(--surface-0)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          padding: "6px 8px",
        }}
      >
        <pre
          style={{
            flex: 1,
            margin: 0,
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--text-secondary)",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {text}
        </pre>
        <button style={copyBtnStyle(copied)} onClick={handleCopy}>
          {copied ? t("ssh.copied") : t("ssh.copy")}
        </button>
      </div>
    </div>
  );
}

function KeyCard({
  keyInfo,
  onCopyPublic,
}: {
  keyInfo: SshKeyInfo;
  onCopyPublic: (name: string) => Promise<string>;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async () => {
    setCopyError(null);
    try {
      const pub = await onCopyPublic(keyInfo.name);
      await navigator.clipboard.writeText(pub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err: unknown) {
      setCopyError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "8px 10px",
        borderRadius: 6,
        background: "var(--surface-0)",
        border: "1px solid var(--border-subtle)",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontWeight: 700,
            color: "var(--text-primary)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {keyInfo.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 4,
            background: "var(--surface-2)",
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          {keyInfo.type}
        </span>
        {keyInfo.hasPublicKey && (
          <button style={copyBtnStyle(copied)} onClick={handleCopy}>
            {copied ? t("ssh.copied") : t("ssh.copyPublicKey")}
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={keyInfo.fingerprint}
      >
        {keyInfo.fingerprint || t("ssh.noFingerprintAvailable")}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={keyInfo.path}
      >
        {keyInfo.path}
      </div>
      {copyError && (
        <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>{copyError}</div>
      )}
    </div>
  );
}

export const SSHDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  // Keys list
  const [keys, setKeys] = useState<SshKeyInfo[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);

  // Generate form
  const [keyType, setKeyType] = useState<KeyType>("ed25519");
  const [comment, setComment] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [filename, setFilename] = useState(DEFAULT_FILENAME["ed25519"]);
  const [filenameEdited, setFilenameEdited] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Test connection
  const [testHost, setTestHost] = useState("git@github.com");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const loadKeys = async () => {
    setLoadingKeys(true);
    setKeysError(null);
    try {
      const list = await window.electronAPI.ssh.list();
      setKeys(list);
    } catch (err: unknown) {
      setKeysError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingKeys(false);
    }
  };

  useEffect(() => {
    if (open) {
      setKeyType("ed25519");
      setComment("");
      setPassphrase("");
      setFilename(DEFAULT_FILENAME["ed25519"]);
      setFilenameEdited(false);
      setGeneratedPublicKey(null);
      setGenerateError(null);
      setTestResult(null);
      setTestError(null);
      loadKeys();
    }
  }, [open]);

  const handleKeyTypeChange = (type: KeyType) => {
    setKeyType(type);
    if (!filenameEdited) {
      setFilename(DEFAULT_FILENAME[type]);
    }
  };

  const handleFilenameChange = (v: string) => {
    setFilename(v);
    setFilenameEdited(true);
  };

  const handleGenerate = async () => {
    if (!filename.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    setGeneratedPublicKey(null);
    try {
      const pub = await window.electronAPI.ssh.generate(
        keyType,
        comment.trim(),
        passphrase,
        filename.trim()
      );
      setGeneratedPublicKey(pub);
      await loadKeys();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleTest = async () => {
    if (!testHost.trim()) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const result = await window.electronAPI.ssh.test(testHost.trim());
      setTestResult(result);
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const dividerStyle: React.CSSProperties = {
    borderTop: "1px solid var(--border-subtle)",
    margin: "14px 0",
  };

  return (
    <ModalDialog open={open} title={t("ssh.title")} onClose={onClose} width={650}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowY: "auto", paddingRight: 2 }}>
          {/* Existing keys */}
          <div style={{ marginBottom: 4 }}>
            <div style={sectionTitleStyle}>{t("ssh.sshKeys")}</div>
            {loadingKeys ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  padding: "10px 0",
                  textAlign: "center",
                }}
              >
                {t("ssh.loadingKeys")}
              </div>
            ) : keysError ? (
              <DialogError error={keysError} />
            ) : keys.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  padding: "10px 0",
                  textAlign: "center",
                }}
              >
                {t("ssh.noKeysFound")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {keys.map((k) => (
                  <KeyCard
                    key={k.name}
                    keyInfo={k}
                    onCopyPublic={(name) => window.electronAPI.ssh.getPublic(name)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={dividerStyle} />

          {/* Generate new key */}
          <div>
            <div style={sectionTitleStyle}>{t("ssh.generateNewKey")}</div>

            {/* Key type selector */}
            <div style={{ marginBottom: 10 }}>
              <div style={labelStyle}>{t("ssh.keyType")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ed25519", "rsa"] as KeyType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleKeyTypeChange(t)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 6,
                      border: keyType === t ? "none" : "1px solid var(--border)",
                      background: keyType === t ? "var(--accent)" : "transparent",
                      color: keyType === t ? "var(--text-on-color)" : "var(--text-secondary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <FieldInput
                label={t("ssh.commentEmail")}
                value={comment}
                onChange={setComment}
                placeholder={t("ssh.commentPlaceholder")}
              />
              <FieldInput
                label={t("ssh.filename")}
                value={filename}
                onChange={handleFilenameChange}
                placeholder={DEFAULT_FILENAME[keyType]}
              />
            </div>

            <FieldInput
              label={t("ssh.passphrase")}
              value={passphrase}
              onChange={setPassphrase}
              type="password"
              placeholder={t("ssh.passphrasePlaceholder")}
            />

            <button
              onClick={handleGenerate}
              disabled={generating || !filename.trim()}
              style={actionBtnStyle(true, generating || !filename.trim())}
            >
              {generating ? t("ssh.generating") : t("ssh.generateKey")}
            </button>

            <DialogError error={generateError} />

            {generatedPublicKey && (
              <CopyableText text={generatedPublicKey} label={t("ssh.publicKeyGenerated")} />
            )}
          </div>

          <div style={dividerStyle} />

          {/* Test connection */}
          <div>
            <div style={sectionTitleStyle}>{t("ssh.testConnection")}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <FieldInput
                  label={t("ssh.host")}
                  value={testHost}
                  onChange={setTestHost}
                  placeholder="git@github.com"
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={handleTest}
                  disabled={testing || !testHost.trim()}
                  style={actionBtnStyle(false, testing || !testHost.trim())}
                >
                  {testing ? t("ssh.testing") : t("ssh.test")}
                </button>
              </div>
            </div>

            {testResult && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--green)",
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {testResult}
              </div>
            )}
            <DialogError error={testError} />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: 14,
            marginTop: 6,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button onClick={onClose} style={actionBtnStyle(false)}>
            {t("dialogs.close")}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
