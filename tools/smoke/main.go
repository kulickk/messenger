// smoke is a standalone integration test that exercises the full send-message
// flow without the desktop client:
//
//  1. Generate X25519 key pairs for user_a and user_b
//  2. POST /publish — register both public keys on the Key Server
//  3. GET /{user_id} — verify key retrieval
//  4. POST /generate-mask — test the Mask Generator independently
//  5. WebSocket /ws — connect as user_a, authenticate, send a message to user_b
//
// The API Gateway logs the Telegram send (stub) — no real MTProto call is made.
//
// Usage:
//
//	cd tools/smoke
//	go mod tidy
//	go run main.go
//
// Environment variables (all optional):
//
//	GATEWAY_URL     ws://localhost:8080   WebSocket base URL
//	KEY_SERVER_URL  http://localhost:8081
//	MASK_GEN_URL    http://localhost:8082
package main

import (
	"bytes"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"
)

// ── config ────────────────────────────────────────────────────────────────────

func gatewayURL() string   { return getenv("GATEWAY_URL", "ws://localhost:8080") }
func keyServerURL() string { return getenv("KEY_SERVER_URL", "http://localhost:8081") }
func maskGenURL() string   { return getenv("MASK_GEN_URL", "http://localhost:8082") }

// ── helpers ───────────────────────────────────────────────────────────────────

func step(n int, msg string) { fmt.Printf("\n[%d] %s\n", n, msg) }
func ok(msg string)          { fmt.Printf("    OK  %s\n", msg) }
func fail(msg string, err error) {
	fmt.Printf("    FAIL %s: %v\n", msg, err)
	os.Exit(1)
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ── crypto helpers ────────────────────────────────────────────────────────────

type keyPair struct {
	priv    *ecdh.PrivateKey
	privB64 string
	pubB64  string
}

func generateKeyPair() keyPair {
	priv, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		fmt.Printf("    FAIL generate key pair: %v\n", err)
		os.Exit(1)
	}
	return keyPair{
		priv:    priv,
		privB64: base64.StdEncoding.EncodeToString(priv.Bytes()),
		pubB64:  base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes()),
	}
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func postJSON(url string, body any) (*http.Response, []byte) {
	b, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b)) //nolint:noctx
	if err != nil {
		fail("POST "+url, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp, data
}

func getJSON(url string) (*http.Response, map[string]string) {
	resp, err := http.Get(url) //nolint:noctx
	if err != nil {
		fail("GET "+url, err)
	}
	defer resp.Body.Close()
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result) //nolint:errcheck
	return resp, result
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

type wsMsg struct {
	Type       string `json:"type"`
	PrivKey    string `json:"priv_key,omitempty"`
	To         string `json:"to,omitempty"`
	ToTelegram string `json:"to_telegram,omitempty"`
	Text       string `json:"text,omitempty"`
	CipherID   string `json:"cipher_id,omitempty"`
	Stego      string `json:"stego,omitempty"`
	Error      string `json:"error,omitempty"`
}

func wsSend(conn *websocket.Conn, msg wsMsg) {
	b, _ := json.Marshal(msg)
	if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
		fail("ws write", err)
	}
}

func wsRead(conn *websocket.Conn) wsMsg {
	conn.SetReadDeadline(time.Now().Add(30 * time.Second)) //nolint:errcheck
	_, raw, err := conn.ReadMessage()
	if err != nil {
		fail("ws read", err)
	}
	var msg wsMsg
	json.Unmarshal(raw, &msg) //nolint:errcheck
	return msg
}

// ── main ──────────────────────────────────────────────────────────────────────

func main() {
	fmt.Println("=== Messenger smoke test ===")

	// ── Step 1: generate key pairs ──────────────────────────────────────────
	step(1, "Generating X25519 key pairs")
	userA := generateKeyPair()
	userB := generateKeyPair()
	ok(fmt.Sprintf("user_a pub: %s…", userA.pubB64[:12]))
	ok(fmt.Sprintf("user_b pub: %s…", userB.pubB64[:12]))

	// ── Step 2: publish keys ────────────────────────────────────────────────
	step(2, "Publishing public keys to Key Server")

	resp, _ := postJSON(keyServerURL()+"/publish", map[string]string{
		"user_id": "user_a", "public_key": userA.pubB64,
	})
	if resp.StatusCode != http.StatusCreated {
		fail("publish user_a", fmt.Errorf("HTTP %d", resp.StatusCode))
	}
	ok("user_a key published")

	resp, _ = postJSON(keyServerURL()+"/publish", map[string]string{
		"user_id": "user_b", "public_key": userB.pubB64,
	})
	if resp.StatusCode != http.StatusCreated {
		fail("publish user_b", fmt.Errorf("HTTP %d", resp.StatusCode))
	}
	ok("user_b key published")

	// ── Step 3: retrieve key ────────────────────────────────────────────────
	step(3, "Retrieving user_b public key from Key Server")
	resp, body := getJSON(keyServerURL() + "/user_b")
	if resp.StatusCode != http.StatusOK {
		fail("get user_b key", fmt.Errorf("HTTP %d", resp.StatusCode))
	}
	if body["public_key"] != userB.pubB64 {
		fail("key mismatch", fmt.Errorf("got %s, want %s", body["public_key"], userB.pubB64))
	}
	ok("key matches")

	// ── Step 4: mask generator ──────────────────────────────────────────────
	step(4, "Testing Mask Generator: POST /generate-mask")
	resp, data := postJSON(maskGenURL()+"/generate-mask", map[string]string{
		"text":      "Hey, are you free tonight? Let's meet.",
		"cipher_id": "harry_potter",
	})
	if resp.StatusCode != http.StatusOK {
		fail("generate-mask", fmt.Errorf("HTTP %d: %s", resp.StatusCode, data))
	}
	var maskResp map[string]string
	json.Unmarshal(data, &maskResp) //nolint:errcheck
	mask := maskResp["mask"]
	if len(mask) < 10 {
		fail("mask too short", fmt.Errorf("got %q", mask))
	}
	ok(fmt.Sprintf("mask: %q", mask))

	// ── Step 5: WebSocket full flow ─────────────────────────────────────────
	step(5, "Connecting to API Gateway WebSocket as user_a")

	conn, _, err := websocket.DefaultDialer.Dial(
		gatewayURL()+"/ws?user_id=user_a", nil)
	if err != nil {
		fail("ws dial", err)
	}
	defer conn.Close()
	ok("connected")

	// auth
	step(5, "Authenticating (sending private key)")
	wsSend(conn, wsMsg{Type: "auth", PrivKey: userA.privB64})
	reply := wsRead(conn)
	if reply.Type != "auth_ok" {
		fail("auth", fmt.Errorf("got type=%s error=%s", reply.Type, reply.Error))
	}
	ok("authenticated")

	// send message
	step(5, "Sending encrypted message to user_b")
	wsSend(conn, wsMsg{
		Type:     "send_message",
		To:       "user_b",
		Text:     "Secret: meet at the usual place at 9pm.",
		CipherID: "harry_potter",
	})
	reply = wsRead(conn)
	if reply.Type != "send" {
		fail("send_message", fmt.Errorf("got type=%s error=%s", reply.Type, reply.Error))
	}
	visible := reply.Stego
	if idx := len(reply.Stego); idx > 60 {
		visible = reply.Stego[:60] + "…"
	}
	ok(fmt.Sprintf("stego built, mask: %q", visible))

	fmt.Println("\n=== All checks passed ===")
	fmt.Println("Note: stego message returned to client — send via Telethon.")
}
